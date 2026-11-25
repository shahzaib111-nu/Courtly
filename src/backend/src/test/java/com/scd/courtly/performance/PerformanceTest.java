package com.scd.courtly.performance;

import com.scd.courtly.support.IntegrationTest;
import com.scd.courtly.support.TestData;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.RequestBuilder;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Performance requirements (NFR 1.1-1.3) measured on a large dataset:
 * 50,000 bookings over the past year (NFR 1.2.2) and 5,000 match results (NFR 1.3.2).
 * Each request must finish within the limit the spec sets. The data is rolled back afterwards.
 *
 * Run alone with:  ./mvnw test -Dgroups=performance
 */
@Tag("performance")
@DisplayName("Performance on 50,000 bookings (NFR 1.1-1.3)")
class PerformanceTest extends IntegrationTest {

    private static final int BOOKINGS = 50_000;
    private static final int MATCH_RESULTS = 5_000;

    @Autowired JdbcTemplate jdbc;

    private static final String[] PLAYERS = {"PLR001", "PLR002", "PLR003", "PLR004", "PLR005", "PLR006", "PLR007", "PLR008"};
    private static final String[] STATUSES = {"COMPLETED", "COMPLETED", "COMPLETED", "CONFIRMED", "CANCELLED"};

    private void seed() {
        List<Map<String, Object>> courts = jdbc.queryForList("SELECT courtid, name, sport_type, hourly_rate FROM courts");
        LocalDate today = LocalDate.now();
        List<Object[]> bookings = new ArrayList<>(BOOKINGS);
        int n = 0;
        outer:
        for (int day = -365; day <= 14; day++) {
            LocalDate date = today.plusDays(day);
            for (int hour = 7; hour < 22; hour++) {
                for (Map<String, Object> c : courts) {
                    if (n >= BOOKINGS) break outer;
                    if (day >= 0) continue;   // keep future slots free so availability searches have work to do
                    String status = STATUSES[n % STATUSES.length];
                    LocalDateTime created = date.atTime(hour, 0).minusDays(2);
                    double rate = ((Number) c.get("HOURLY_RATE")).doubleValue();
                    bookings.add(new Object[]{"PERF-" + n, PLAYERS[n % PLAYERS.length], c.get("COURTID"), c.get("NAME"),
                        c.get("SPORT_TYPE"), date.toString(), String.format("%02d:00-%02d:00", hour, hour + 1),
                        rate, rate, 0.0, false, status, Timestamp.valueOf(created),
                        "CANCELLED".equals(status) ? null : Timestamp.valueOf(created.plusMinutes(5))});
                    n++;
                }
            }
        }
        jdbc.batchUpdate("INSERT INTO bookings (bookingid, playerid, courtid, court_name, sport_type, booking_date, "
            + "time_slot, base_rate, total_cost, discount_applied, peak_hour, status, created_at, confirmed_at) "
            + "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", bookings);

        List<Object[]> matches = new ArrayList<>(MATCH_RESULTS);
        String[] results = {"WIN", "LOSS", "DRAW"};
        for (int i = 0; i < MATCH_RESULTS; i++) {
            Object[] b = bookings.get(i * 7);
            String r = results[i % 3];
            int ps = r.equals("WIN") ? 6 : r.equals("LOSS") ? 2 : 3, os = r.equals("WIN") ? 2 : r.equals("LOSS") ? 6 : 3;
            matches.add(new Object[]{"PERF-M-" + i, b[0], b[1], "Perf Player", b[3], b[4], b[5], b[6], "Rival",
                ps, os, r, r.equals("WIN") ? 3 : r.equals("DRAW") ? 1 : 0, "VALID", Timestamp.valueOf(LocalDateTime.now())});
        }
        jdbc.batchUpdate("INSERT INTO match_results (matchid, bookingid, playerid, player_name, court_name, sport_type, "
            + "booking_date, time_slot, opponent_name, player_score, opponent_score, result, points_earned, status, submitted_at) "
            + "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", matches);
    }

