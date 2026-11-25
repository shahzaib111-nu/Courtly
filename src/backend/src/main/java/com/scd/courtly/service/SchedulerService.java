package com.scd.courtly.service;

import com.scd.courtly.model.Booking;
import com.scd.courtly.model.Player;
import com.scd.courtly.repository.BookingRepository;
import com.scd.courtly.repository.CourtRepository;
import com.scd.courtly.repository.PlayerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.List;

@Service
public class SchedulerService {

    @Autowired
    private PlayerRepository playerRepository;

    @Autowired
    private DocumentStorageService documentStorage;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private CourtRepository courtRepository;

    @Autowired
    private NotificationService notificationService;

    @Scheduled(cron = "0 0 0 * * *")
    public void cleanExpiredDeletions() {
        Date cutoff = Date.from(
                LocalDateTime.now().minusDays(7)
                        .atZone(ZoneId.systemDefault()).toInstant()
        );
        List<Player> expired = playerRepository
                .findByDeletionStatusAndDeletionRequestedAtBefore("PENDING", cutoff);

        for (Player player : expired) {
            documentStorage.deleteAllFor(player.getUserID());   // documents and their encrypted contents
            playerRepository.delete(player);
        }
    }

    // Runs every minute so a slot is released at most ~1 minute after the payment window ends
    @Scheduled(fixedRate = 60_000)
    public void expireUnpaidBookings() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(BookingService.PAYMENT_WINDOW_MINUTES);
        List<Booking> stale = bookingRepository.findByStatusAndCreatedAtBefore("PENDING", cutoff);
        for (Booking b : stale) {
            b.setStatus("CANCELLED");
            b.setClosedAt(LocalDateTime.now());
            bookingRepository.save(b);

            notificationService.create(
                b.getPlayerID(),
                "BOOKING_EXPIRED",
                "Booking Expired",
                "Your booking for " + b.getCourtName() + " on " + b.getBookingDate() +
                " at " + b.getTimeSlot() + " has expired because payment was not completed within "
                + BookingService.PAYMENT_WINDOW_MINUTES + " minutes."
            );
        }
    }

    // Runs every 5 minutes — marks CONFIRMED bookings as COMPLETED once their slot time has passed
    @Scheduled(fixedRate = 300_000)
    public void autoCompleteBookings() {
        String today = LocalDate.now().toString();
        LocalTime now = LocalTime.now();

        // 1. All CONFIRMED bookings from past dates → complete immediately
        List<Booking> pastDate = bookingRepository.findByStatusAndBookingDateLessThan("CONFIRMED", today);
        for (Booking b : pastDate) {
            b.setStatus("COMPLETED");
            b.setClosedAt(LocalDateTime.now());
            bookingRepository.save(b);
            notificationService.create(
                b.getPlayerID(),
                "BOOKING_COMPLETED",
                "Booking Completed",
                "Your session at " + b.getCourtName() + " on " + b.getBookingDate() +
                " at " + b.getTimeSlot() + " is marked as completed. Rate your experience!"
            );
        }

        // 2. CONFIRMED bookings for today where the slot end time has already passed
        List<Booking> todayConfirmed = bookingRepository.findByStatusAndBookingDate("CONFIRMED", today);
        for (Booking b : todayConfirmed) {
            try {
                String endStr = b.getTimeSlot().split("-")[1].trim();
                LocalTime slotEnd = LocalTime.parse(endStr);
                if (now.isAfter(slotEnd)) {
                    b.setStatus("COMPLETED");
                    b.setClosedAt(LocalDateTime.now());
                    bookingRepository.save(b);
                    notificationService.create(
                        b.getPlayerID(),
                        "BOOKING_COMPLETED",
                        "Booking Completed",
                        "Your session at " + b.getCourtName() + " on " + b.getBookingDate() +
                        " at " + b.getTimeSlot() + " is marked as completed. Rate your experience!"
                    );
                }
            } catch (Exception ignored) {}
        }
    }

    // Runs every minute — auto-transitions courts into/out of MAINTENANCE based on scheduled windows
    @Scheduled(fixedDelay = 60_000)
    public void applyMaintenanceTransitions() {
        LocalDateTime now = LocalDateTime.now();
        courtRepository.findAll().forEach(c -> {
            if (c.getMaintenanceFrom() != null
                    && !c.getMaintenanceFrom().isAfter(now)
                    && !"MAINTENANCE".equals(c.getStatus())) {
                c.setStatus("MAINTENANCE");
                courtRepository.save(c);
            }
            if (c.getMaintenanceTo() != null
                    && !c.getMaintenanceTo().isAfter(now)
                    && "MAINTENANCE".equals(c.getStatus())) {
                c.setStatus("AVAILABLE");
                c.setMaintenanceFrom(null);
                c.setMaintenanceTo(null);
                courtRepository.save(c);
            }
        });
    }

    // Runs every 30 minutes — notifies players whose slot starts within the next 30 minutes
    @Scheduled(fixedRate = 1_800_000)
    public void notifyUpcomingSlots() {
        String today = LocalDate.now().toString();
        List<Booking> confirmed = bookingRepository.findByStatusAndBookingDate("CONFIRMED", today);

        LocalDateTime now = LocalDateTime.now();
        for (Booking b : confirmed) {
            try {
                String[] parts  = b.getTimeSlot().split("-");
                String[] hm     = parts[0].trim().split(":");
                LocalDateTime slotStart = LocalDateTime.now()
                        .withHour(Integer.parseInt(hm[0]))
                        .withMinute(Integer.parseInt(hm[1]))
                        .withSecond(0).withNano(0);

                long minutesUntil = java.time.Duration.between(now, slotStart).toMinutes();
                // Notify between 25–35 minutes before start (window to avoid double-firing)
                if (minutesUntil >= 25 && minutesUntil <= 35) {
                    notificationService.create(
                        b.getPlayerID(),
                        "SLOT_STARTING",
                        "Your Slot Starts in 30 Minutes!",
                        "Get ready! Your booking for " + b.getCourtName() +
                        " starts at " + parts[0].trim() + " today. Head to the venue soon."
                    );
                }
            } catch (Exception ignored) {}
        }
    }

    // Runs every 2 minutes — retries notification e-mails that could not be delivered (FR-43)
    @Scheduled(fixedDelay = 120_000)
    public void retryNotificationEmails() {
        notificationService.retryQueuedDeliveries();
    }
}
