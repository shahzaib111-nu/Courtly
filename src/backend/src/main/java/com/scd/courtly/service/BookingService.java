package com.scd.courtly.service;

import com.scd.courtly.model.Booking;
import com.scd.courtly.model.Court;
import com.scd.courtly.repository.BookingRepository;
import com.scd.courtly.repository.CourtRepository;
import com.scd.courtly.repository.PlayerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BookingService {

    private static final int MAX_ACTIVE_BOOKINGS = 2;

    /** NFR 3.2 / FR-21: an unpaid (PENDING) booking holds its slot for this long. */
    public static final int PAYMENT_WINDOW_MINUTES = 10;

    /** When the player must have paid by; afterwards the slot is released. */
    public static java.time.LocalDateTime paymentDeadline(Booking b) {
        java.time.LocalDateTime created = b.getCreatedAt() != null ? b.getCreatedAt() : java.time.LocalDateTime.now();
        return created.plusMinutes(PAYMENT_WINDOW_MINUTES);
    }

    private final BookingRepository   bookingRepository;
    private final CourtRepository     courtRepository;
    private final CourtService        courtService;
    private final NotificationService notificationService;
    private final PlayerRepository    playerRepository;

    // ── Availability ────────────────────────────────────────────────────────

    public List<Map<String, Object>> getAvailableSlots(String courtID, String date) {
        Court court = courtRepository.findById(courtID)
                .orElseThrow(() -> new RuntimeException("Court not found: " + courtID));

        Set<String> booked = bookingRepository
                .findByCourtIDAndBookingDateAndStatusNot(courtID, date, "CANCELLED")
                .stream()
                .map(Booking::getTimeSlot)
                .collect(Collectors.toSet());

        return courtService.generateTimeSlots(court).stream().map(raw -> {
            String ts      = raw.get("startTime") + "-" + raw.get("endTime");
            boolean isPeak = isSlotPeak(court, ts);
            double  price  = calculatePrice(court, ts, date);

            // Block slots that overlap with a scheduled maintenance window.
            // Uses interval overlap: slot overlaps window if slotEnd > maintFrom AND slotStart < maintTo
            boolean maintenanceBlocked = false;
            if (court.getMaintenanceFrom() != null) {
                try {
                    LocalDateTime slotStart = LocalDate.parse(date)
                            .atTime(LocalTime.parse(raw.get("startTime")));
                    LocalDateTime slotEnd = LocalDate.parse(date)
                            .atTime(LocalTime.parse(raw.get("endTime")));
                    boolean overlapsStart = slotEnd.isAfter(court.getMaintenanceFrom());
                    boolean overlapsEnd   = court.getMaintenanceTo() == null
                            || slotStart.isBefore(court.getMaintenanceTo());
                    maintenanceBlocked = overlapsStart && overlapsEnd;
                } catch (Exception ignored) {}
            }

            Map<String, Object> slot = new LinkedHashMap<>();
            slot.put("courtID",   courtID);
            slot.put("courtName", court.getName());
            slot.put("sportType", court.getSportType());
            slot.put("timeSlot",  ts);
            slot.put("startTime", raw.get("startTime"));
            slot.put("endTime",   raw.get("endTime"));
            slot.put("available", !booked.contains(ts) && !maintenanceBlocked);
            slot.put("isPeak",    isPeak);
            slot.put("price",     price);
            return slot;
        }).collect(Collectors.toList());
    }

    public List<Map<String, Object>> getAvailableSlotsByTypeAndDate(String sportType, String date) {
        return courtRepository.findBySportTypeAndStatus(sportType.toUpperCase(), "AVAILABLE")
                .stream()
                .flatMap(c -> getAvailableSlots(c.getCourtID(), date).stream()
                        .filter(s -> Boolean.TRUE.equals(s.get("available"))))
                .collect(Collectors.toList());
    }

    // ── Booking CRUD ────────────────────────────────────────────────────────

    @Transactional
    public Booking createBooking(String playerID, String courtID, String date, String timeSlot) {
        // ── Temporal validation ──────────────────────────────────────────────
        LocalDate today;
        LocalDate bookingDate;
        try {
            today       = LocalDate.now();
            bookingDate = LocalDate.parse(date);
        } catch (Exception e) {
            throw new RuntimeException("Invalid date format.");
        }
        if (bookingDate.isBefore(today)) {
            throw new RuntimeException("Cannot book a slot on a past date.");
        }
        if (bookingDate.isEqual(today)) {
            try {
                LocalTime slotStart = LocalTime.parse(timeSlot.split("-")[0].trim());
                if (!slotStart.isAfter(LocalTime.now())) {
                    throw new RuntimeException("This time slot has already passed. Please choose a future slot.");
                }
            } catch (RuntimeException re) {
                throw re;
            } catch (Exception e) {
                throw new RuntimeException("Invalid time slot format.");
            }
        }

        // Pessimistic write lock: issues SELECT ... FOR UPDATE on the court row.
        // Concurrent createBooking calls for the same court queue here — each
        // waits for the previous transaction to commit before re-checking availability,
        // so two users can never book the same slot simultaneously.
        Court court = courtRepository.findByIdForUpdate(courtID)
                .orElseThrow(() -> new RuntimeException("Court not found"));

        if (!"AVAILABLE".equals(court.getStatus()))
            throw new RuntimeException("Court is not available for booking");

        if (bookingRepository.existsByCourtIDAndBookingDateAndTimeSlotAndStatusNot(
                courtID, date, timeSlot, "CANCELLED"))
            throw new RuntimeException("This slot is already booked. Please choose another time.");

        int newStart = parseTime(timeSlot.split("-")[0].trim());
        int newEnd   = parseTime(timeSlot.split("-")[1].trim());
        List<Booking> sameDayBookings = bookingRepository
                .findByPlayerIDAndBookingDateAndStatusNot(playerID, date, "CANCELLED");
        for (Booking existing : sameDayBookings) {
            String[] parts = existing.getTimeSlot().split("-");
            int exStart = parseTime(parts[0].trim());
            int exEnd   = parseTime(parts[1].trim());
            if (newStart < exEnd && newEnd > exStart)
                throw new RuntimeException(
                        "You already have a booking from " + existing.getTimeSlot() +
                        " that overlaps with this slot. You cannot be at two courts simultaneously.");
        }

        long active = bookingRepository.countByPlayerIDAndStatusIn(
                playerID, List.of("PENDING", "CONFIRMED"));
        if (active >= MAX_ACTIVE_BOOKINGS)
            throw new RuntimeException(
                    "You already have " + MAX_ACTIVE_BOOKINGS + " active bookings. Cancel one to proceed.");

        // Apply player tier discount
        double priceBeforeDiscount = calculatePrice(court, timeSlot, date);
        double discountPct = playerRepository.findById(playerID)
                .map(p -> switch (Optional.ofNullable(p.getDiscountTier()).orElse("NONE")) {
                    case "STUDENT", "SENIOR", "FAMILY" -> 0.20;
                    default -> 0.0;
                }).orElse(0.0);
        double discountAmount = Math.round(priceBeforeDiscount * discountPct);

        Booking b = new Booking();
        b.setPlayerID(playerID);
        b.setCourtID(courtID);
        b.setCourtName(court.getName());
        b.setSportType(court.getSportType());
        b.setBookingDate(date);
        b.setTimeSlot(timeSlot);
        b.setBaseRate(court.getHourlyRate());
        b.setTotalCost(priceBeforeDiscount - discountAmount);
        b.setDiscountApplied(discountAmount);
        b.setPeakHour(isSlotPeak(court, timeSlot));
        b.setStatus("PENDING");
        Booking saved = bookingRepository.save(b);

        String playerName = resolvePlayerName(playerID);

        // Notify the court's arena manager
        if (court.getManagerId() != null && !court.getManagerId().isBlank()) {
            notificationService.create(
                court.getManagerId(),
                "BOOKING_MADE",
                "New Booking Received",
                playerName + " has booked " + court.getName() +
                " on " + date + " at " + timeSlot + ". Please ensure the facility is ready."
            );
        }

        return saved;
    }

    public Booking confirmBooking(String bookingID) {
        Booking b = transition(bookingID, "PENDING", "CONFIRMED",
                "Booking must be in PENDING state to confirm");
        b.setConfirmedAt(LocalDateTime.now());
        final Booking saved = bookingRepository.save(b);

        // Notify player — payment confirmed
        notificationService.create(
            saved.getPlayerID(),
            "BOOKING_CONFIRMED",
            "Booking Confirmed — Payment Received!",
            "Your booking for " + saved.getCourtName() + " on " + saved.getBookingDate() +
            " at " + saved.getTimeSlot() + " is confirmed. Enjoy your game!"
        );

        // Notify the court's manager — payment received
        courtRepository.findById(saved.getCourtID()).ifPresent(court -> {
            if (court.getManagerId() != null && !court.getManagerId().isBlank()) {
                String playerName = resolvePlayerName(saved.getPlayerID());
                notificationService.create(
                    court.getManagerId(),
                    "BOOKING_CONFIRMED",
                    "Payment Received for Booking",
                    playerName + "'s booking for " + court.getName() +
                    " on " + saved.getBookingDate() + " at " + saved.getTimeSlot() +
                    " has been paid and confirmed."
                );
            }
        });

        return saved;
    }

    public Booking cancelBooking(String bookingID) {
        Booking b = bookingRepository.findById(bookingID)
                .orElseThrow(() -> new RuntimeException("Booking not found"));
        if ("COMPLETED".equals(b.getStatus()))
            throw new RuntimeException("Cannot cancel a completed booking");
        b.setStatus("CANCELLED");
        b.setClosedAt(LocalDateTime.now());
        Booking saved = bookingRepository.save(b);

        String playerName = resolvePlayerName(b.getPlayerID());

        // Notify player
        notificationService.create(
            b.getPlayerID(),
            "BOOKING_CANCELLED",
            "Booking Cancelled",
            "Your booking for " + b.getCourtName() + " on " + b.getBookingDate() +
            " at " + b.getTimeSlot() + " has been cancelled."
        );

        // Notify manager and admin
        courtRepository.findById(b.getCourtID()).ifPresent(court -> {
            if (court.getManagerId() != null && !court.getManagerId().isBlank()) {
                notificationService.create(
                    court.getManagerId(),
                    "BOOKING_CANCELLED",
                    "Booking Cancelled",
                    playerName + " cancelled their booking for " + court.getName() +
                    " on " + b.getBookingDate() + " at " + b.getTimeSlot() + "."
                );
            }
        });

        return saved;
    }

    public Booking completeBooking(String bookingID) {
        return transition(bookingID, "CONFIRMED", "COMPLETED",
                "Booking must be CONFIRMED before it can be completed");
    }

    public List<Booking> getPlayerBookings(String playerID) {
        LocalDateTime cutoff = LocalDateTime.now().minusHours(24);
        return bookingRepository.findByPlayerIDOrderByBookingDateDesc(playerID)
                .stream()
                .filter(b -> {
                    if ("COMPLETED".equals(b.getStatus()) || "CANCELLED".equals(b.getStatus())) {
                        if (b.getClosedAt() != null) return b.getClosedAt().isAfter(cutoff);
                        // No closedAt (old data): treat end-of-booking-day as the close time
                        try {
                            return LocalDate.parse(b.getBookingDate()).atTime(23, 59, 59).isAfter(cutoff);
                        } catch (Exception e) {
                            return false;
                        }
                    }
                    return true;
                })
                .collect(Collectors.toList());
    }

    // ── Pricing ─────────────────────────────────────────────────────────────

    public Map<String, Object> getPriceDetails(String courtID, String timeSlot, String date) {
        Court court = courtRepository.findById(courtID)
                .orElseThrow(() -> new RuntimeException("Court not found"));
        double price  = calculatePrice(court, timeSlot, date);
        boolean isPeak = isSlotPeak(court, timeSlot);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("courtID",        courtID);
        out.put("courtName",      court.getName());
        out.put("timeSlot",       timeSlot);
        out.put("date",           date);
        out.put("baseRate",       court.getHourlyRate());
        out.put("peakMultiplier", court.getPeakMultiplier());
        out.put("isPeak",         isPeak);
        out.put("price",          price);
        return out;
    }

    public double calculatePrice(Court court, String timeSlot, String date) {
        double rate  = court.getHourlyRate();
        double hours = (court.getSlotDurationMinutes() > 0 ? court.getSlotDurationMinutes() : 60) / 60.0;

        if (isSlotPeak(court, timeSlot) && court.getPeakMultiplier() > 1.0)
            rate *= court.getPeakMultiplier();

        try {
            DayOfWeek dow = LocalDate.parse(date).getDayOfWeek();
            if ((dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY)
                    && court.getWeekendMultiplier() > 1.0)
                rate *= court.getWeekendMultiplier();
        } catch (Exception ignored) {}

        return Math.round(rate * hours);
    }

    public boolean isSlotPeak(Court court, String timeSlot) {
        if (court.getPeakStartTime() == null || court.getPeakEndTime() == null
                || court.getPeakStartTime().isBlank()) return false;
        int slotStart  = parseTime(timeSlot.split("-")[0].trim());
        int peakStart  = parseTime(court.getPeakStartTime());
        int peakEnd    = parseTime(court.getPeakEndTime());
        return slotStart >= peakStart && slotStart < peakEnd;
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private String resolvePlayerName(String playerID) {
        return playerRepository.findById(playerID)
                .map(p -> p.getName() != null && !p.getName().isBlank() ? p.getName() : "A player")
                .orElse("A player");
    }

    private Booking transition(String id, String from, String to, String errMsg) {
        Booking b = bookingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Booking not found"));
        if (!from.equals(b.getStatus())) throw new RuntimeException(errMsg);
        b.setStatus(to);
        if ("COMPLETED".equals(to) || "CANCELLED".equals(to)) b.setClosedAt(LocalDateTime.now());
        return bookingRepository.save(b);
    }

    private int parseTime(String hhmm) {
        String[] p = hhmm.split(":");
        return Integer.parseInt(p[0]) * 60 + Integer.parseInt(p[1]);
    }
}