    /** Runs the request (after one warm-up call) and returns its time in milliseconds. */
    private long timed(RequestBuilder request) throws Exception {
        mockMvc.perform(request).andExpect(status().isOk());              // warm-up (JIT, caches)
        long start = System.nanoTime();
        mockMvc.perform(request).andExpect(status().isOk());
        return (System.nanoTime() - start) / 1_000_000;
    }

    @Test
    @DisplayName("search, calendar and report requests stay within the NFR limits")
    void withinLimits() throws Exception {
        long seedStart = System.nanoTime();
        seed();
        long seedMs = (System.nanoTime() - seedStart) / 1_000_000;
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM bookings", Long.class)).isGreaterThanOrEqualTo(BOOKINGS);

        String today = LocalDate.now().toString();
        String yearAgo = LocalDate.now().minusYears(1).toString();
        String nextWeek = TestData.futureWeekday(7).toString();

        record Check(String name, String nfr, long limitMs, RequestBuilder request) {}
        List<Check> checks = List.of(
            new Check("Calendar: slots for a date + sport", "1.1.2 / 1.2.1", 3_000,
                get("/api/bookings/availability").param("date", nextWeek).param("type", "TENNIS")),
            new Check("Calendar: another sport filter", "1.1.2 / 1.2.1", 3_000,
                get("/api/bookings/availability").param("date", nextWeek).param("type", "FOOTBALL")),
            new Check("Search: a player's bookings (~6,000 rows)", "1.2.2", 4_000,
                get("/api/bookings/player/{id}", TestData.PLAYER_ID).header("Authorization", playerToken())),
            new Check("Search: manager's upcoming bookings", "1.2.2", 4_000,
                get("/api/manager/bookings/upcoming").param("managerID", TestData.MANAGER_1_ID)
                    .header("Authorization", managerToken())),
            new Check("Report: court utilization, 1 year", "1.3.1", 6_000,
                get("/api/admin/reports").param("type", "COURT_UTILIZATION").param("startDate", yearAgo)
                    .param("endDate", today).header("Authorization", adminToken())),
            new Check("Report: revenue summary, 1 year", "1.3.1", 6_000,
                get("/api/admin/reports").param("type", "REVENUE_SUMMARY").param("startDate", yearAgo)
                    .param("endDate", today).header("Authorization", adminToken())),
            new Check("Report: user demographics, 1 year", "1.3.1", 6_000,
                get("/api/admin/reports").param("type", "USER_DEMOGRAPHICS").param("startDate", yearAgo)
                    .param("endDate", today).header("Authorization", adminToken())),
            new Check("Export data: payment history, 1 year", "1.3.2", 5_000,
                get("/api/admin/payment-history").param("from", yearAgo).param("to", today)
                    .header("Authorization", adminToken())),
            new Check("Export data: rankings over 5,000 results", "1.3.2", 5_000,
                get("/api/matches/rankings").header("Authorization", adminToken()))
        );

        Map<String, Long> times = new LinkedHashMap<>();
        StringBuilder table = new StringBuilder("\n  Seeded " + BOOKINGS + " bookings + " + MATCH_RESULTS
            + " match results in " + seedMs + " ms\n");
        table.append(String.format("  %-45s %-14s %8s %8s%n", "Request", "NFR", "Time", "Limit"));
        for (Check c : checks) {
            long ms = timed(c.request());
            times.put(c.name(), ms);
            table.append(String.format("  %-45s %-14s %6d ms %6d ms %s%n", c.name(), c.nfr(), ms, c.limitMs(),
                ms <= c.limitMs() ? "OK" : "TOO SLOW"));
        }
        System.out.println(table);

        for (Check c : checks) {
            assertThat(times.get(c.name())).as(c.name() + " (NFR " + c.nfr() + ")").isLessThanOrEqualTo(c.limitMs());
        }
    }
}
