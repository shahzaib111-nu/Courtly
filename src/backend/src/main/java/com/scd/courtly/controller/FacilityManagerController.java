package com.scd.courtly.controller;

import com.scd.courtly.service.FacilityManagerService;
import com.scd.courtly.dto.request.MaintenanceRequest;
import com.scd.courtly.dto.response.MaintenanceResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
@RequestMapping("/api/manager")
@RequiredArgsConstructor
public class FacilityManagerController {

    private final FacilityManagerService facilityManagerService;

    @GetMapping("/bookings/upcoming")
    public ResponseEntity<List<Map<String, Object>>> getUpcomingBookings(@RequestParam String managerID) {
        return ResponseEntity.ok(facilityManagerService.getUpcomingBookings(managerID));
    }

    @GetMapping("/bookings/completed")
    public ResponseEntity<List<Map<String, Object>>> getCompletedBookings(@RequestParam String managerID) {
        return ResponseEntity.ok(facilityManagerService.getCompletedBookings(managerID));
    }

    @GetMapping("/courts/maintenances")
    public ResponseEntity<List<Map<String, Object>>> getScheduledMaintenances(@RequestParam String managerID) {
        return ResponseEntity.ok(facilityManagerService.getScheduledMaintenances(managerID));
    }

    @DeleteMapping("/courts/{courtID}/schedule-maintenance")
    public ResponseEntity<?> cancelMaintenance(@PathVariable String courtID) {
        if (!facilityManagerService.cancelMaintenance(courtID)) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("message", "Maintenance cancelled."));
    }

    @PostMapping("/courts/{courtID}/schedule-maintenance")
    public ResponseEntity<?> scheduleMaintenance(
            @PathVariable String courtID,
            @Valid @RequestBody MaintenanceRequest request) {

        String fromStr = request.maintenanceFrom();
        String toStr = request.maintenanceTo();
        if (fromStr == null || fromStr.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "maintenanceFrom is required."));
        }

        LocalDateTime from;
        LocalDateTime to = null;
        try {
            from = LocalDateTime.parse(fromStr);
            if (toStr != null && !toStr.isBlank()) to = LocalDateTime.parse(toStr);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid datetime format. Use ISO-8601 (e.g. 2026-05-15T17:00)."));
        }

        if (from.isBefore(LocalDateTime.now())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Maintenance start time must be in the future."));
        }

        try {
            var court = facilityManagerService.scheduleMaintenance(courtID, from, to);
            MaintenanceResponse response = new MaintenanceResponse(
                court.getCourtID(), from.toString(), to != null ? to.toString() : null,
                "Maintenance scheduled. Slots from " + from + " will be blocked.");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }
}
