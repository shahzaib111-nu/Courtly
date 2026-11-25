package com.scd.courtly.controller;

import com.scd.courtly.model.Court;
import com.scd.courtly.service.CourtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/courts")
@RequiredArgsConstructor
public class CourtController {

    private final CourtService courtService;

    @GetMapping
    public List<Court> getAllCourts() {
        return courtService.getAllCourts();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Court> getCourtById(@PathVariable String id) {
        return courtService.getCourtById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/by-sport")
    public List<Court> getBySport(@RequestParam String type) {
        return courtService.getCourtsBySport(type);
    }

    @GetMapping("/available")
    public List<Court> getAvailable() {
        return courtService.getAvailableCourts();
    }


    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<?> createCourt(@RequestBody Court court) {
        try {
            return ResponseEntity.ok(courtService.createCourt(court));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<?> updateCourt(@PathVariable String id, @RequestBody Court court) {
        try {
            return courtService.updateCourt(id, court)
                    .<ResponseEntity<?>>map(ResponseEntity::ok)
                    .orElse(ResponseEntity.notFound().build());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Map<String, Boolean>> deleteCourt(@PathVariable String id) {
        return courtService.deleteCourt(id)
                ? ResponseEntity.ok(Map.of("deleted", true))
                : ResponseEntity.notFound().build();
    }

    @GetMapping("/{id}/slots")
    public ResponseEntity<List<Map<String, String>>> getSlots(@PathVariable String id) {
        return courtService.getCourtById(id)
                .map(court -> ResponseEntity.ok(courtService.generateTimeSlots(court)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/sport-types")
    public String[] getSportTypes() {
        return new String[]{"TENNIS", "CRICKET", "FOOTBALL", "BASKETBALL", "FUTSAL", "BADMINTON", "SQUASH", "VOLLEYBALL"};
    }
}
