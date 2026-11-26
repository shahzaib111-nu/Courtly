package com.scd.courtly.service;

import com.scd.courtly.model.Court;
import com.scd.courtly.exception.ConflictException;
import com.scd.courtly.repository.BookingRepository;
import com.scd.courtly.repository.CourtRepository;
import com.scd.courtly.support.Fixtures;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.AdditionalAnswers.returnsFirstArg;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@Tag("unit")
@DisplayName("CourtService")
@ExtendWith(MockitoExtension.class)
class CourtServiceTest {

    @Mock CourtRepository courtRepository;
    @Mock BookingRepository bookingRepository;
    @InjectMocks CourtService service;

    @Nested
    @DisplayName("Time slot generation")
    class TimeSlots {

        @Test
        @DisplayName("splits opening hours into slots of the configured length")
        void regularHours() {
            Court c = Fixtures.court("C");
            c.setOpenTime("08:00");
            c.setCloseTime("12:00");
            c.setSlotDurationMinutes(90);

            List<Map<String, String>> slots = service.generateTimeSlots(c);

            // 08:00-09:30, 09:30-11:00; a third slot would end after closing
            assertThat(slots).extracting(s -> s.get("startTime") + "-" + s.get("endTime"))
                .containsExactly("08:00-09:30", "09:30-11:00");
            assertThat(slots.get(0)).containsEntry("display", "08:00 – 09:30");
        }

        @Test
        @DisplayName("handles closing time after midnight")
        void pastMidnight() {
            Court c = Fixtures.court("C");
            c.setOpenTime("22:00");
            c.setCloseTime("01:00");

            assertThat(service.generateTimeSlots(c)).extracting(s -> s.get("startTime"))
                .containsExactly("22:00", "23:00", "00:00");
        }

        @Test
        @DisplayName("defaults to 60-minute slots when duration is not set")
        void defaultDuration() {
            Court c = Fixtures.court("C");
            c.setOpenTime("10:00");
            c.setCloseTime("12:00");
            c.setSlotDurationMinutes(0);

            assertThat(service.generateTimeSlots(c)).hasSize(2);
        }

        @Test
        @DisplayName("returns no slots when opening hours are missing")
        void missingHours() {
            Court c = Fixtures.court("C");
            c.setOpenTime(null);
            assertThat(service.generateTimeSlots(c)).isEmpty();
        }
    }

    @Nested
    @DisplayName("CRUD")
    class Crud {

        @Test
        @DisplayName("sport filter is case-insensitive")
        void bySportUppercases() {
            service.getCourtsBySport("tennis");
            verify(courtRepository).findBySportType("TENNIS");
        }

        @Test
        @DisplayName("update copies fields and defaults invalid multipliers to 1.0")
        void updateDefaultsMultipliers() {
            Court existing = Fixtures.court("C");
            when(courtRepository.findById("C")).thenReturn(Optional.of(existing));
            when(courtRepository.save(any())).thenAnswer(returnsFirstArg());

            Court changes = Fixtures.court("ignored");
            changes.setName("Renamed");
            changes.setHourlyRate(2000);
            changes.setPeakMultiplier(0);
            changes.setWeekendMultiplier(-1);

            Court updated = service.updateCourt("C", changes).orElseThrow();

            assertThat(updated.getCourtID()).isEqualTo("C");
            assertThat(updated.getName()).isEqualTo("Renamed");
            assertThat(updated.getHourlyRate()).isEqualTo(2000);
            assertThat(updated.getPeakMultiplier()).isEqualTo(1.0);
            assertThat(updated.getWeekendMultiplier()).isEqualTo(1.0);
        }

        @Test
        @DisplayName("update of an unknown court returns empty")
        void updateUnknown() {
            when(courtRepository.findById("X")).thenReturn(Optional.empty());
            assertThat(service.updateCourt("X", Fixtures.court("X"))).isEmpty();
        }

        @Test
        @DisplayName("delete returns false for an unknown court")
        void deleteUnknown() {
            when(courtRepository.existsById("X")).thenReturn(false);
            assertThat(service.deleteCourt("X")).isFalse();
            verify(courtRepository, never()).deleteById(any());
        }

