package com.scd.courtly.service;

import com.scd.courtly.dto.response.CheckoutResponse;
import com.scd.courtly.dto.response.PaymentReceiptResponse;
import com.scd.courtly.exception.BusinessException;
import com.scd.courtly.exception.ConflictException;
import com.scd.courtly.exception.ForbiddenException;
import com.scd.courtly.exception.NotFoundException;
import com.scd.courtly.model.Booking;
import com.scd.courtly.model.Payment;
import com.scd.courtly.model.Player;
import com.scd.courtly.repository.BookingRepository;
import com.scd.courtly.repository.PaymentRepository;
import com.scd.courtly.repository.PlayerRepository;
import com.scd.courtly.service.PaymentGateway.GatewayIntent;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * Card payments for bookings (UC Process Payment, FR-22 to FR-26).
 *
 * <ol>
 *   <li>{@link #startCheckout}: the server works out the amount from the booking and
 *       creates a Stripe PaymentIntent. The browser never decides the price.</li>
 *   <li>The browser collects the card with Stripe.js; card numbers never reach this server.</li>
 *   <li>{@link #confirmPayment}: the server asks Stripe whether the payment really succeeded,
 *       records it with a receipt number, and confirms the booking.</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
public class PaymentService {

    private static final String RECEIPT_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final BookingRepository bookingRepository;
    private final PlayerRepository playerRepository;
    private final PaymentRepository paymentRepository;
    private final BookingService bookingService;
    private final NotificationService notificationService;
    private final PaymentGateway gateway;

    @Value("${stripe.api.public.key:}")
    private String publishableKey;

    // ── 1. Start checkout ────────────────────────────────────────────────────

    public CheckoutResponse startCheckout(String bookingID, String callerEmail) {
        Booking booking = ownedBooking(bookingID, callerEmail);

        if (paymentRepository.findByBookingID(bookingID).isPresent()
                || "CONFIRMED".equals(booking.getStatus()) || "COMPLETED".equals(booking.getStatus())) {
            throw new ConflictException("This booking has already been paid.");
        }
        if (!"PENDING".equals(booking.getStatus())) {
            throw new ConflictException("This booking was " + booking.getStatus().toLowerCase()
                + " and can no longer be paid. Please book the slot again.");
        }
        long amountMinor = toMinor(booking.getTotalCost());
        if (amountMinor <= 0) {
            throw new BusinessException("This booking has nothing to pay.");
        }

        GatewayIntent intent = gateway.createIntent(bookingID, amountMinor);

        return new CheckoutResponse(
            booking.getBookingID(), intent.id(), intent.clientSecret(), publishableKey,
            booking.getCourtName(), booking.getSportType(), booking.getBookingDate(), booking.getTimeSlot(),
            booking.isPeakHour(), subtotal(booking), booking.getDiscountApplied(), booking.getTotalCost(), "PKR");
    }

    // ── 2. Confirm after Stripe reports success ──────────────────────────────

    @Transactional(noRollbackFor = ConflictException.class)
    public PaymentReceiptResponse confirmPayment(String bookingID, String paymentIntentID, String callerEmail) {
        Booking booking = ownedBooking(bookingID, callerEmail);

        // Safe to call twice (e.g. the browser retries after a network error).
        var existing = paymentRepository.findByBookingID(bookingID);
        if (existing.isPresent()) {
            if (paymentIntentID.equals(existing.get().getStripeTransactionRef())
                    && "SUCCESS".equals(existing.get().getStatus())) {
                return receipt(existing.get(), booking);
            }
            throw new ConflictException("This booking has already been paid.");
        }

        GatewayIntent intent = gateway.retrieveIntent(paymentIntentID);
        if (!bookingID.equals(intent.bookingID())) {
            throw new BusinessException("This payment does not belong to this booking.");
        }
        if (!intent.succeeded()) {
            throw new BusinessException("The payment has not completed (status: " + intent.status() + ").",
                HttpStatus.PAYMENT_REQUIRED);
        }
        if (intent.amountMinor() != toMinor(booking.getTotalCost())) {
            throw new BusinessException("The amount paid does not match the booking price.");
        }

        // The booking expired or was cancelled while the player was paying: give the money back.
        if (!"PENDING".equals(booking.getStatus())) {
            gateway.issueRefund(paymentIntentID);
            savePayment(booking, intent, "REFUNDED");
            notificationService.create(booking.getPlayerID(), "PAYMENT_REFUNDED", "Payment Refunded",
                "Your booking for " + booking.getCourtName() + " on " + booking.getBookingDate() + " at "
                    + booking.getTimeSlot() + " expired before payment completed, so your payment of PKR "
                    + Math.round(booking.getTotalCost()) + " has been refunded.");
            throw new ConflictException("Your booking expired before the payment completed. "
                + "The payment has been refunded. Please book the slot again.");
        }

        Payment payment = savePayment(booking, intent, "SUCCESS");
        Booking confirmed = bookingService.confirmBooking(bookingID); // also notifies player and manager
        return receipt(payment, confirmed);
    }

    // ── 3. Receipts ──────────────────────────────────────────────────────────

    /** Receipt for a booking: visible to the player who paid, or an admin (NFR 2.3.2). */
    public PaymentReceiptResponse getReceipt(String bookingID, String callerEmail, boolean isAdmin) {
        Booking booking = isAdmin
            ? bookingRepository.findById(bookingID).orElseThrow(() -> new NotFoundException("Booking not found"))
            : ownedBooking(bookingID, callerEmail);
        Payment payment = paymentRepository.findByBookingID(bookingID)
            .orElseThrow(() -> new NotFoundException("No payment found for this booking"));
        return receipt(payment, booking);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private Booking ownedBooking(String bookingID, String callerEmail) {
        Booking booking = bookingRepository.findById(bookingID)
            .orElseThrow(() -> new NotFoundException("Booking not found"));
        boolean owner = playerRepository.findById(booking.getPlayerID())
            .map(Player::getEmail)
            .filter(email -> email.equalsIgnoreCase(callerEmail))
            .isPresent();
        if (!owner) throw new ForbiddenException("You can only pay for your own bookings.");
        return booking;
    }

    private Payment savePayment(Booking booking, GatewayIntent intent, String status) {
        Payment p = new Payment();
        p.setBookingID(booking.getBookingID());
        p.setPlayerID(booking.getPlayerID());
        p.setAmount(intent.amountMinor() / 100.0);
        p.setMethod("CARD");
        p.setStatus(status);
        p.setStripeTransactionRef(intent.id());
        p.setMaskedCard(intent.cardLast4());
        p.setCardBrand(intent.cardBrand());
        p.setReceiptNo(newReceiptNo());
        return paymentRepository.save(p);
    }

    private PaymentReceiptResponse receipt(Payment p, Booking b) {
        String playerName = playerRepository.findById(b.getPlayerID()).map(Player::getName).orElse("Player");
        return new PaymentReceiptResponse(
            p.getReceiptNo(), p.getPaymentID(), p.getStatus(), b.getBookingID(), playerName,
            b.getCourtName(), b.getBookingDate(), b.getTimeSlot(), b.isPeakHour(),
            subtotal(b), b.getDiscountApplied(), p.getAmount(),
            p.getCardBrand(), p.getMaskedCard() != null ? "•••• " + p.getMaskedCard() : null,
            p.getStripeTransactionRef(), p.getTransactionDate() != null ? p.getTransactionDate().toString() : null);
    }

    private String newReceiptNo() {
        String date = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        String receiptNo;
        do {
            StringBuilder sb = new StringBuilder("CRT-").append(date).append('-');
            for (int i = 0; i < 6; i++) sb.append(RECEIPT_CHARS.charAt(RANDOM.nextInt(RECEIPT_CHARS.length())));
            receiptNo = sb.toString();
        } while (paymentRepository.existsByReceiptNo(receiptNo));
        return receiptNo;
    }

    private static double subtotal(Booking b) {
        return b.getTotalCost() + b.getDiscountApplied();
    }

    static long toMinor(double pkr) {
        return Math.round(pkr * 100);
    }
}
