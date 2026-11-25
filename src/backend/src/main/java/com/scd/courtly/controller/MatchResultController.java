package com.scd.courtly.controller;

import com.scd.courtly.model.MatchResult;
import com.scd.courtly.security.AccessGuard;
import com.scd.courtly.service.MatchResultService;
import com.scd.courtly.dto.request.SubmitMatchRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/matches")
@RequiredArgsConstructor
public class MatchResultController {

    private final MatchResultService matchResultService;
    private final AccessGuard guard;

    /** POST /api/matches/submit */
    @PostMapping("/submit")
    @PreAuthorize("hasAnyRole('USER','ADMIN','MANAGER')")
    public ResponseEntity<?> submit(@Valid @RequestBody SubmitMatchRequest request) {
        guard.requireSelfOrAdmin(request.playerID());
        String bookingID = request.bookingID();
        String playerID = request.playerID();
        String opponentName = request.opponentName();
        int playerScore = request.playerScore();
        int opponentScore = request.opponentScore();
        String result = request.result().toUpperCase();
        return ResponseEntity.ok(matchResultService.submitResult(
                bookingID, playerID, opponentName, playerScore, opponentScore, result));
    }

    /** GET /api/matches/leaderboard */
    @GetMapping("/leaderboard")
    public ResponseEntity<?> leaderboard() {
        return ResponseEntity.ok(matchResultService.getLeaderboard());
    }

    /** GET /api/matches/player/{playerID} */
    @GetMapping("/player/{playerID}")
    public List<MatchResult> playerHistory(@PathVariable String playerID) {
        return matchResultService.getPlayerHistory(playerID);
    }

    /** GET /api/matches/check/{bookingID} */
    @GetMapping("/check/{bookingID}")
    public ResponseEntity<?> check(@PathVariable String bookingID) {
        return ResponseEntity.ok(Map.of("submitted", matchResultService.isResultSubmitted(bookingID)));
    }

    /** GET /api/matches/rankings?sportType=&dateFrom=&dateTo= — admin report */
    @GetMapping("/rankings")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> rankings(
            @RequestParam(required = false) String sportType,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo) {
        return ResponseEntity.ok(matchResultService.getRankingsReport(sportType, dateFrom, dateTo));
    }
}
