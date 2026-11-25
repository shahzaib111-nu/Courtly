package com.scd.courtly.service;

import com.scd.courtly.model.Booking;
import com.scd.courtly.model.Player;
import com.scd.courtly.repository.BookingRepository;
import com.scd.courtly.repository.CourtRepository;
import com.scd.courtly.repository.PlayerRepository;
import com.scd.courtly.support.Fixtures;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@Tag("unit")
@DisplayName("ReportService")
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ReportServiceTest {

    private static final String FROM = "2026-03-01";
    private static final String TO   = "2026-03-02";

    @Mock BookingRepository bookingRepository;
    @Mock CourtRepository courtRepository;
    @Mock PlayerRepository playerRepository;
    @InjectMocks ReportService service;

    private Booking booking(String id, String date, String status, double total, double discount, String sport) {
        Booking b = Fixtures.booking(id, "P1", "C1", date, "10:00-11:00", status);
        b.setTotalCost(total);
        b.setDiscountApplied(discount);
        b.setSportType(sport);
        return b;
    }

    @Nested
    @DisplayName("Revenue summary")
    class Revenue {

        @Test
        @DisplayName("sums paid bookings in range and splits base, surcharge and discount")
        void totals() {
            when(bookingRepository.findAll()).thenReturn(List.of(
                booking("B1", FROM, "CONFIRMED", 1500, 0, "TENNIS"),     // peak booking
                booking("B2", TO, "COMPLETED", 800, 200, "FUTSAL"),      // student discount
                booking("B3", TO, "CANCELLED", 1000, 0, "TENNIS"),       // not paid
                booking("B4", "2026-04-01", "CONFIRMED", 999, 0, "TENNIS") // out of range
            ));

            Map<String, Object> r = service.buildReport("revenue_summary", FROM, TO, null);

            assertThat(r)
                .containsEntry("type", "REVENUE_SUMMARY")
                .containsEntry("totalRevenue", 2300.0)
                .containsEntry("baseRevenue", 2000.0)
                .containsEntry("discountRevenue", 200.0)
                .containsEntry("peakWeekendExtra", 500.0)
                .containsEntry("bookingCount", 2L)
                .containsEntry("averageRevenue", 1150.0);
            assertThat((Map<String, Double>) r.get("revenueBySport"))
                .containsEntry("TENNIS", 1500.0).containsEntry("FUTSAL", 800.0);
        }
    }

    @Nested
    @DisplayName("Court utilization")
    class Utilization {

        @Test
        @DisplayName("divides booked slots by available slots in the period")
        void utilization() {
            // 08:00-22:00 = 14 slots/day x 2 days = 28 slots; 2 non-cancelled bookings
            when(courtRepository.findAll()).thenReturn(List.of(Fixtures.court("C1")));
            when(bookingRepository.findAll()).thenReturn(List.of(
                booking("B1", FROM, "COMPLETED", 1000, 0, "TENNIS"),
                booking("B2", TO, "CONFIRMED", 1000, 0, "TENNIS"),
                booking("B3", TO, "CANCELLED", 1000, 0, "TENNIS")));

            Map<String, Object> r = service.buildReport("COURT_UTILIZATION", FROM, TO, "TENNIS");

            assertThat(r)
                .containsEntry("totalCourts", 1)
                .containsEntry("totalBookings", 2L)
                .containsEntry("averageUtilization", 7.1)
                .containsEntry("totalBookedHours", 2.0);
            assertThat((List<?>) r.get("topCourts")).hasSize(1);
        }

        @Test
        @DisplayName("court type filter excludes other sports")
        void filterBySport() {
            when(courtRepository.findAll()).thenReturn(List.of(Fixtures.court("C1")));
            when(bookingRepository.findAll()).thenReturn(List.of(booking("B1", FROM, "COMPLETED", 1000, 0, "TENNIS")));

            assertThat(service.buildReport("COURT_UTILIZATION", FROM, TO, "CRICKET"))
                .containsEntry("totalCourts", 0)
                .containsEntry("totalBookings", 0L)
                .containsEntry("averageUtilization", 0.0);
        }
    }

    @Nested
    @DisplayName("User demographics")
    class Demographics {

        @Test
        @DisplayName("counts players by discount tier and age group, managers separately")
        void demographics() {
            Player student = Fixtures.player("P1", "a@x.com");
            student.setDiscountTier("STUDENT");
            student.setDateOfBirth(LocalDate.now().minusYears(20).toString());
            Player unknownAge = Fixtures.player("P2", "b@x.com");
            Player manager = Fixtures.player("M1", "m@x.com");
            manager.setRole("MANAGER");
            when(playerRepository.findAll()).thenReturn(List.of(student, unknownAge, manager));

            Map<String, Object> r = service.buildReport("USER_DEMOGRAPHICS", FROM, TO, null);

            assertThat(r).containsEntry("totalPlayers", 2).containsEntry("totalManagers", 1L);
            assertThat((Map<String, Long>) r.get("discountTierCounts")).containsEntry("STUDENT", 1L).containsEntry("NONE", 1L);
            assertThat((Map<String, Long>) r.get("ageGroupCounts")).containsEntry("18-25", 1L).containsEntry("Unknown", 1L);
        }
    }

    @Nested
    @DisplayName("Date range handling")
    class DateRange {

        @Test
        @DisplayName("swapped dates are put back in order")
        void swapped() {
            assertThat(service.buildReport("REVENUE_SUMMARY", TO, FROM, null))
                .containsEntry("startDate", FROM).containsEntry("endDate", TO);
        }

        @Test
        @DisplayName("invalid dates fall back to the last 7 days")
        void invalidDates() {
            LocalDate today = LocalDate.now();
            assertThat(service.buildReport("REVENUE_SUMMARY", "bad", "", null))
                .containsEntry("startDate", today.minusDays(7).toString())
                .containsEntry("endDate", today.toString());
        }

        @Test
        @DisplayName("unknown report type returns a message")
        void unknownType() {
            assertThat(service.buildReport("NOPE", FROM, TO, null))
                .containsEntry("message", "Unknown report type: NOPE");
        }
    }
}
