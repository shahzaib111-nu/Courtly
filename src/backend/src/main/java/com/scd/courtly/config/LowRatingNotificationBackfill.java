package com.scd.courtly.config;

import com.scd.courtly.model.FacilityRating;
import com.scd.courtly.repository.FacilityRatingRepository;
import com.scd.courtly.repository.NotificationRepository;
import com.scd.courtly.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class LowRatingNotificationBackfill implements ApplicationListener<ApplicationReadyEvent> {

    private final FacilityRatingRepository ratingRepository;
    private final NotificationRepository   notificationRepository;
    private final NotificationService      notificationService;

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        List<FacilityRating> all = ratingRepository.findAll();
        for (FacilityRating r : all) {
            if (r.getRatingScore() >= 3) continue;

            String court = r.getCourtName() != null ? r.getCourtName() : r.getCourtID();
            String sport = r.getSportType()  != null ? " (" + r.getSportType() + ")" : "";
            String msg   = court + sport + " received a " + r.getRatingScore()
                         + "/5 rating on " + r.getBookingDate() + ".";

            if (!notificationRepository.existsByUserIdAndTypeAndMessage(
                    NotificationService.ADMIN_USER_ID, "LOW_RATING", msg)) {
                notificationService.create(
                    NotificationService.ADMIN_USER_ID,
                    "LOW_RATING",
                    "Low Facility Rating — " + court,
                    msg
                );
            }
        }
    }
}
