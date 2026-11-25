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

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("Match results API  /api/matches")
class MatchResultControllerTest extends IntegrationTest {

    private Player player;
    private Booking booking;

    @BeforeEach
    void completedBooking() {
        player = newPlayer();
        booking = saveBooking(player.getUserID(), TestData.TENNIS_COURT_1, "2026-02-02", "10:00-11:00", "COMPLETED");
    }

    private ResultActions submit(String result) throws Exception {
        return mockMvc.perform(post("/api/matches/submit").header("Authorization", tokenFor(player))
            .contentType(MediaType.APPLICATION_JSON)
            .content(json(Map.of("bookingID", booking.getBookingID(), "playerID", player.getUserID(),
                "opponentName", "Rival", "playerScore", 6, "opponentScore", 3, "result", result))));
    }

    @Test
    @DisplayName("POST /submit: a win earns 3 rank points and shows on the leaderboard")
    void win() throws Exception {
        submit("win")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.result").value("WIN"))
            .andExpect(jsonPath("$.pointsEarned").value(3));

        assertThat(playerRepository.findById(player.getUserID()).orElseThrow().getRankPoints()).isEqualTo(3);
        mockMvc.perform(get("/api/matches/leaderboard").header("Authorization", playerToken()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[*].playerID", hasItem(player.getUserID())));
    }

    @Test
    @DisplayName("POST /submit twice for one booking → 400")
    void duplicate() throws Exception {
        submit("DRAW").andExpect(status().isOk());
        submit("WIN")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message", containsString("already been submitted")));
    }

    @Test
    @DisplayName("POST /submit with an invalid result → 400")
    void invalidResult() throws Exception {
        submit("TIE")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.fieldErrors.result").exists());
    }

    @Test
    @DisplayName("GET /player/{id} and /check/{bookingID} reflect the submission")
    void historyAndCheck() throws Exception {
        submit("LOSS").andExpect(status().isOk());

        mockMvc.perform(get("/api/matches/player/{id}", player.getUserID()).header("Authorization", tokenFor(player)))
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].pointsEarned").value(0));
        mockMvc.perform(get("/api/matches/check/{id}", booking.getBookingID()).header("Authorization", tokenFor(player)))
            .andExpect(jsonPath("$.submitted").value(true));
    }

    @Test
    @DisplayName("GET /rankings is admin-only")
    void rankings() throws Exception {
        submit("WIN").andExpect(status().isOk());

        mockMvc.perform(get("/api/matches/rankings").header("Authorization", tokenFor(player)))
            .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/matches/rankings").param("sportType", "TENNIS").header("Authorization", adminToken()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].rank").value(1))
            .andExpect(jsonPath("$[0].winRate").value(100.0));
    }

    private ResultActions submitScore(int playerScore, int opponentScore, String result) throws Exception {
        return mockMvc.perform(post("/api/matches/submit").header("Authorization", tokenFor(player))
            .contentType(MediaType.APPLICATION_JSON)
            .content(json(Map.of("bookingID", booking.getBookingID(), "playerID", player.getUserID(),
                "opponentName", "Rival", "playerScore", playerScore, "opponentScore", opponentScore,
                "result", result))));
    }

    @Test
    @DisplayName("FR-38: conflicting data is saved as DISPUTED; an admin resolves it and points are awarded")
    void disputeAndResolve() throws Exception {
        String body = submitScore(1, 4, "WIN")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("DISPUTED"))
            .andExpect(jsonPath("$.pointsEarned").value(0))
            .andReturn().getResponse().getContentAsString();
        String matchID = objectMapper.readTree(body).get("matchID").asText();
        assertThat(playerRepository.findById(player.getUserID()).orElseThrow().getRankPoints()).isZero();

        // Left out of the admin rankings report while disputed
        mockMvc.perform(get("/api/matches/rankings").header("Authorization", adminToken()))
            .andExpect(jsonPath("$[*].playerID", not(hasItem(player.getUserID()))));

        mockMvc.perform(get("/api/matches/disputed").header("Authorization", adminToken()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[*].matchID", hasItem(matchID)));

        mockMvc.perform(post("/api/matches/{id}/resolve", matchID).header("Authorization", adminToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("playerScore", 4, "opponentScore", 1, "result", "WIN"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("RESOLVED"))
            .andExpect(jsonPath("$.pointsEarned").value(3));

        assertThat(playerRepository.findById(player.getUserID()).orElseThrow().getRankPoints()).isEqualTo(3);
        mockMvc.perform(get("/api/matches/disputed").header("Authorization", adminToken()))
            .andExpect(jsonPath("$[*].matchID", not(hasItem(matchID))));
    }

    @Test
    @DisplayName("FR-38: only admins can list or resolve disputes")
    void disputesAdminOnly() throws Exception {
        mockMvc.perform(get("/api/matches/disputed").header("Authorization", tokenFor(player)))
            .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/matches/{id}/resolve", "any").header("Authorization", tokenFor(player))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("playerScore", 4, "opponentScore", 1, "result", "WIN"))))
            .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("negative scores → 400")
    void negativeScore() throws Exception {
        submitScore(-1, 2, "LOSS")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.fieldErrors.playerScore").exists());
    }

    @Test
    @DisplayName("ERD opponent_id / winner_id: a registered opponent (by username) is linked")
    void registeredOpponentLinked() throws Exception {
        Player rival = newPlayer();
        rival.setUsername("the_rival");
        playerRepository.saveAndFlush(rival);

        mockMvc.perform(post("/api/matches/submit").header("Authorization", tokenFor(player))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("bookingID", booking.getBookingID(), "playerID", player.getUserID(),
                    "opponentName", "The_Rival", "playerScore", 2, "opponentScore", 6, "result", "LOSS"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.opponentID").value(rival.getUserID()))
            .andExpect(jsonPath("$.winnerID").value(rival.getUserID()));
    }

    @Test
    @DisplayName("ERD winner_id: the submitter wins; an unregistered opponent stays unlinked")
    void unregisteredOpponent() throws Exception {
        submitScore(6, 1, "WIN")
            .andExpect(jsonPath("$.opponentID").doesNotExist())
            .andExpect(jsonPath("$.winnerID").value(player.getUserID()));
    }
}
