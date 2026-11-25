package com.scd.courtly.service;

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

        int points = switch (normalizedResult) {
            case "WIN"  -> 3;
            case "DRAW" -> 1;
            default     -> 0;
        };

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
        mr.setPointsEarned(points);

        MatchResult saved = matchResultRepository.save(mr);

        playerRepository.findById(playerID).ifPresent(p -> {
            p.setRankPoints(p.getRankPoints() + points);
            playerRepository.save(p);
        });

        return saved;
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
