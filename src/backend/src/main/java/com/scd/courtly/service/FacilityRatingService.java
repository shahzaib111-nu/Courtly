package com.scd.courtly.service;

import com.scd.courtly.model.Booking;
import com.scd.courtly.model.FacilityRating;
import com.scd.courtly.repository.BookingRepository;
import com.scd.courtly.repository.FacilityRatingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class FacilityRatingService {

    private final FacilityRatingRepository ratingRepository;
    private final BookingRepository        bookingRepository;
    private final NotificationService      notificationService;

    public FacilityRating submitRating(String bookingID, String playerID,
                                       int ratingScore, String feedbackText) {

        Booking booking = bookingRepository.findById(bookingID)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        if (!booking.getPlayerID().equals(playerID))
            throw new RuntimeException("You can only rate your own bookings");

        if ("CANCELLED".equals(booking.getStatus()))
            throw new RuntimeException("Cannot rate a cancelled booking");

        if (ratingRepository.existsByBookingID(bookingID))
            throw new RuntimeException("You have already rated this facility for this booking");

        LocalDate bookingDate = LocalDate.parse(booking.getBookingDate());
        LocalDate today = LocalDate.now();
        if (bookingDate.isAfter(today))
            throw new RuntimeException("Cannot rate a facility before your booking date");

        if (bookingDate.isEqual(today)) {
            String endTimeStr = booking.getTimeSlot().split("-")[1].trim();
            LocalTime slotEnd = LocalTime.parse(endTimeStr);
            if (!LocalTime.now().isAfter(slotEnd))
                throw new RuntimeException("Cannot rate the facility before your slot has ended");
        }

        if (ratingScore < 1 || ratingScore > 5)
            throw new RuntimeException("Rating must be between 1 and 5");

        FacilityRating rating = new FacilityRating();
        rating.setBookingID(bookingID);
        rating.setPlayerID(playerID);
        rating.setCourtID(booking.getCourtID());
        rating.setCourtName(booking.getCourtName());
        rating.setSportType(booking.getSportType());
        rating.setBookingDate(booking.getBookingDate());
        rating.setRatingScore(ratingScore);
        rating.setFeedbackText(feedbackText != null && !feedbackText.isBlank() ? feedbackText.trim() : null);

        FacilityRating saved = ratingRepository.save(rating);

        if (ratingScore < 3) {
            try {
                String court = booking.getCourtName() != null ? booking.getCourtName() : booking.getCourtID();
                String sport = booking.getSportType() != null ? " (" + booking.getSportType() + ")" : "";
                notificationService.create(
                    NotificationService.ADMIN_USER_ID,
                    "LOW_RATING",
                    "Low Facility Rating — " + court,
                    court + sport + " received a " + ratingScore + "/5 rating on " + booking.getBookingDate() + "."
                );
            } catch (Exception ignored) { }
        }

        return saved;
    }

    public List<FacilityRating> getPlayerRatings(String playerID) {
        return ratingRepository.findByPlayerIDOrderBySubmittedAtDesc(playerID);
    }

    public boolean isRatingSubmitted(String bookingID) {
        return ratingRepository.existsByBookingID(bookingID);
    }

    public double getAverageRating(String courtID) {
        Double avg = ratingRepository.findAverageScoreByCourtID(courtID);
        return avg != null ? Math.round(avg * 10.0) / 10.0 : 0.0;
    }

    public List<FacilityRating> getAllRatings() {
        return ratingRepository.findAllByOrderBySubmittedAtDesc();
    }
}
