package com.scd.courtly.security;

import com.scd.courtly.model.Player;
import com.scd.courtly.support.IntegrationTest;
import com.scd.courtly.support.TestData;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Who may call what: the role matrix enforced by SecurityConfig and @PreAuthorize. */
@DisplayName("Security: authentication and role-based access")
class SecurityAccessTest extends IntegrationTest {

    private static final String MANAGER_BOOKINGS = "/api/manager/bookings/upcoming?managerID=" + TestData.MANAGER_1_ID;

    @Nested
    @DisplayName("Public endpoints work without a token")
    class Public {

        @ParameterizedTest(name = "GET {0} → 200")
        @ValueSource(strings = {
            "/api/courts", "/api/courts/sport-types", "/api/courts/" + TestData.TENNIS_COURT_1,
            "/api/ratings/all", "/api/ratings/average/" + TestData.TENNIS_COURT_1,
            "/api/auth/oauth2/providers", "/actuator/health"})
        void anonymousAllowed(String url) throws Exception {
            mockMvc.perform(get(url)).andExpect(status().isOk());
        }
    }

    @Nested
    @DisplayName("Protected endpoints need a valid token")
    class Protected {

        @ParameterizedTest(name = "GET {0} without token → 401")
        @ValueSource(strings = {
            "/api/test", "/api/bookings/player/" + TestData.PLAYER_ID, "/api/notifications?userId=x",
            "/api/matches/leaderboard", "/api/admin/stats", MANAGER_BOOKINGS})
        void anonymousRejected(String url) throws Exception {
            mockMvc.perform(get(url))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.path").exists());
        }

        @Test
        @DisplayName("a valid token is accepted")
        void validToken() throws Exception {
            mockMvc.perform(get("/api/test").header("Authorization", playerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Success! Backend is connected."));
        }

        @Test
        @DisplayName("a malformed token → 401")
        void malformedToken() throws Exception {
            mockMvc.perform(get("/api/test").header("Authorization", "Bearer not.a.jwt"))
                .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("a token signed with another key → 401")
        void foreignToken() throws Exception {
            JwtService other = new JwtService();
            ReflectionTestUtils.setField(other, "secret", "some-other-secret-that-is-long-enough-1234");
            ReflectionTestUtils.setField(other, "expirationMs", 60_000L);
            String forged = other.generateToken(TestData.ADMIN_EMAIL, "ADMIN", "ADMIN");

            mockMvc.perform(get("/api/admin/stats").header("Authorization", "Bearer " + forged))
                .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("an expired token → 401")
        void expiredToken() throws Exception {
            JwtService expired = new JwtService();
            ReflectionTestUtils.setField(expired, "secret", "Courtly-Test-Secret-Key-That-Is-At-Least-32-Characters");
            ReflectionTestUtils.setField(expired, "expirationMs", -1_000L);

            mockMvc.perform(get("/api/test").header("Authorization",
                    "Bearer " + expired.generateToken(TestData.PLAYER_EMAIL, "PLAYER", TestData.PLAYER_ID)))
                .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("a token for a deleted account → 401")
        void deletedAccount() throws Exception {
            Player p = newPlayer();
            String token = tokenFor(p);
            playerRepository.delete(p);
            playerRepository.flush();

            mockMvc.perform(get("/api/test").header("Authorization", token)).andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("roles come from the database, not from the token's claims")
        void roleClaimIsNotTrusted() throws Exception {
            // A player's token that claims ADMIN still only gets the player's real role.
            String lying = bearer(TestData.PLAYER_EMAIL, "ADMIN", TestData.PLAYER_ID);
            mockMvc.perform(get("/api/admin/stats").header("Authorization", lying)).andExpect(status().isForbidden());
        }
    }

    @Nested
    @DisplayName("Role matrix")
    class Roles {

        @Test
        @DisplayName("player: own API yes, manager/admin API no")
        void player() throws Exception {
            mockMvc.perform(get("/api/matches/leaderboard").header("Authorization", playerToken())).andExpect(status().isOk());
            mockMvc.perform(get(MANAGER_BOOKINGS).header("Authorization", playerToken())).andExpect(status().isForbidden());
            mockMvc.perform(get("/api/admin/stats").header("Authorization", playerToken())).andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("manager: manager API yes, admin API no")
        void manager() throws Exception {
            mockMvc.perform(get(MANAGER_BOOKINGS).header("Authorization", managerToken())).andExpect(status().isOk());
            mockMvc.perform(get("/api/admin/stats").header("Authorization", managerToken())).andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("admin: everything")
        void admin() throws Exception {
            mockMvc.perform(get(MANAGER_BOOKINGS).header("Authorization", adminToken())).andExpect(status().isOk());
            mockMvc.perform(get("/api/admin/stats").header("Authorization", adminToken())).andExpect(status().isOk());
            mockMvc.perform(get("/api/matches/rankings").header("Authorization", adminToken())).andExpect(status().isOk());
        }
    }
}
