package com.scd.courtly.controller;

import com.scd.courtly.support.IntegrationTest;
import com.scd.courtly.support.TestData;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.time.LocalDateTime;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("Arena manager API  /api/manager")
class FacilityManagerControllerTest extends IntegrationTest {

    private ResultActions schedule(String courtID, Map<String, ?> body) throws Exception {
        return mockMvc.perform(post("/api/manager/courts/{id}/schedule-maintenance", courtID)
            .header("Authorization", managerToken())
            .contentType(MediaType.APPLICATION_JSON).content(json(body)));
    }

    @Nested
    @DisplayName("Bookings")
    class Bookings {

        @Test
        @DisplayName("GET /bookings/upcoming lists future bookings on the manager's courts")
        void upcoming() throws Exception {
            String date = TestData.futureWeekday(5).toString();
            saveBooking(newPlayer().getUserID(), TestData.TENNIS_COURT_1, date, "10:00-11:00", "PENDING"); // MGR001
            saveBooking(newPlayer().getUserID(), TestData.TENNIS_COURT_2, date, "10:00-11:00", "PENDING"); // MGR002

            mockMvc.perform(get("/api/manager/bookings/upcoming").param("managerID", TestData.MANAGER_1_ID)
                    .header("Authorization", managerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].courtName", startsWith("Test Court " + TestData.TENNIS_COURT_1)));
        }

        @Test
        @DisplayName("GET /bookings/completed lists completed bookings from the seed data")
        void completed() throws Exception {
            mockMvc.perform(get("/api/manager/bookings/completed").param("managerID", TestData.MANAGER_1_ID)
                    .header("Authorization", managerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(empty())))
                .andExpect(jsonPath("$[*].status", everyItem(is("COMPLETED"))));
        }

        @Test
        @DisplayName("players cannot use the manager API → 403")
        void playerForbidden() throws Exception {
            mockMvc.perform(get("/api/manager/bookings/upcoming").param("managerID", TestData.MANAGER_1_ID)
                    .header("Authorization", playerToken()))
                .andExpect(status().isForbidden());
        }
    }

    @Nested
    @DisplayName("Maintenance")
    class Maintenance {

        private final String from = LocalDateTime.now().plusDays(3).withNano(0).withSecond(0).toString();
        private final String to   = LocalDateTime.now().plusDays(3).plusHours(2).withNano(0).withSecond(0).toString();

        @Test
        @DisplayName("schedule → listed → cancel")
        void scheduleListCancel() throws Exception {
            schedule(TestData.TENNIS_COURT_1, Map.of("maintenanceFrom", from, "maintenanceTo", to))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.courtID").value(TestData.TENNIS_COURT_1))
                .andExpect(jsonPath("$.maintenanceFrom").value(from));

            mockMvc.perform(get("/api/manager/courts/maintenances").param("managerID", TestData.MANAGER_1_ID)
                    .header("Authorization", managerToken()))
                .andExpect(jsonPath("$[*].courtID", hasItem(TestData.TENNIS_COURT_1)));

            mockMvc.perform(delete("/api/manager/courts/{id}/schedule-maintenance", TestData.TENNIS_COURT_1)
                    .header("Authorization", managerToken()))
                .andExpect(status().isOk());

            mockMvc.perform(get("/api/manager/courts/maintenances").param("managerID", TestData.MANAGER_1_ID)
                    .header("Authorization", managerToken()))
                .andExpect(jsonPath("$[*].courtID", not(hasItem(TestData.TENNIS_COURT_1))));
        }

        @Test
        @DisplayName("scheduled maintenance blocks the overlapping booking slots")
        void blocksSlots() throws Exception {
            LocalDateTime start = TestData.futureWeekday(4).atTime(12, 0);
            schedule(TestData.TENNIS_COURT_1, Map.of("maintenanceFrom", start.toString(),
                    "maintenanceTo", start.plusHours(1).toString()))
                .andExpect(status().isOk());

            mockMvc.perform(get("/api/bookings/court/{id}", TestData.TENNIS_COURT_1)
                    .param("date", start.toLocalDate().toString()))
                .andExpect(jsonPath("$[?(@.timeSlot == '12:00-13:00')].available").value(contains(false)))
                .andExpect(jsonPath("$[?(@.timeSlot == '13:00-14:00')].available").value(contains(true)));
        }

        @Test
        @DisplayName("start time in the past → 400")
        void pastStart() throws Exception {
            schedule(TestData.TENNIS_COURT_1, Map.of("maintenanceFrom", "2020-01-01T10:00"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("future")));
        }

        @Test
        @DisplayName("invalid date-time format → 400")
        void badFormat() throws Exception {
            schedule(TestData.TENNIS_COURT_1, Map.of("maintenanceFrom", "next tuesday"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("ISO-8601")));
        }

        @Test
        @DisplayName("missing start time → 400")
        void missingStart() throws Exception {
            schedule(TestData.TENNIS_COURT_1, Map.of("maintenanceTo", to))
                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("unknown court → 404")
        void unknownCourt() throws Exception {
            schedule("NOPE", Map.of("maintenanceFrom", from)).andExpect(status().isNotFound());
            mockMvc.perform(delete("/api/manager/courts/{id}/schedule-maintenance", "NOPE")
                    .header("Authorization", managerToken()))
                .andExpect(status().isNotFound());
        }
    }
}
