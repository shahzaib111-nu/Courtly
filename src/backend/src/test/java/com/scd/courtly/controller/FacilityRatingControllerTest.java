package com.scd.courtly.controller;

import com.scd.courtly.model.Booking;
import com.scd.courtly.model.Player;
import com.scd.courtly.support.IntegrationTest;
import com.scd.courtly.support.TestData;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("Facility ratings API  /api/ratings")
class FacilityRatingControllerTest extends IntegrationTest {

    private Player player;
    private Booking booking;

    @BeforeEach
    void completedBooking() {
        player = newPlayer();
        booking = saveBooking(player.getUserID(), TestData.TENNIS_COURT_1, "2026-02-02", "10:00-11:00", "COMPLETED");
    }

    private ResultActions rate(String token, String playerID, int score) throws Exception {
        return mockMvc.perform(post("/api/ratings/submit").header("Authorization", token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(json(Map.of("bookingID", booking.getBookingID(), "playerID", playerID,
                "ratingScore", score, "feedbackText", "Nice"))));
    }

    @Test
    @DisplayName("POST /submit stores the rating and /check reports it")
    void submitAndCheck() throws Exception {
        mockMvc.perform(get("/api/ratings/check/{id}", booking.getBookingID()).header("Authorization", tokenFor(player)))
            .andExpect(jsonPath("$.submitted").value(false));

        rate(tokenFor(player), player.getUserID(), 4)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ratingScore").value(4))
            .andExpect(jsonPath("$.courtID").value(TestData.TENNIS_COURT_1));

        mockMvc.perform(get("/api/ratings/check/{id}", booking.getBookingID()).header("Authorization", tokenFor(player)))
            .andExpect(jsonPath("$.submitted").value(true));
    }

    @Test
    @DisplayName("POST /submit twice for one booking → 400")
    void duplicate() throws Exception {
        rate(tokenFor(player), player.getUserID(), 4).andExpect(status().isOk());
        rate(tokenFor(player), player.getUserID(), 5)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message", containsString("already rated")));
    }

    @Test
    @DisplayName("POST /submit with a score outside 1-5 → 400")
    void outOfRange() throws Exception {
        rate(tokenFor(player), player.getUserID(), 6)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.fieldErrors.ratingScore").exists());
    }

    @Test
    @DisplayName("POST /submit for someone else's booking → 400")
    void notOwner() throws Exception {
        rate(playerToken(), TestData.PLAYER_ID, 4)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("You can only rate your own bookings"));
    }

    @Test
    @DisplayName("GET /player/{id} lists the player's ratings")
    void playerRatings() throws Exception {
        rate(tokenFor(player), player.getUserID(), 3).andExpect(status().isOk());
        mockMvc.perform(get("/api/ratings/player/{id}", player.getUserID()).header("Authorization", tokenFor(player)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    @DisplayName("GET /average/{courtID} and /all are public")
    void publicEndpoints() throws Exception {
        mockMvc.perform(get("/api/ratings/average/{id}", TestData.TENNIS_COURT_1))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.average", both(greaterThanOrEqualTo(0.0)).and(lessThanOrEqualTo(5.0))));
        mockMvc.perform(get("/api/ratings/all"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(10))));
    }
}
