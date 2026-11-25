package com.scd.courtly.service;

import com.scd.courtly.model.Booking;
import com.scd.courtly.model.Court;
import com.scd.courtly.model.Player;
import com.scd.courtly.repository.BookingRepository;
import com.scd.courtly.repository.CourtRepository;
import com.scd.courtly.repository.PlayerRepository;
import com.scd.courtly.repository.VerificationDocRepository;
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

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@Tag("unit")
@DisplayName("SchedulerService (background jobs)")
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SchedulerServiceTest {

    @Mock PlayerRepository playerRepository;
    @Mock VerificationDocRepository verificationDocRepository;
    @Mock BookingRepository bookingRepository;
    @Mock CourtRepository courtRepository;
    @Mock NotificationService notificationService;
    @InjectMocks SchedulerService scheduler;

    private final String today = LocalDate.now().toString();

    @Test
    @DisplayName("unpaid bookings older than 60 minutes expire and the player is told")
    void expiresUnpaidBookings() {
        Booking stale = Fixtures.booking("B1", "P1", "C1", today, "10:00-11:00", "PENDING");
        when(bookingRepository.findByStatusAndCreatedAtBefore(eq("PENDING"), any())).thenReturn(List.of(stale));

        scheduler.expireUnpaidBookings();

        assertThat(stale.getStatus()).isEqualTo("CANCELLED");
        assertThat(stale.getClosedAt()).isNotNull();
        verify(notificationService).create(eq("P1"), eq("BOOKING_EXPIRED"), anyString(), anyString());
    }

    @Test
    @DisplayName("confirmed bookings from past days are completed")
    void completesPastBookings() {
        Booking past = Fixtures.booking("B1", "P1", "C1", "2026-01-01", "10:00-11:00", "CONFIRMED");
        when(bookingRepository.findByStatusAndBookingDateLessThan("CONFIRMED", today)).thenReturn(List.of(past));

        scheduler.autoCompleteBookings();

        assertThat(past.getStatus()).isEqualTo("COMPLETED");
        verify(notificationService).create(eq("P1"), eq("BOOKING_COMPLETED"), anyString(), anyString());
    }

    @Test
    @DisplayName("today's confirmed bookings are completed once the slot has ended")
    void completesEndedSlotToday() {
        assumeTrue(LocalTime.now().isAfter(LocalTime.of(0, 1)), "slot used by this test ends at 00:01");
        Booking ended = Fixtures.booking("B1", "P1", "C1", today, "00:00-00:01", "CONFIRMED");
        when(bookingRepository.findByStatusAndBookingDate("CONFIRMED", today)).thenReturn(List.of(ended));

        scheduler.autoCompleteBookings();

        assertThat(ended.getStatus()).isEqualTo("COMPLETED");
    }

    @Test
    @DisplayName("courts enter and leave MAINTENANCE according to their window")
    void maintenanceTransitions() {
        Court starting = Fixtures.court("C1");
        starting.setMaintenanceFrom(LocalDateTime.now().minusMinutes(5));
        Court ending = Fixtures.court("C2");
        ending.setStatus("MAINTENANCE");
        ending.setMaintenanceFrom(LocalDateTime.now().minusHours(2));
        ending.setMaintenanceTo(LocalDateTime.now().minusMinutes(1));
        when(courtRepository.findAll()).thenReturn(List.of(starting, ending));

        scheduler.applyMaintenanceTransitions();

        assertThat(starting.getStatus()).isEqualTo("MAINTENANCE");
        assertThat(ending.getStatus()).isEqualTo("AVAILABLE");
        assertThat(ending.getMaintenanceFrom()).isNull();
    }

    @Test
    @DisplayName("accounts whose 7-day deletion grace period expired are deleted with their documents")
    void deletesExpiredAccounts() {
        Player p = Fixtures.player("P1", "p1@x.com");
        when(playerRepository.findByDeletionStatusAndDeletionRequestedAtBefore(eq("PENDING"), any())).thenReturn(List.of(p));
        when(verificationDocRepository.findByPlayer_UserID("P1")).thenReturn(List.of());

        scheduler.cleanExpiredDeletions();

        verify(verificationDocRepository).deleteAll(List.of());
        verify(playerRepository).delete(p);
    }

    @Test
    @DisplayName("players get a reminder 30 minutes before their slot")
    void remindsUpcomingSlot() {
        LocalTime start = LocalTime.now().plusMinutes(30).withSecond(0).withNano(0);
        assumeTrue(start.isAfter(LocalTime.now()), "reminder window must not cross midnight");
        String slot = String.format("%02d:%02d-23:59", start.getHour(), start.getMinute());
        when(bookingRepository.findByStatusAndBookingDate("CONFIRMED", today))
            .thenReturn(List.of(Fixtures.booking("B1", "P1", "C1", today, slot, "CONFIRMED")));

        scheduler.notifyUpcomingSlots();

        verify(notificationService).create(eq("P1"), eq("SLOT_STARTING"), anyString(), anyString());
    }
}
