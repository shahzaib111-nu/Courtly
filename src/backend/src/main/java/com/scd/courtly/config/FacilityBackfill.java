package com.scd.courtly.config;

import com.scd.courtly.model.Court;
import com.scd.courtly.model.Facility;
import com.scd.courtly.repository.CourtRepository;
import com.scd.courtly.repository.FacilityRatingRepository;
import com.scd.courtly.repository.FacilityRepository;
import com.scd.courtly.service.FacilityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Courts and ratings created before facilities existed get linked to their manager's
 * facility at startup (a facility is created for a manager who has none yet).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FacilityBackfill {

    private final CourtRepository courtRepository;
    private final FacilityRatingRepository ratingRepository;
    private final FacilityRepository facilityRepository;
    private final FacilityService facilityService;

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void linkCourtsAndRatings() {
        int courts = 0, ratings = 0;
        for (Court c : courtRepository.findAll()) {
            if (c.getFacilityId() == null && c.getManagerId() != null && !c.getManagerId().isBlank()) {
                c.setFacilityId(facilityService.facilityForManager(c.getManagerId()).getFacilityID());
                courtRepository.save(c);
                courts++;
            }
        }
        for (var r : ratingRepository.findAll()) {
            if (r.getFacilityId() != null || r.getCourtID() == null) continue;
            var facility = courtRepository.findById(r.getCourtID())
                .map(Court::getFacilityId).flatMap(facilityRepository::findById);
            if (facility.isPresent()) {
                Facility f = facility.get();
                r.setFacilityId(f.getFacilityID());
                r.setFacilityName(f.getName());
                ratingRepository.save(r);
                ratings++;
            }
        }
        if (courts + ratings > 0) log.info("Linked {} court(s) and {} rating(s) to facilities", courts, ratings);
    }
}
