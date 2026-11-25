package com.scd.courtly.controller;

import com.scd.courtly.model.Player;
import com.scd.courtly.repository.CourtRepository;
import com.scd.courtly.support.IntegrationTest;
import com.scd.courtly.support.TestData;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("Facilities API  /api/facilities")
class FacilityControllerTest extends IntegrationTest {

    @Autowired CourtRepository courtRepository;

    private Map<String, Object> details(String name) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("location", "Liberty Market, Lahore");
        body.put("openingTime", "06:00");
        body.put("closingTime", "23:30");
        return body;
    }

    @Nested
    @DisplayName("Browsing (public)")
    class Browsing {

        @Test
        @DisplayName("GET / lists the seeded facilities with court counts and opening status")
        void list() throws Exception {
            mockMvc.perform(get("/api/facilities"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.facilityID=='FAC-001')].name", contains("Gulberg Sports Arena")))
                .andExpect(jsonPath("$[?(@.facilityID=='FAC-001')].managerName", contains("Imran Tariq")))
                .andExpect(jsonPath("$[?(@.facilityID=='FAC-001')].courtCount", contains(greaterThan(0))))
                .andExpect(jsonPath("$[?(@.facilityID=='FAC-001')].operatingStatus", contains(oneOf("OPEN", "CLOSED"))));
        }

        @Test
        @DisplayName("GET /{id} returns the facility and only its own courts")
        void detailsWithCourts() throws Exception {
            mockMvc.perform(get("/api/facilities/{id}", "FAC-001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.facility.facilityID").value("FAC-001"))
                .andExpect(jsonPath("$.courts", not(empty())))
                .andExpect(jsonPath("$.courts[*].managerId", everyItem(is(TestData.MANAGER_1_ID))))
                .andExpect(jsonPath("$.courts[*].facilityId", everyItem(is("FAC-001"))));
        }

        @Test
        @DisplayName("GET /{id} for an unknown facility → 404")
        void unknown() throws Exception {
            mockMvc.perform(get("/api/facilities/{id}", "FAC-NOPE")).andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("seeded courts are linked to their manager's facility at startup")
        void seededCourtsLinked() {
            assertThat(courtRepository.findById(TestData.TENNIS_COURT_1).orElseThrow().getFacilityId()).isEqualTo("FAC-001");
            assertThat(courtRepository.findById(TestData.TENNIS_COURT_2).orElseThrow().getFacilityId()).isEqualTo("FAC-002");
        }
    }

    @Nested
    @DisplayName("Managing a facility (FR-32)")
    class Managing {

        @Test
        @DisplayName("GET /mine returns the manager's facility")
        void mine() throws Exception {
            mockMvc.perform(get("/api/facilities/mine").header("Authorization", managerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.facilityID").value("FAC-001"));
        }

        @Test
        @DisplayName("a new manager gets a facility automatically, and their new courts belong to it")
        void newManager() throws Exception {
            Player m = newUser("MANAGER", "APPROVED");
            String body = mockMvc.perform(get("/api/facilities/mine").header("Authorization", tokenFor(m)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.managerId").value(m.getUserID()))
                .andExpect(jsonPath("$.courtCount").value(0))
                .andReturn().getResponse().getContentAsString();
            String facilityID = objectMapper.readTree(body).get("facilityID").asText();

            Map<String, Object> court = new LinkedHashMap<>();
            court.put("name", "Brand New Court");
            court.put("sportType", "TENNIS");
            court.put("hourlyRate", 900);
            mockMvc.perform(post("/api/courts").header("Authorization", tokenFor(m))
                    .contentType(MediaType.APPLICATION_JSON).content(json(court)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.facilityId").value(facilityID));
        }

        @Test
        @DisplayName("PUT /{id}: the manager updates name, location and hours")
        void update() throws Exception {
            mockMvc.perform(put("/api/facilities/{id}", "FAC-001").header("Authorization", managerToken())
                    .contentType(MediaType.APPLICATION_JSON).content(json(details("Imran's Arena"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Imran's Arena"))
                .andExpect(jsonPath("$.openingTime").value("06:00"))
                .andExpect(jsonPath("$.closingTime").value("23:30"));
        }

        @Test
        @DisplayName("PUT /{id}: another manager → 403; an admin may")
        void ownership() throws Exception {
            mockMvc.perform(put("/api/facilities/{id}", "FAC-001").header("Authorization", manager2Token())
                    .contentType(MediaType.APPLICATION_JSON).content(json(details("Hijacked"))))
                .andExpect(status().isForbidden());
            mockMvc.perform(put("/api/facilities/{id}", "FAC-001").header("Authorization", playerToken())
                    .contentType(MediaType.APPLICATION_JSON).content(json(details("Hijacked"))))
                .andExpect(status().isForbidden());
            mockMvc.perform(put("/api/facilities/{id}", "FAC-001").header("Authorization", adminToken())
                    .contentType(MediaType.APPLICATION_JSON).content(json(details("Admin Edit"))))
                .andExpect(status().isOk());
        }

        @Test
        @DisplayName("PUT /{id}: invalid times → 400")
        void validation() throws Exception {
            Map<String, Object> bad = details("Arena");
            bad.put("openingTime", "25:00");
            mockMvc.perform(put("/api/facilities/{id}", "FAC-001").header("Authorization", managerToken())
                    .contentType(MediaType.APPLICATION_JSON).content(json(bad)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.openingTime").exists());

            Map<String, Object> same = details("Arena");
            same.put("closingTime", "06:00");
            mockMvc.perform(put("/api/facilities/{id}", "FAC-001").header("Authorization", managerToken())
                    .contentType(MediaType.APPLICATION_JSON).content(json(same)))
                .andExpect(status().isBadRequest());
        }
    }
}
