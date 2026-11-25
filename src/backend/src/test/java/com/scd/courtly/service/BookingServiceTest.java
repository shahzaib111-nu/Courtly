package com.scd.courtly.service;

import com.scd.courtly.model.Booking;
import com.scd.courtly.model.Court;
import com.scd.courtly.model.Player;
import com.scd.courtly.repository.BookingRepository;
import com.scd.courtly.repository.CourtRepository;
import com.scd.courtly.repository.PlayerRepository;
import com.scd.courtly.support.Fixtures;
import com.scd.courtly.support.TestData;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.AdditionalAnswers.returnsFirstArg;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@Tag("unit")
@DisplayName("BookingService")
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BookingServiceTest {

    private static final String PLAYER = "P-1";
    private static final String COURT  = "C-1";

    @Mock BookingRepository bookingRepository;
    @Mock CourtRepository courtRepository;
    @Mock NotificationService notificationService;
    @Mock PlayerRepository playerRepository;

    private BookingService service;
    private Court court;
    private final String weekday  = TestData.futureWeekday(7).toString();
    private final String saturday = TestData.futureSaturday(7).toString();

    @BeforeEach
    void setUp() {
        // Real CourtService: slot generation is pure logic and part of what we test.
        service = new BookingService(bookingRepository, courtRepository,
            new CourtService(courtRepository, bookingRepository), notificationService, playerRepository);
        court = Fixtures.court(COURT);
        when(courtRepository.findById(COURT)).thenReturn(Optional.of(court));
        when(courtRepository.findByIdForUpdate(COURT)).thenReturn(Optional.of(court));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(returnsFirstArg());
        when(playerRepository.findById(PLAYER)).thenReturn(Optional.of(Fixtures.player(PLAYER, "p1@x.com")));
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Pricing")
    class Pricing {

        @ParameterizedTest(name = "{0} slot on {1} costs {2} PKR")
        @CsvSource({
            "10:00-11:00, WEEKDAY,  1000",   // base rate
            "18:00-19:00, WEEKDAY,  1500",   // peak x1.5
            "10:00-11:00, SATURDAY, 1250",   // weekend x1.25
            "18:00-19:00, SATURDAY, 1875",   // peak and weekend
        })
        void appliesPeakAndWeekendMultipliers(String slot, String day, double expected) {
            String date = day.equals("WEEKDAY") ? weekday : saturday;
            assertThat(service.calculatePrice(court, slot, date)).isEqualTo(expected);
        }

        @ParameterizedTest(name = "slot starting {0} is peak = {1}")
        @CsvSource({"16:00-17:00, false", "17:00-18:00, true", "20:00-21:00, true", "21:00-22:00, false"})
        void peakWindowIncludesStartAndExcludesEnd(String slot, boolean peak) {
            assertThat(service.isSlotPeak(court, slot)).isEqualTo(peak);
        }

        @Test
        @DisplayName("court without peak hours is never peak")
        void noPeakConfigured() {
            court.setPeakStartTime(null);
            assertThat(service.isSlotPeak(court, "18:00-19:00")).isFalse();
        }

        @Test
        @DisplayName("price details include rate, multiplier and peak flag")
        void priceDetails() {
            Map<String, Object> details = service.getPriceDetails(COURT, "18:00-19:00", weekday);
            assertThat(details)
                .containsEntry("courtID", COURT)
                .containsEntry("isPeak", true)
                .containsEntry("price", 1500.0)
                .containsEntry("baseRate", 1000.0);
        }

        @Test
        @DisplayName("price details for unknown court fail")
        void priceDetailsUnknownCourt() {
            assertThatThrownBy(() -> service.getPriceDetails("nope", "10:00-11:00", weekday))
                .hasMessageContaining("Court not found");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Availability")
    class Availability {

        @Test
        @DisplayName("lists every slot and marks booked ones unavailable")
        void bookedSlotIsUnavailable() {
            when(bookingRepository.findByCourtIDAndBookingDateAndStatusNot(COURT, weekday, "CANCELLED"))
                .thenReturn(List.of(Fixtures.booking("B1", "other", COURT, weekday, "10:00-11:00", "CONFIRMED")));

            List<Map<String, Object>> slots = service.getAvailableSlots(COURT, weekday);

            assertThat(slots).hasSize(14); // 08:00 → 22:00 in 60-minute slots
            assertThat(slot(slots, "10:00-11:00")).containsEntry("available", false);
            assertThat(slot(slots, "11:00-12:00")).containsEntry("available", true);
        }

        @Test
        @DisplayName("slots overlapping a maintenance window are blocked")
        void maintenanceBlocksOverlappingSlots() {
            LocalDate day = LocalDate.parse(weekday);
            court.setMaintenanceFrom(day.atTime(12, 0));
            court.setMaintenanceTo(day.atTime(14, 0));

            List<Map<String, Object>> slots = service.getAvailableSlots(COURT, weekday);

            assertThat(slot(slots, "11:00-12:00")).containsEntry("available", true);
            assertThat(slot(slots, "12:00-13:00")).containsEntry("available", false);
            assertThat(slot(slots, "13:00-14:00")).containsEntry("available", false);
            assertThat(slot(slots, "14:00-15:00")).containsEntry("available", true);
        }

        @Test
        @DisplayName("search by sport returns only free slots")
        void searchBySportReturnsOnlyFreeSlots() {
            when(courtRepository.findBySportTypeAndStatus("TENNIS", "AVAILABLE")).thenReturn(List.of(court));
            when(bookingRepository.findByCourtIDAndBookingDateAndStatusNot(COURT, weekday, "CANCELLED"))
                .thenReturn(List.of(Fixtures.booking("B1", "other", COURT, weekday, "10:00-11:00", "PENDING")));

            List<Map<String, Object>> free = service.getAvailableSlotsByTypeAndDate("tennis", weekday);

            assertThat(free).hasSize(13).allSatisfy(s -> assertThat(s).containsEntry("available", true));
        }

        @Test
        @DisplayName("unknown court fails")
        void unknownCourt() {
            assertThatThrownBy(() -> service.getAvailableSlots("missing", weekday))
                .hasMessageContaining("Court not found");
        }

        private Map<String, Object> slot(List<Map<String, Object>> slots, String timeSlot) {
            return slots.stream().filter(s -> timeSlot.equals(s.get("timeSlot"))).findFirst().orElseThrow();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Creating a booking")
    class CreateBooking {

        @Test
        @DisplayName("creates a PENDING booking, prices it and notifies the court manager")
        void success() {
            Booking b = service.createBooking(PLAYER, COURT, weekday, "18:00-19:00");

            assertThat(b.getStatus()).isEqualTo("PENDING");
            assertThat(b.getTotalCost()).isEqualTo(1500.0);
            assertThat(b.isPeakHour()).isTrue();
            assertThat(b.getDiscountApplied()).isZero();
            verify(notificationService).create(eq("MGR-TEST"), eq("BOOKING_MADE"), anyString(), anyString());
        }

        @ParameterizedTest(name = "{0} tier gets 20 % off")
        @CsvSource({"STUDENT", "SENIOR", "FAMILY"})
        void discountTiers(String tier) {
            Player p = Fixtures.player(PLAYER, "p1@x.com");
            p.setDiscountTier(tier);
            when(playerRepository.findById(PLAYER)).thenReturn(Optional.of(p));

            Booking b = service.createBooking(PLAYER, COURT, weekday, "10:00-11:00");

            assertThat(b.getDiscountApplied()).isEqualTo(200.0);
            assertThat(b.getTotalCost()).isEqualTo(800.0);
        }

        @Test
        @DisplayName("court without a manager sends no notification")
        void noManagerNoNotification() {
            court.setManagerId(null);
            service.createBooking(PLAYER, COURT, weekday, "10:00-11:00");
            verifyNoInteractions(notificationService);
        }

        @Test
        @DisplayName("rejects a past date")
        void pastDate() {
            assertThatThrownBy(() -> service.createBooking(PLAYER, COURT, "2020-01-01", "10:00-11:00"))
                .hasMessage("Cannot book a slot on a past date.");
        }

        @Test
        @DisplayName("rejects a malformed date")
        void badDate() {
            assertThatThrownBy(() -> service.createBooking(PLAYER, COURT, "tomorrow", "10:00-11:00"))
                .hasMessage("Invalid date format.");
        }

        @Test
        @DisplayName("rejects an unknown court")
        void unknownCourt() {
            assertThatThrownBy(() -> service.createBooking(PLAYER, "missing", weekday, "10:00-11:00"))
                .hasMessage("Court not found");
        }

        @Test
        @DisplayName("rejects a court that is not AVAILABLE")
        void courtUnderMaintenance() {
            court.setStatus("MAINTENANCE");
            assertThatThrownBy(() -> service.createBooking(PLAYER, COURT, weekday, "10:00-11:00"))
                .hasMessage("Court is not available for booking");
        }

        @Test
        @DisplayName("rejects a slot that is already booked")
        void doubleBooking() {
            when(bookingRepository.existsByCourtIDAndBookingDateAndTimeSlotAndStatusNot(
                COURT, weekday, "10:00-11:00", "CANCELLED")).thenReturn(true);
            assertThatThrownBy(() -> service.createBooking(PLAYER, COURT, weekday, "10:00-11:00"))
                .hasMessageContaining("already booked");
        }

        @Test
        @DisplayName("rejects overlapping bookings for the same player")
        void overlappingPlayerBooking() {
            when(bookingRepository.findByPlayerIDAndBookingDateAndStatusNot(PLAYER, weekday, "CANCELLED"))
                .thenReturn(List.of(Fixtures.booking("B9", PLAYER, "C-2", weekday, "10:00-11:00", "CONFIRMED")));
            assertThatThrownBy(() -> service.createBooking(PLAYER, COURT, weekday, "10:00-11:00"))
                .hasMessageContaining("overlaps");
        }

        @Test
        @DisplayName("rejects a third active booking")
        void maxActiveBookings() {
            when(bookingRepository.countByPlayerIDAndStatusIn(eq(PLAYER), anyCollection())).thenReturn(2L);
            assertThatThrownBy(() -> service.createBooking(PLAYER, COURT, weekday, "10:00-11:00"))
                .hasMessageContaining("2 active bookings");
            verify(bookingRepository, never()).save(any());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Booking lifecycle")
    class Lifecycle {

        private Booking stored(String status) {
            Booking b = Fixtures.booking("B1", PLAYER, COURT, weekday, "10:00-11:00", status);
            when(bookingRepository.findById("B1")).thenReturn(Optional.of(b));
            return b;
        }

        @Test
        @DisplayName("confirm: PENDING → CONFIRMED, notifies player and manager")
        void confirm() {
            stored("PENDING");
            Booking b = service.confirmBooking("B1");

            assertThat(b.getStatus()).isEqualTo("CONFIRMED");
            assertThat(b.getConfirmedAt()).isNotNull();
            verify(notificationService).create(eq(PLAYER), eq("BOOKING_CONFIRMED"), anyString(), anyString());
            verify(notificationService).create(eq("MGR-TEST"), eq("BOOKING_CONFIRMED"), anyString(), anyString());
        }

        @Test
        @DisplayName("confirm: only PENDING bookings can be confirmed")
        void confirmWrongState() {
            stored("CANCELLED");
            assertThatThrownBy(() -> service.confirmBooking("B1")).hasMessageContaining("PENDING");
        }

        @Test
        @DisplayName("cancel: sets CANCELLED and closedAt")
        void cancel() {
            stored("CONFIRMED");
            Booking b = service.cancelBooking("B1");

            assertThat(b.getStatus()).isEqualTo("CANCELLED");
            assertThat(b.getClosedAt()).isNotNull();
            verify(notificationService).create(eq(PLAYER), eq("BOOKING_CANCELLED"), anyString(), anyString());
        }

        @Test
        @DisplayName("cancel: completed bookings cannot be cancelled")
        void cancelCompleted() {
            stored("COMPLETED");
            assertThatThrownBy(() -> service.cancelBooking("B1")).hasMessage("Cannot cancel a completed booking");
        }

        @Test
        @DisplayName("cancel: unknown booking fails")
        void cancelUnknown() {
            assertThatThrownBy(() -> service.cancelBooking("nope")).hasMessage("Booking not found");
        }

        @Test
        @DisplayName("complete: CONFIRMED → COMPLETED")
        void complete() {
            stored("CONFIRMED");
            Booking b = service.completeBooking("B1");
            assertThat(b.getStatus()).isEqualTo("COMPLETED");
            assertThat(b.getClosedAt()).isNotNull();
        }

        @Test
        @DisplayName("complete: PENDING bookings cannot be completed")
        void completePending() {
            stored("PENDING");
            assertThatThrownBy(() -> service.completeBooking("B1")).hasMessageContaining("CONFIRMED");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Player booking history")
    class History {

        @Test
        @DisplayName("hides bookings that were closed more than 24 hours ago")
        void hidesOldClosedBookings() {
            Booking active = Fixtures.booking("A", PLAYER, COURT, weekday, "10:00-11:00", "PENDING");
            Booking recentlyDone = Fixtures.booking("R", PLAYER, COURT, "2026-01-01", "10:00-11:00", "COMPLETED");
            recentlyDone.setClosedAt(LocalDateTime.now().minusHours(1));
            Booking oldCancelled = Fixtures.booking("O", PLAYER, COURT, "2026-01-01", "10:00-11:00", "CANCELLED");
            oldCancelled.setClosedAt(LocalDateTime.now().minusDays(2));
            when(bookingRepository.findByPlayerIDOrderByBookingDateDesc(PLAYER))
                .thenReturn(List.of(active, recentlyDone, oldCancelled));

            assertThat(service.getPlayerBookings(PLAYER))
                .extracting(Booking::getBookingID).containsExactly("A", "R");
        }
    }
}
