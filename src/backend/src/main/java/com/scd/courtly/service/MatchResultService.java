package com.scd.courtly.service;

import com.scd.courtly.exception.BusinessException;
import com.scd.courtly.exception.ConflictException;
import com.scd.courtly.exception.NotFoundException;
import com.scd.courtly.model.Booking;
import com.scd.courtly.model.MatchResult;
import com.scd.courtly.repository.BookingRepository;
import com.scd.courtly.repository.MatchResultRepository;
import com.scd.courtly.repository.PlayerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MatchResultService {

    private final MatchResultRepository matchResultRepository;
    private final BookingRepository     bookingRepository;
    private final PlayerRepository      playerRepository;
    private final NotificationService   notificationService;

    @Transactional
    public MatchResult submitResult(String bookingID, String playerID,
                                    String opponentName, int playerScore,
                                    int opponentScore, String result) {

        Booking booking = bookingRepository.findById(bookingID)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        if (!booking.getPlayerID().equals(playerID))
            throw new RuntimeException("You can only submit results for your own bookings");

        if ("CANCELLED".equals(booking.getStatus()))
            throw new RuntimeException("Cannot submit a result for a cancelled booking");

        if (matchResultRepository.existsByBookingID(bookingID))
            throw new RuntimeException("A result has already been submitted for this booking");

        LocalDate bookingDate = LocalDate.parse(booking.getBookingDate());
        LocalDate today = LocalDate.now();
        if (bookingDate.isAfter(today))
            throw new RuntimeException("Cannot submit a result before the match date");

        if (bookingDate.isEqual(today)) {
            String endTimeStr = booking.getTimeSlot().split("-")[1].trim();
            LocalTime slotEnd = LocalTime.parse(endTimeStr);
            if (!LocalTime.now().isAfter(slotEnd))
                throw new RuntimeException("Cannot submit a result before the slot has ended");
        }

        String normalizedResult = result.toUpperCase();
        if (!List.of("WIN", "LOSS", "DRAW").contains(normalizedResult))
            throw new RuntimeException("Result must be WIN, LOSS, or DRAW");

        int points = pointsFor(normalizedResult);
        String conflict = conflictReason(playerScore, opponentScore, normalizedResult);
        boolean disputed = conflict != null;

        String playerName = playerRepository.findById(playerID)
                .map(p -> p.getName() != null && !p.getName().isBlank() ? p.getName() : "Unknown")
                .orElse("Unknown");

        MatchResult mr = new MatchResult();
        mr.setBookingID(bookingID);
        mr.setPlayerID(playerID);
        mr.setPlayerName(playerName);
        mr.setCourtName(booking.getCourtName());
        mr.setSportType(booking.getSportType());
        mr.setBookingDate(booking.getBookingDate());
        mr.setTimeSlot(booking.getTimeSlot());
        mr.setOpponentName(opponentName);
        mr.setPlayerScore(playerScore);
        mr.setOpponentScore(opponentScore);
        mr.setResult(normalizedResult);
        mr.setStatus(disputed ? "DISPUTED" : "VALID");
        mr.setDisputeReason(conflict);
        mr.setPointsEarned(disputed ? 0 : points);   // no ranking points until an admin decides

        MatchResult saved = matchResultRepository.save(mr);

        if (disputed) {
            notificationService.create(NotificationService.ADMIN_USER_ID, "MATCH_DISPUTED",
                "Disputed Match Result",
                playerName + " submitted a result for " + booking.getCourtName() + " on " + booking.getBookingDate()
                    + " (" + booking.getTimeSlot() + ") that needs review: " + conflict);
            notificationService.create(playerID, "MATCH_DISPUTED", "Match Result Under Review",
                "Your result for " + booking.getCourtName() + " on " + booking.getBookingDate()
                    + " was marked as disputed (" + conflict + "). An admin will review it; "
                    + "ranking points are added once it is resolved.");
        } else {
            addRankPoints(playerID, points);
        }
        return saved;
    }

    /** Results waiting for an admin decision, oldest first. */
    public List<MatchResult> getDisputed() {
        return matchResultRepository.findByStatusOrderBySubmittedAtAsc("DISPUTED");
    }

    /** FR-38: an admin sets the final score and result of a disputed match; points are then awarded. */
    @Transactional
    public MatchResult resolveDispute(String matchID, int playerScore, int opponentScore, String result) {
        MatchResult mr = matchResultRepository.findById(matchID)
                .orElseThrow(() -> new NotFoundException("Match result not found"));
        if (!"DISPUTED".equals(mr.getStatus()))
            throw new ConflictException("This match result is not disputed.");

        String normalizedResult = result.toUpperCase();
        String conflict = conflictReason(playerScore, opponentScore, normalizedResult);
        if (conflict != null)
            throw new BusinessException("The final result must agree with the scores: " + conflict);

        int points = pointsFor(normalizedResult);
        mr.setPlayerScore(playerScore);
        mr.setOpponentScore(opponentScore);
        mr.setResult(normalizedResult);
        mr.setPointsEarned(points);
        mr.setStatus("RESOLVED");
        mr.setResolvedAt(java.time.LocalDateTime.now());
        MatchResult saved = matchResultRepository.save(mr);

        addRankPoints(mr.getPlayerID(), points);
        notificationService.create(mr.getPlayerID(), "MATCH_RESOLVED", "Match Result Resolved",
            "An admin reviewed your result for " + mr.getCourtName() + " on " + mr.getBookingDate()
                + ". Final result: " + normalizedResult + " " + playerScore + "-" + opponentScore
                + " (" + points + " ranking point" + (points == 1 ? "" : "s") + ").");
        return saved;
    }

    /** Null when the scores agree with the result, otherwise why they conflict. */
    static String conflictReason(int playerScore, int opponentScore, String result) {
        return switch (result) {
            case "WIN"  -> playerScore > opponentScore ? null
                : "a WIN was reported but the score is " + playerScore + "-" + opponentScore;
            case "LOSS" -> playerScore < opponentScore ? null
                : "a LOSS was reported but the score is " + playerScore + "-" + opponentScore;
            default     -> playerScore == opponentScore ? null
                : "a DRAW was reported but the score is " + playerScore + "-" + opponentScore;
        };
    }

    private static int pointsFor(String result) {
        return switch (result) {
            case "WIN"  -> 3;
            case "DRAW" -> 1;
            default     -> 0;
        };
    }

    private void addRankPoints(String playerID, int points) {
        if (points == 0) return;
        playerRepository.findById(playerID).ifPresent(p -> {
            p.setRankPoints(p.getRankPoints() + points);
            playerRepository.save(p);
        });
    }

    public List<MatchResult> getPlayerHistory(String playerID) {
        return matchResultRepository.findByPlayerIDOrderBySubmittedAtDesc(playerID);
    }

    public List<Map<String, Object>> getLeaderboard() {
        return playerRepository.findAllByOrderByRankPointsDesc().stream()
                .filter(p -> p.getRankPoints() > 0)
                .map(p -> {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("playerID",   p.getUserID());
                    entry.put("playerName", p.getName() != null ? p.getName() : "Unknown");
                    entry.put("rankPoints", p.getRankPoints());
                    return entry;
                })
                .collect(Collectors.toList());
    }

    public List<Map<String, Object>> getRankingsReport(String sportType, String dateFrom, String dateTo) {
        String sp  = (sportType != null && !sportType.isBlank()) ? sportType : null;
        String df  = (dateFrom  != null && !dateFrom.isBlank())  ? dateFrom  : null;
        String dt  = (dateTo    != null && !dateTo.isBlank())    ? dateTo    : null;

        List<MatchResult> matches = matchResultRepository.findWithFilters(sp, df, dt);

        // Aggregate per player
        Map<String, Map<String, Object>> byPlayer = new LinkedHashMap<>();
        for (MatchResult m : matches) {
            byPlayer.computeIfAbsent(m.getPlayerID(), k -> {
                Map<String, Object> s = new LinkedHashMap<>();
                s.put("playerID",   m.getPlayerID());
                s.put("playerName", m.getPlayerName() != null ? m.getPlayerName() : "Unknown");
                s.put("sportType",  m.getSportType()  != null ? m.getSportType()  : "—");
                s.put("wins",   0);
                s.put("losses", 0);
                s.put("draws",  0);
                s.put("matches", 0);
                s.put("points", 0);
                return s;
            });
            Map<String, Object> s = byPlayer.get(m.getPlayerID());
            s.put("matches", (int) s.get("matches") + 1);
            s.put("points",  (int) s.get("points")  + m.getPointsEarned());
            switch (m.getResult()) {
                case "WIN"  -> s.put("wins",   (int) s.get("wins")   + 1);
                case "LOSS" -> s.put("losses", (int) s.get("losses") + 1);
                case "DRAW" -> s.put("draws",  (int) s.get("draws")  + 1);
            }
        }

        // Sort by points desc, compute win-rate, assign rank
        List<Map<String, Object>> ranked = byPlayer.values().stream()
                .sorted((a, b) -> Integer.compare((int) b.get("points"), (int) a.get("points")))
                .collect(Collectors.toList());

        for (int i = 0; i < ranked.size(); i++) {
            Map<String, Object> s = ranked.get(i);
            int total = (int) s.get("matches");
            int wins  = (int) s.get("wins");
            double wr = total > 0 ? Math.round(wins * 1000.0 / total) / 10.0 : 0.0;
            s.put("winRate", wr);
            s.put("rank", i + 1);
        }
        return ranked;
    }

    public boolean isResultSubmitted(String bookingID) {
        return matchResultRepository.existsByBookingID(bookingID);
    }
}
