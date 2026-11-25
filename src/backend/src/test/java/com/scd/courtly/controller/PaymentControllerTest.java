package com.scd.courtly.controller;

import com.scd.courtly.model.Booking;
import com.scd.courtly.model.Payment;
import com.scd.courtly.model.Player;
import com.scd.courtly.repository.PaymentRepository;
import com.scd.courtly.service.PaymentGateway.GatewayIntent;
import com.scd.courtly.support.IntegrationTest;
import com.scd.courtly.support.TestData;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.time.LocalDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Card payment flow. Stripe is replaced by a mocked {@code PaymentGateway}
 * (see IntegrationTest), so these tests never contact the real payment provider.
 */
@DisplayName("Payments API  /api/payments")
class PaymentControllerTest extends IntegrationTest {

    private static final String INTENT_ID = "pi_test_123";

    @Autowired PaymentRepository paymentRepository;

    private Player player;
    private Booking booking;   // PENDING, total 1000 PKR

    @BeforeEach
    void pendingBooking() {
        player = newPlayer();
        booking = saveBooking(player.getUserID(), TestData.TENNIS_COURT_1,
            TestData.futureWeekday(5).toString(), "10:00-11:00", "PENDING");
        when(paymentGateway.createIntent(anyString(), anyLong()))
            .thenAnswer(inv -> new GatewayIntent(INTENT_ID, "secret_abc", "requires_payment_method",
                inv.getArgument(1), inv.getArgument(0), null, null));
    }

    private void stripeReports(String status, String bookingID, long amountMinor) {
        when(paymentGateway.retrieveIntent(INTENT_ID))
            .thenReturn(new GatewayIntent(INTENT_ID, "secret_abc", status, amountMinor, bookingID, "4242", "visa"));
    }