        @Test
        @DisplayName("delete removes an existing court with no upcoming bookings")
        void deleteExisting() {
            when(courtRepository.existsById("C")).thenReturn(true);
            assertThat(service.deleteCourt("C")).isTrue();
            verify(courtRepository).deleteById("C");
        }

        @Test
        @DisplayName("FR-34: a court with active future bookings cannot be removed")
        void deleteBlockedByFutureBookings() {
            when(courtRepository.existsById("C")).thenReturn(true);
            when(bookingRepository.countByCourtIDAndStatusInAndBookingDateGreaterThanEqual(
                eq("C"), eq(List.of("PENDING", "CONFIRMED")), eq(java.time.LocalDate.now().toString())))
                .thenReturn(2L);

            assertThatThrownBy(() -> service.deleteCourt("C"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("2 upcoming bookings");
            verify(courtRepository, never()).deleteById(any());
        }
    }

    @Nested
    @DisplayName("FR-35: court information is validated before saving")
    class Validation {

        private void invalid(java.util.function.Consumer<Court> change, String message) {
            Court c = Fixtures.court(null);
            change.accept(c);
            assertThatThrownBy(() -> service.createCourt(c))
                .isInstanceOf(com.scd.courtly.exception.BusinessException.class)
                .hasMessageContaining(message);
            verify(courtRepository, never()).save(any());
        }

        @Test
        @DisplayName("a complete court is saved")
        void valid() {
            when(courtRepository.save(any())).thenAnswer(returnsFirstArg());
            assertThat(service.createCourt(Fixtures.court(null)).getName()).isEqualTo("Test Court null");
        }

        @Test @DisplayName("name") void name() {
            invalid(c -> c.setName("1"), "Court name");
            invalid(c -> c.setName("12345"), "Court name");
        }
        @Test @DisplayName("sport") void sport() { invalid(c -> c.setSportType("CHESS"), "Sport must be"); }
        @Test @DisplayName("hourly rate") void rate() {
            invalid(c -> c.setHourlyRate(-5), "Hourly rate");
            invalid(c -> c.setHourlyRate(500_000), "Hourly rate");
        }
        @Test @DisplayName("capacity") void capacity() { invalid(c -> c.setCapacity(500), "Capacity"); }
        @Test @DisplayName("opening hours") void hours() {
            invalid(c -> c.setOpenTime("25:00"), "HH:mm");
            invalid(c -> c.setCloseTime(c.getOpenTime()), "cannot be the same");
            invalid(c -> { c.setOpenTime("10:00"); c.setCloseTime("10:30"); }, "shorter than one slot");
        }
        @Test @DisplayName("slot length") void slot() { invalid(c -> c.setSlotDurationMinutes(37), "Slot length"); }
        @Test @DisplayName("peak hours") void peak() {
            invalid(c -> c.setPeakEndTime(null), "both the peak start and peak end");
            invalid(c -> { c.setPeakStartTime("20:00"); c.setPeakEndTime("18:00"); }, "after the peak start");
        }
        @Test @DisplayName("multipliers") void multipliers() { invalid(c -> c.setPeakMultiplier(5), "multipliers"); }
        @Test @DisplayName("status") void status() { invalid(c -> c.setStatus("BROKEN"), "Status must be"); }

        @Test
        @DisplayName("missing optional fields get sensible defaults")
        void defaults() {
            when(courtRepository.save(any())).thenAnswer(returnsFirstArg());
            Court c = new Court();
            c.setName("Minimal Court");
            c.setSportType("football");
            c.setHourlyRate(2000);
            Court saved = service.createCourt(c);
            assertThat(saved.getSportType()).isEqualTo("FOOTBALL");
            assertThat(saved.getCapacity()).isEqualTo(22);
            assertThat(saved.getSlotDurationMinutes()).isEqualTo(60);
            assertThat(saved.getStatus()).isEqualTo("AVAILABLE");
        }
    }
}
