package com.scd.courtly.controller;

import com.scd.courtly.model.Player;
import com.scd.courtly.support.IntegrationTest;
import com.scd.courtly.support.TestData;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("Courts API  /api/courts")
class CourtControllerTest extends IntegrationTest {

    private static final Map<String, Object> NEW_COURT = Map.of(
        "name", "Test Padel Court", "sportType", "TENNIS", "hourlyRate", 900, "capacity", 4);

    @Nested
    @DisplayName("Browsing (public)")
    class Browsing {

        @Test
        @DisplayName("GET / lists all seeded courts")
        void all() throws Exception {
            mockMvc.perform(get("/api/courts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(TestData.SEEDED_COURTS)));
        }

        @Test
        @DisplayName("GET /{id} returns one court")
        void byId() throws Exception {
            mockMvc.perform(get("/api/courts/{id}", TestData.TENNIS_COURT_1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Gulberg Tennis Court"))
                .andExpect(jsonPath("$.managerId").value(TestData.MANAGER_1_ID));
        }

        @Test
        @DisplayName("GET /{id} for an unknown court → 404")
        void unknown() throws Exception {
            mockMvc.perform(get("/api/courts/{id}", "NOPE")).andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("GET /by-sport is case-insensitive")
        void bySport() throws Exception {
            mockMvc.perform(get("/api/courts/by-sport").param("type", "tennis"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[*].sportType", everyItem(is("TENNIS"))));
        }

        @Test
        @DisplayName("GET /available lists AVAILABLE courts")
        void available() throws Exception {
            mockMvc.perform(get("/api/courts/available"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].status", everyItem(is("AVAILABLE"))));
        }

        @Test
        @DisplayName("GET /{id}/slots lists the court's hourly slots (07:00-22:00 = 15)")
        void slots() throws Exception {
            mockMvc.perform(get("/api/courts/{id}/slots", TestData.TENNIS_COURT_1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(15)))
                .andExpect(jsonPath("$[0].startTime").value("07:00"));
        }

        @Test
        @DisplayName("GET /sport-types lists the 8 supported sports")
        void sportTypes() throws Exception {
            mockMvc.perform(get("/api/courts/sport-types"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(TestData.SPORT_TYPES)));
        }
    }

    @Nested
    @DisplayName("Managing courts (manager / admin)")
    class Managing {

        @Test
        @DisplayName("POST / creates a court with sensible defaults")
        void create() throws Exception {
            mockMvc.perform(post("/api/courts").header("Authorization", managerToken())
                    .contentType(MediaType.APPLICATION_JSON).content(json(NEW_COURT)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.courtID").isNotEmpty())
                .andExpect(jsonPath("$.status").value("AVAILABLE"))
                .andExpect(jsonPath("$.slotDurationMinutes").value(60))
                .andExpect(jsonPath("$.peakMultiplier").value(1.0));
        }

        @Test
        @DisplayName("POST / as a player → 403")
        void createAsPlayer() throws Exception {
            mockMvc.perform(post("/api/courts").header("Authorization", playerToken())
                    .contentType(MediaType.APPLICATION_JSON).content(json(NEW_COURT)))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("POST / without a token → 401")
        void createAnonymous() throws Exception {
            mockMvc.perform(post("/api/courts").contentType(MediaType.APPLICATION_JSON).content(json(NEW_COURT)))
                .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("PUT /{id} updates an existing court")
        void update() throws Exception {
            String body = mockMvc.perform(get("/api/courts/{id}", TestData.TENNIS_COURT_1))
                .andReturn().getResponse().getContentAsString();
            Map<String, Object> court = objectMapper.readValue(body, Map.class);
            court.put("hourlyRate", 1999);

            mockMvc.perform(put("/api/courts/{id}", TestData.TENNIS_COURT_1).header("Authorization", adminToken())
                    .contentType(MediaType.APPLICATION_JSON).content(json(court)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hourlyRate").value(1999.0));
        }

        @Test
        @DisplayName("PUT /{id} for an unknown court → 404")
        void updateUnknown() throws Exception {
            mockMvc.perform(put("/api/courts/{id}", "NOPE").header("Authorization", adminToken())
                    .contentType(MediaType.APPLICATION_JSON).content(json(NEW_COURT)))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("DELETE /{id} removes the court")
        void remove() throws Exception {
            mockMvc.perform(delete("/api/courts/{id}", TestData.TENNIS_COURT_2).header("Authorization", adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(true));
            mockMvc.perform(get("/api/courts/{id}", TestData.TENNIS_COURT_2)).andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("FR-34: DELETE /{id} with an upcoming booking → 409 with a warning; the court stays")
        void removeWithFutureBookings() throws Exception {
            Player p = newPlayer();
            saveBooking(p.getUserID(), TestData.TENNIS_COURT_2, TestData.futureWeekday(3).toString(),
                "10:00-11:00", "CONFIRMED");

            mockMvc.perform(delete("/api/courts/{id}", TestData.TENNIS_COURT_2).header("Authorization", adminToken()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("1 upcoming booking")));
            mockMvc.perform(get("/api/courts/{id}", TestData.TENNIS_COURT_2)).andExpect(status().isOk());
        }

        @Test
        @DisplayName("FR-34: past and cancelled bookings do not block removal")
        void pastBookingsDoNotBlock() throws Exception {
            Player p = newPlayer();
            saveBooking(p.getUserID(), TestData.TENNIS_COURT_2, "2026-01-05", "10:00-11:00", "CONFIRMED");
            saveBooking(p.getUserID(), TestData.TENNIS_COURT_2, TestData.futureWeekday(3).toString(),
                "11:00-12:00", "CANCELLED");

            mockMvc.perform(delete("/api/courts/{id}", TestData.TENNIS_COURT_2).header("Authorization", adminToken()))
                .andExpect(status().isOk());
        }

        @Test
        @DisplayName("DELETE /{id} for an unknown court → 404")
        void removeUnknown() throws Exception {
            mockMvc.perform(delete("/api/courts/{id}", "NOPE").header("Authorization", adminToken()))
                .andExpect(status().isNotFound());
        }
    }

}
