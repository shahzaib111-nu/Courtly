package com.scd.courtly.controller;

import com.scd.courtly.model.FacilityRating;
import com.scd.courtly.service.FacilityRatingService;
import com.scd.courtly.dto.request.SubmitRatingRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ratings")
@RequiredArgsConstructor
public class FacilityRatingController {

    private final FacilityRatingService ratingService;

    /** POST /api/ratings/submit */
    @PostMapping("/submit")
    @PreAuthorize("hasAnyRole('USER','ADMIN','MANAGER')")
    public ResponseEntity<?> submit(@Valid @RequestBody SubmitRatingRequest request) {
        return ResponseEntity.ok(ratingService.submitRating(
            request.bookingID(), request.playerID(), request.ratingScore(), request.feedbackText()));
    }

    /** GET /api/ratings/player/{playerID} */
    @GetMapping("/player/{playerID}")
    public List<FacilityRating> playerRatings(@PathVariable String playerID) {
        return ratingService.getPlayerRatings(playerID);
    }

    /** GET /api/ratings/check/{bookingID} */
    @GetMapping("/check/{bookingID}")
    public ResponseEntity<?> check(@PathVariable String bookingID) {
        return ResponseEntity.ok(Map.of("submitted", ratingService.isRatingSubmitted(bookingID)));
    }

    /** GET /api/ratings/average/{courtID} */
    @GetMapping("/average/{courtID}")
    public ResponseEntity<?> average(@PathVariable String courtID) {
        return ResponseEntity.ok(Map.of("average", ratingService.getAverageRating(courtID)));
    }

    /** GET /api/ratings/all — admin: all ratings newest-first */
    @GetMapping("/all")
    public List<FacilityRating> all() {
        return ratingService.getAllRatings();
    }
}