    private ResultActions start(String token, String bookingID) throws Exception {
        return mockMvc.perform(post("/api/payments/create-payment-intent").header("Authorization", token)
            .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("bookingID", bookingID))));
    }

    private ResultActions confirm(String token) throws Exception {
        return mockMvc.perform(post("/api/payments/confirm").header("Authorization", token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(json(Map.of("bookingID", booking.getBookingID(), "paymentIntentID", INTENT_ID))));
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("POST /create-payment-intent")
    class StartCheckout {

        @Test
        @DisplayName("the server sets the amount from the booking, not the browser")
        void amountFromBooking() throws Exception {
            start(tokenFor(player), booking.getBookingID())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").value(1000.0))
                .andExpect(jsonPath("$.clientSecret").value("secret_abc"))
                .andExpect(jsonPath("$.paymentIntentID").value(INTENT_ID))
                .andExpect(jsonPath("$.publishableKey").value("pk_test_dummy"))
                .andExpect(jsonPath("$.courtName").value(booking.getCourtName()));
            verify(paymentGateway).createIntent(booking.getBookingID(), 100_000L); // PKR 1000 in paisa
        }

        @Test
        @DisplayName("a discounted booking shows subtotal, discount and amount to pay")
        void discount() throws Exception {
            booking.setTotalCost(800);
            booking.setDiscountApplied(200);
            bookingRepository.saveAndFlush(booking);

            start(tokenFor(player), booking.getBookingID())
                .andExpect(jsonPath("$.subtotal").value(1000.0))
                .andExpect(jsonPath("$.discount").value(200.0))
                .andExpect(jsonPath("$.amount").value(800.0));
        }

        @Test
        @DisplayName("someone else's booking → 403")
        void notOwner() throws Exception {
            start(playerToken(), booking.getBookingID())
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("You can only pay for your own bookings."));
            verifyNoInteractions(paymentGateway);
        }

        @Test
        @DisplayName("an already confirmed booking → 409")
        void alreadyPaid() throws Exception {
            booking.setStatus("CONFIRMED");
            bookingRepository.saveAndFlush(booking);
            start(tokenFor(player), booking.getBookingID())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("This booking has already been paid."));
        }

        @Test
        @DisplayName("a cancelled or expired booking → 409")
        void cancelled() throws Exception {
            booking.setStatus("CANCELLED");
            bookingRepository.saveAndFlush(booking);
            start(tokenFor(player), booking.getBookingID())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("can no longer be paid")));
        }

        @Test
        @DisplayName("unknown booking → 404, missing booking ID → 400, no token → 401")
        void invalidRequests() throws Exception {
            start(tokenFor(player), "nope").andExpect(status().isNotFound());
            mockMvc.perform(post("/api/payments/create-payment-intent").header("Authorization", tokenFor(player))
                    .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.bookingID").exists());
            mockMvc.perform(post("/api/payments/create-payment-intent")
                    .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("bookingID", "x"))))
                .andExpect(status().isUnauthorized());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("POST /confirm")
    class Confirm {

        @Test
        @DisplayName("verified payment is recorded, the booking is CONFIRMED and a receipt is returned")
        void success() throws Exception {
            stripeReports("succeeded", booking.getBookingID(), 100_000L);

            confirm(tokenFor(player))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.receiptNo", matchesPattern("CRT-\\d{8}-[A-Z0-9]{6}")))
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.amountPaid").value(1000.0))
                .andExpect(jsonPath("$.maskedCard").value("•••• 4242"))
                .andExpect(jsonPath("$.cardBrand").value("visa"))
                .andExpect(jsonPath("$.transactionRef").value(INTENT_ID))
                .andExpect(jsonPath("$.playerName").value(player.getName()));

            assertThat(bookingRepository.findById(booking.getBookingID()).orElseThrow().getStatus()).isEqualTo("CONFIRMED");
            Payment saved = paymentRepository.findByBookingID(booking.getBookingID()).orElseThrow();
            assertThat(saved.getMaskedCard()).isEqualTo("4242");   // only the last four digits are stored
        }

        @Test
        @DisplayName("confirming twice returns the same receipt (safe to retry)")
        void idempotent() throws Exception {
            stripeReports("succeeded", booking.getBookingID(), 100_000L);
            String first = confirm(tokenFor(player)).andReturn().getResponse().getContentAsString();
            String receiptNo = objectMapper.readTree(first).get("receiptNo").asText();

            confirm(tokenFor(player))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.receiptNo").value(receiptNo));
            assertThat(paymentRepository.count()).isEqualTo(1);
        }

        @Test
        @DisplayName("payment Stripe has not completed → 402, booking stays PENDING")
        void notSucceeded() throws Exception {
            stripeReports("requires_payment_method", booking.getBookingID(), 100_000L);
            confirm(tokenFor(player)).andExpect(status().isPaymentRequired());
            assertThat(bookingRepository.findById(booking.getBookingID()).orElseThrow().getStatus()).isEqualTo("PENDING");
        }

        @Test
        @DisplayName("a payment made for a different booking is rejected")
        void wrongBooking() throws Exception {
            stripeReports("succeeded", "another-booking", 100_000L);
            confirm(tokenFor(player))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("This payment does not belong to this booking."));
        }

        @Test
        @DisplayName("a payment for the wrong amount is rejected")
        void wrongAmount() throws Exception {
            stripeReports("succeeded", booking.getBookingID(), 100L);   // PKR 1 instead of 1000
            confirm(tokenFor(player))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("The amount paid does not match the booking price."));
            assertThat(paymentRepository.count()).isZero();
        }

        @Test
        @DisplayName("booking expired while paying → payment refunded, 409")
        void expiredWhilePaying() throws Exception {
            stripeReports("succeeded", booking.getBookingID(), 100_000L);
            booking.setStatus("CANCELLED");
            bookingRepository.saveAndFlush(booking);

            confirm(tokenFor(player))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("refunded")));
            verify(paymentGateway).issueRefund(INTENT_ID);
            assertThat(paymentRepository.findByBookingID(booking.getBookingID()).orElseThrow().getStatus())
                .isEqualTo("REFUNDED");
        }

        @Test
        @DisplayName("someone else's booking → 403")
        void notOwner() throws Exception {
            confirm(playerToken()).andExpect(status().isForbidden());
            verifyNoInteractions(paymentGateway);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("GET /booking/{bookingID} (receipt)")
    class Receipt {

        @Test
        @DisplayName("the player who paid and an admin can see the receipt; others cannot")
        void access() throws Exception {
            stripeReports("succeeded", booking.getBookingID(), 100_000L);
            confirm(tokenFor(player)).andExpect(status().isOk());

            mockMvc.perform(get("/api/payments/booking/{id}", booking.getBookingID()).header("Authorization", tokenFor(player)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.receiptNo", org.hamcrest.Matchers.startsWith("CRT-")));
            mockMvc.perform(get("/api/payments/booking/{id}", booking.getBookingID()).header("Authorization", adminToken()))
                .andExpect(status().isOk());
            mockMvc.perform(get("/api/payments/booking/{id}", booking.getBookingID()).header("Authorization", playerToken()))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("unpaid booking → 404")
        void unpaid() throws Exception {
            mockMvc.perform(get("/api/payments/booking/{id}", booking.getBookingID()).header("Authorization", tokenFor(player)))
                .andExpect(status().isNotFound());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("10-minute payment window (NFR 3.2, FR-21)")
    class PaymentWindow {

        @Test
        @DisplayName("checkout tells the browser when the slot will be released")
        void reportsDeadline() throws Exception {
            String body = start(tokenFor(player), booking.getBookingID())
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
            LocalDateTime deadline = LocalDateTime.parse(objectMapper.readTree(body).get("paymentDeadline").asText());
            assertThat(deadline).isEqualTo(booking.getCreatedAt().plusMinutes(10).withNano(0));
        }

        @Test
        @DisplayName("after 10 minutes the booking can no longer be paid → 409")
        void windowEnded() throws Exception {
            booking.setCreatedAt(LocalDateTime.now().minusMinutes(11));
            bookingRepository.saveAndFlush(booking);

            start(tokenFor(player), booking.getBookingID())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("10-minute payment window")));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("GET /player/{playerID} (payment history, FR-26)")
    class History {

        @Test
        @DisplayName("lists the player's payments with their receipt details")
        void listsPayments() throws Exception {
            stripeReports("succeeded", booking.getBookingID(), 100_000L);
            confirm(tokenFor(player)).andExpect(status().isOk());

            mockMvc.perform(get("/api/payments/player/{id}", player.getUserID()).header("Authorization", tokenFor(player)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].bookingID").value(booking.getBookingID()))
                .andExpect(jsonPath("$[0].receiptNo", org.hamcrest.Matchers.startsWith("CRT-")))
                .andExpect(jsonPath("$[0].amountPaid").value(1000.0))
                .andExpect(jsonPath("$[0].maskedCard").value("•••• 4242"))
                .andExpect(jsonPath("$[0].status").value("SUCCESS"));
        }

        @Test
        @DisplayName("a player with no payments gets an empty list")
        void empty() throws Exception {
            mockMvc.perform(get("/api/payments/player/{id}", player.getUserID()).header("Authorization", tokenFor(player)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
        }

        @Test
        @DisplayName("NFR 2.3.2: only the player and admins can see it")
        void access() throws Exception {
            mockMvc.perform(get("/api/payments/player/{id}", player.getUserID()).header("Authorization", playerToken()))
                .andExpect(status().isForbidden());
            mockMvc.perform(get("/api/payments/player/{id}", player.getUserID()).header("Authorization", adminToken()))
                .andExpect(status().isOk());
            mockMvc.perform(get("/api/payments/player/{id}", player.getUserID()))
                .andExpect(status().isUnauthorized());
        }
    }
}
