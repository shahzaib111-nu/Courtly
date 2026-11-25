package com.scd.courtly.service;

import com.scd.courtly.model.Court;
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
import static org.mockito.AdditionalAnswers.returnsFirstArg;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@Tag("unit")
@DisplayName("CourtService")
@ExtendWith(MockitoExtension.class)
class CourtServiceTest {

    @Mock CourtRepository courtRepository;
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
        @DisplayName("delete removes an existing court")
        void deleteExisting() {
            when(courtRepository.existsById("C")).thenReturn(true);
            assertThat(service.deleteCourt("C")).isTrue();
            verify(courtRepository).deleteById("C");
        }
    }
}
