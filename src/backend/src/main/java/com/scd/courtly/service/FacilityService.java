package com.scd.courtly.service;

import com.scd.courtly.dto.request.FacilityRequest;
import com.scd.courtly.dto.response.FacilityResponse;
import com.scd.courtly.exception.BusinessException;
import com.scd.courtly.exception.NotFoundException;
import com.scd.courtly.model.Facility;
import com.scd.courtly.model.FacilityRating;
import com.scd.courtly.repository.CourtRepository;
import com.scd.courtly.repository.FacilityRatingRepository;
import com.scd.courtly.repository.FacilityRepository;
import com.scd.courtly.repository.PlayerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

/** Facilities (class diagram: Facility). Each arena manager runs one facility that contains their courts. */
@Service
@RequiredArgsConstructor
public class FacilityService {

    private final FacilityRepository facilityRepository;
    private final CourtRepository courtRepository;
    private final FacilityRatingRepository ratingRepository;
    private final PlayerRepository playerRepository;

    public List<FacilityResponse> listAll() {
        return facilityRepository.findAll().stream().map(this::toResponse).toList();
    }

    public FacilityResponse get(String facilityID) {
        return toResponse(find(facilityID));
    }

    public Facility find(String facilityID) {
        return facilityRepository.findById(facilityID)
            .orElseThrow(() -> new NotFoundException("Facility not found"));
    }

    public Optional<Facility> findForManager(String managerId) {
        return managerId == null ? Optional.empty() : facilityRepository.findByManagerId(managerId);
    }

    /** The manager's facility, created with default details the first time it is needed. */
    @Transactional
    public Facility facilityForManager(String managerId) {
        return facilityRepository.findByManagerId(managerId).orElseGet(() -> {
            Facility f = new Facility();
            String managerName = playerRepository.findById(managerId).map(p -> p.getName()).orElse("Arena Manager");
            f.setName(managerName + "'s Arena");
            f.setManagerId(managerId);
            return facilityRepository.save(f);
        });
    }

    /** FR-32: the manager updates their facility's information. */
    @Transactional
    public FacilityResponse update(String facilityID, FacilityRequest req) {
        if (req.openingTime().equals(req.closingTime())) {
            throw new BusinessException("Opening and closing time cannot be the same.");
        }
        Facility f = find(facilityID);
        f.setName(req.name().trim());
        f.setLocation(req.location().trim());
        f.setOpeningTime(req.openingTime());
        f.setClosingTime(req.closingTime());
        return toResponse(facilityRepository.save(f));
    }

    public FacilityResponse toResponse(Facility f) {
        List<FacilityRating> ratings = ratingRepository.findByFacilityId(f.getFacilityID());
        Double avg = ratings.isEmpty() ? null
            : Math.round(ratings.stream().mapToInt(FacilityRating::getRatingScore).average().orElse(0) * 10) / 10.0;
        String managerName = f.getManagerId() == null ? null
            : playerRepository.findById(f.getManagerId()).map(p -> p.getName()).orElse(null);
        return new FacilityResponse(f.getFacilityID(), f.getName(), f.getLocation(), f.getOpeningTime(),
            f.getClosingTime(), f.getManagerId(), managerName, f.checkOperatingStatus(LocalTime.now()),
            courtRepository.countByFacilityId(f.getFacilityID()), avg, ratings.size());
    }
}
