package com.scd.courtly.controller;

import com.scd.courtly.dto.request.FacilityRequest;
import com.scd.courtly.dto.response.FacilityResponse;
import com.scd.courtly.exception.ForbiddenException;
import com.scd.courtly.model.Court;
import com.scd.courtly.model.Facility;
import com.scd.courtly.repository.CourtRepository;
import com.scd.courtly.security.AccessGuard;
import com.scd.courtly.service.FacilityService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Facilities (class diagram: Facility).
 *
 *  GET /api/facilities              → all facilities (public)
 *  GET /api/facilities/{id}         → one facility with its courts (public)
 *  GET /api/facilities/mine         → the signed-in manager's facility
 *  PUT /api/facilities/{id}         → update details (its manager or an admin, FR-32)
 */
@RestController
@RequestMapping("/api/facilities")
@RequiredArgsConstructor
public class FacilityController {

    private final FacilityService facilityService;
    private final CourtRepository courtRepository;
    private final AccessGuard guard;

    @GetMapping
    public List<FacilityResponse> list() {
        return facilityService.listAll();
    }

    @GetMapping("/mine")
    @PreAuthorize("hasRole('MANAGER')")
    public FacilityResponse mine() {
        return facilityService.toResponse(facilityService.facilityForManager(guard.caller().userId()));
    }

    @GetMapping("/{id}")
    public Map<String, Object> get(@PathVariable String id) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("facility", facilityService.get(id));
        List<Court> courts = courtRepository.findByFacilityId(id);
        body.put("courts", courts);
        return body;
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public FacilityResponse update(@PathVariable String id, @Valid @RequestBody FacilityRequest request) {
        Facility f = facilityService.find(id);
        AccessGuard.Caller caller = guard.caller();
        if (!caller.admin() && !caller.userId().equals(f.getManagerId())) {
            throw new ForbiddenException("You can only update your own facility.");
        }
        return facilityService.update(id, request);
    }
}
