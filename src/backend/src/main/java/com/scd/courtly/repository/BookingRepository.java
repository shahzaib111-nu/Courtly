package com.scd.courtly.repository;

import com.scd.courtly.model.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

@Repository
public interface BookingRepository extends JpaRepository<Booking, String> {

    List<Booking> findByPlayerIDOrderByBookingDateDesc(String playerID);

    List<Booking> findByCourtIDAndBookingDateAndStatusNot(String courtID, String bookingDate, String status);

    boolean existsByCourtIDAndBookingDateAndTimeSlotAndStatusNot(
            String courtID, String bookingDate, String timeSlot, String status);

    // All non-cancelled bookings for a player on a given date (used for overlap detection)
    List<Booking> findByPlayerIDAndBookingDateAndStatusNot(
            String playerID, String bookingDate, String status);

    long countByPlayerIDAndStatusIn(String playerID, Collection<String> statuses);

    List<Booking> findByStatusAndCreatedAtBefore(String status, LocalDateTime cutoff);

    List<Booking> findByStatusAndBookingDate(String status, String bookingDate);

    // For auto-complete: CONFIRMED bookings whose date is strictly before today
    List<Booking> findByStatusAndBookingDateLessThan(String status, String date);

    List<Booking> findByBookingDateAndStatusIn(String bookingDate, java.util.Collection<String> statuses);

    List<Booking> findByStatusInAndBookingDateGreaterThanEqual(
            java.util.Collection<String> statuses, String date);

    // Payment history: confirmed/completed bookings with confirmedAt in range
    List<Booking> findByStatusInAndConfirmedAtBetweenOrderByConfirmedAtDesc(
            Collection<String> statuses, LocalDateTime from, LocalDateTime to);

    // Manager views: bookings for a set of court IDs
    List<Booking> findByCourtIDInAndStatusInAndBookingDateGreaterThanEqualOrderByBookingDateAsc(
            Collection<String> courtIDs, Collection<String> statuses, String date);
    List<Booking> findByCourtIDInAndStatusOrderByBookingDateDesc(
            Collection<String> courtIDs, String status);
}
