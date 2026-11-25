package com.scd.courtly.service;

import com.scd.courtly.model.Court;
import com.scd.courtly.repository.BookingRepository;
import com.scd.courtly.repository.CourtRepository;
import com.scd.courtly.repository.PlayerRepository;
import com.scd.courtly.support.Fixtures;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.AdditionalAnswers.returnsFirstArg;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@Tag("unit")
@DisplayName("FacilityManagerService")
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FacilityManagerServiceTest {

    @Mock CourtRepository courtRepository;
    @Mock BookingRepository bookingRepository;
    @Mock PlayerRepository playerRepository;
    @InjectMocks FacilityManagerService service;

    private Court managedBy(String id, String managerId) {
        Court c = Fixtures.court(id);
        c.setManagerId(managerId);
        return c;
    }

    @Test
    @DisplayName("upcoming bookings only cover the manager's own courts")
    void upcomingUsesOwnCourts() {
        when(courtRepository.findAll()).thenReturn(List.of(managedBy("C1", "M1"), managedBy("C2", "M2")));
        when(bookingRepository.findByCourtIDInAndStatusInAndBookingDateGreaterThanEqualOrderByBookingDateAsc(
            eq(List.of("C1")), anyList(), anyString()))
            .thenReturn(List.of(Fixtures.booking("B1", "P1", "C1", "2099-01-01", "10:00-11:00", "PENDING")));
        when(playerRepository.findById("P1")).thenReturn(Optional.of(Fixtures.player("P1", "p1@x.com")));

        List<Map<String, Object>> rows = service.getUpcomingBookings("M1");

        assertThat(rows).singleElement()
            .satisfies(r -> assertThat(r).containsEntry("bookingID", "B1").containsEntry("playerEmail", "p1@x.com"));
    }

    @Test
    @DisplayName("a manager without courts gets an empty list")
    void noCourts() {
        when(courtRepository.findAll()).thenReturn(List.of(managedBy("C1", "M2")));
        assertThat(service.getUpcomingBookings("M1")).isEmpty();
        assertThat(service.getCompletedBookings("M1")).isEmpty();
        verifyNoInteractions(bookingRepository);
    }

    @Test
    @DisplayName("unknown players are shown as 'Unknown'")
    void unknownPlayer() {
        when(courtRepository.findAll()).thenReturn(List.of(managedBy("C1", "M1")));
        when(bookingRepository.findByCourtIDInAndStatusOrderByBookingDateDesc(List.of("C1"), "COMPLETED"))
            .thenReturn(List.of(Fixtures.booking("B1", "ghost", "C1", "2026-01-01", "10:00-11:00", "COMPLETED")));

        assertThat(service.getCompletedBookings("M1").get(0)).containsEntry("playerName", "Unknown");
    }

    @Test
    @DisplayName("lists only courts with a scheduled maintenance window")
    void scheduledMaintenances() {
        Court scheduled = managedBy("C1", "M1");
        scheduled.setMaintenanceFrom(LocalDateTime.of(2099, 1, 1, 10, 0));
        when(courtRepository.findAll()).thenReturn(List.of(scheduled, managedBy("C2", "M1")));

        assertThat(service.getScheduledMaintenances("M1")).singleElement()
            .satisfies(r -> assertThat(r).containsEntry("courtID", "C1").containsEntry("maintenanceTo", null));
    }

    @Test
    @DisplayName("cancelling maintenance clears the window and reopens the court")
    void cancelMaintenance() {
        Court c = managedBy("C1", "M1");
        c.setStatus("MAINTENANCE");
        c.setMaintenanceFrom(LocalDateTime.now());
        when(courtRepository.findById("C1")).thenReturn(Optional.of(c));

        assertThat(service.cancelMaintenance("C1")).isTrue();
        assertThat(c.getStatus()).isEqualTo("AVAILABLE");
        assertThat(c.getMaintenanceFrom()).isNull();
    }

    @Test
    @DisplayName("cancelling maintenance of an unknown court returns false")
    void cancelUnknown() {
        when(courtRepository.findById("X")).thenReturn(Optional.empty());
        assertThat(service.cancelMaintenance("X")).isFalse();
    }

    @Test
    @DisplayName("scheduling maintenance stores the window")
    void schedule() {
        Court c = managedBy("C1", "M1");
        when(courtRepository.findById("C1")).thenReturn(Optional.of(c));
        when(courtRepository.save(any())).thenAnswer(returnsFirstArg());
        LocalDateTime from = LocalDateTime.of(2099, 1, 1, 10, 0);

        Court saved = service.scheduleMaintenance("C1", from, from.plusHours(2));

        assertThat(saved.getMaintenanceFrom()).isEqualTo(from);
        assertThat(saved.getMaintenanceTo()).isEqualTo(from.plusHours(2));
    }
}
