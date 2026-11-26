package com.scd.courtly.controller;

import com.scd.courtly.model.Player;
import com.scd.courtly.repository.NotificationRepository;
import com.scd.courtly.support.IntegrationTest;
import com.scd.courtly.support.TestData;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("Auth API  /api/auth")
class AuthControllerTest extends IntegrationTest {

    @Autowired NotificationRepository notificationRepository;

    private ResultActions login(String email, String password, String role) throws Exception {
        return mockMvc.perform(post("/api/auth/login")
            .param("email", email).param("pass", password).param("role", role));
    }

    private Map<String, Object> registration(String email, String role) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", "New User");
        body.put("email", email);
        body.put("password", "Secret123");
        body.put("phone", "+92 300 0000000");
        body.put("dateOfBirth", "2000-01-01");
        body.put("role", role);
        return body;
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("POST /register")
    class Register {

        @Test
        @DisplayName("creates an active player and notifies the admin")
        void player() throws Exception {
            mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                    .content(json(registration("new.player@test.local", "PLAYER"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userID", startsWith("U-")))
                .andExpect(jsonPath("$.role").value("PLAYER"))
                .andExpect(jsonPath("$.accountStatus").value("Active"));

            assertThat(notificationRepository.findByUserIdOrderByCreatedAtDesc("ADMIN"))
                .anyMatch(n -> n.getMessage().contains("new.player@test.local"));
        }

        @Test
        @DisplayName("arena managers wait for admin approval")
        void manager() throws Exception {
            mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                    .content(json(registration("new.manager@test.local", "MANAGER"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("MANAGER"))
                .andExpect(jsonPath("$.accountStatus").value("PENDING_APPROVAL"));
        }

        @Test
        @DisplayName("duplicate email → 409")
        void duplicate() throws Exception {
            mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                    .content(json(registration(TestData.PLAYER_EMAIL, "PLAYER"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("Email already in use")));
        }

        @Test
        @DisplayName("invalid fields → 400 with per-field errors")
        void validation() throws Exception {
            Map<String, Object> body = registration("not-an-email", "PLAYER");
            body.put("password", "short");
            body.remove("name");

            mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(json(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.email").exists())
                .andExpect(jsonPath("$.fieldErrors.password").exists())
                .andExpect(jsonPath("$.fieldErrors.name").exists());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("POST /login")
    class Login {

        @Test
        @DisplayName("seeded player signs in and receives a working JWT")
        void player() throws Exception {
            String body = login(TestData.PLAYER_EMAIL, TestData.DEMO_PASSWORD, "PLAYER")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.playerID").value(TestData.PLAYER_ID))
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andReturn().getResponse().getContentAsString();

            String token = objectMapper.readTree(body).get("token").asText();
            mockMvc.perform(get("/api/auth/profile").param("email", TestData.PLAYER_EMAIL)
                    .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        }

        @Test
        @DisplayName("manager login reports the approval status")
        void manager() throws Exception {
            login(TestData.MANAGER_1_EMAIL, TestData.DEMO_PASSWORD, "MANAGER")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("MANAGER"))
                .andExpect(jsonPath("$.accountStatus").value("APPROVED"));
        }

        @Test
        @DisplayName("admin signs in with the admin role")
        void admin() throws Exception {
            login(TestData.ADMIN_EMAIL, TestData.ADMIN_PASSWORD, "")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ADMIN"));
        }

        @Test
        @DisplayName("wrong password → 401")
        void wrongPassword() throws Exception {
            login(TestData.PLAYER_EMAIL, "WrongPass1", "PLAYER")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Incorrect email or password"));
        }

        @Test
        @DisplayName("unknown email → 401")
        void unknownEmail() throws Exception {
            login("nobody@test.local", "Whatever1", "PLAYER")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("No account found with that email address or username"));
        }

        @Test
        @DisplayName("wrong role tab → 401")
        void wrongRole() throws Exception {
            login(TestData.PLAYER_EMAIL, TestData.DEMO_PASSWORD, "MANAGER")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Incorrect account role"));
        }

        @Test
        @DisplayName("missing parameter → 400")
        void missingParam() throws Exception {
            mockMvc.perform(post("/api/auth/login").param("email", TestData.PLAYER_EMAIL))
                .andExpect(status().isBadRequest());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Profile and account")
    class Profile {

        @Test
        @DisplayName("GET /profile returns the player's details")
        void profile() throws Exception {
            mockMvc.perform(get("/api/auth/profile").param("email", TestData.PLAYER_EMAIL)
                    .header("Authorization", playerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Hamza Raza"))
                .andExpect(jsonPath("$.authProvider").value("LOCAL"))
                .andExpect(jsonPath("$.hasPassword").value(true));
        }

        @Test
        @DisplayName("GET /profile without a token → 401")
        void profileAnonymous() throws Exception {
            mockMvc.perform(get("/api/auth/profile").param("email", TestData.PLAYER_EMAIL))
                .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("GET /profile of another user → 403 (doesn't reveal whether the email exists)")
        void profileOfOtherUser() throws Exception {
            mockMvc.perform(get("/api/auth/profile").param("email", TestData.PLAYER_2_EMAIL)
                    .header("Authorization", playerToken()))
                .andExpect(status().isForbidden());
            mockMvc.perform(get("/api/auth/profile").param("email", "ghost@test.local")
                    .header("Authorization", playerToken()))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("GET /profile for an unknown email as admin → 404")
        void profileUnknown() throws Exception {
            mockMvc.perform(get("/api/auth/profile").param("email", "ghost@test.local")
                    .header("Authorization", adminToken()))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("GET /account-status returns the status")
        void accountStatus() throws Exception {
            mockMvc.perform(get("/api/auth/account-status").param("playerID", TestData.MANAGER_1_ID)
                    .header("Authorization", managerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountStatus").value("APPROVED"));
        }

        @Test
        @DisplayName("POST /request-deletion blocks future logins")
        void requestDeletion() throws Exception {
            Player p = newPlayer();
            mockMvc.perform(post("/api/auth/request-deletion").param("playerEmail", p.getEmail())
                    .header("Authorization", tokenFor(p)))
                .andExpect(status().isOk());

            login(p.getEmail(), TestData.DEMO_PASSWORD, "PLAYER")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("This account is pending deletion"));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Forgot password (OTP)")
    class ForgotPassword {

        @Test
        @DisplayName("full flow: request OTP → verify → reset → login with new password")
        void fullFlow() throws Exception {
            Player p = newPlayer();

            mockMvc.perform(post("/api/auth/forgot-password").contentType(MediaType.APPLICATION_JSON)
                    .content(json(Map.of("email", p.getEmail()))))
                .andExpect(status().isOk());
            verify(emailService).sendOtpEmail(eq(p.getEmail()), anyString());
            String otp = playerRepository.findByEmail(p.getEmail()).orElseThrow().getOtpCode();
            assertThat(otp).matches("\\d{6}");

            mockMvc.perform(post("/api/auth/verify-otp").contentType(MediaType.APPLICATION_JSON)
                    .content(json(Map.of("email", p.getEmail(), "otp", otp))))
                .andExpect(status().isOk());

            mockMvc.perform(put("/api/auth/reset-password-otp").contentType(MediaType.APPLICATION_JSON)
                    .content(json(Map.of("email", p.getEmail(), "otp", otp, "newPassword", "BrandNew123"))))
                .andExpect(status().isOk());

            login(p.getEmail(), "BrandNew123", "PLAYER").andExpect(status().isOk());
            assertThat(playerRepository.findByEmail(p.getEmail()).orElseThrow().getOtpCode()).isNull();
        }

        @Test
        @DisplayName("wrong OTP → 400")
        void wrongOtp() throws Exception {
            Player p = newPlayer();
            p.setOtpCode("123456");
            p.setOtpExpiry(new java.util.Date(System.currentTimeMillis() + 600_000));
            playerRepository.saveAndFlush(p);

            mockMvc.perform(post("/api/auth/verify-otp").contentType(MediaType.APPLICATION_JSON)
                    .content(json(Map.of("email", p.getEmail(), "otp", "654321"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("Invalid OTP")));
        }

        @Test
        @DisplayName("expired OTP → 400")
        void expiredOtp() throws Exception {
            Player p = newPlayer();
            p.setOtpCode("123456");
            p.setOtpExpiry(new java.util.Date(System.currentTimeMillis() - 1_000));
            playerRepository.saveAndFlush(p);

            mockMvc.perform(post("/api/auth/verify-otp").contentType(MediaType.APPLICATION_JSON)
                    .content(json(Map.of("email", p.getEmail(), "otp", "123456"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("expired")));
        }

        @Test
        @DisplayName("unknown email → 404")
        void unknownEmail() throws Exception {
            mockMvc.perform(post("/api/auth/forgot-password").contentType(MediaType.APPLICATION_JSON)
                    .content(json(Map.of("email", "ghost@test.local"))))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("e-mail delivery failure → 500 and the OTP is discarded")
        void emailFails() throws Exception {
            Player p = newPlayer();
            when(emailService.sendOtpEmail(anyString(), anyString())).thenReturn(false);

            mockMvc.perform(post("/api/auth/forgot-password").contentType(MediaType.APPLICATION_JSON)
                    .content(json(Map.of("email", p.getEmail()))))
                .andExpect(status().isInternalServerError());
            assertThat(playerRepository.findByEmail(p.getEmail()).orElseThrow().getOtpCode()).isNull();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("PUT /change-password")
    class ChangePassword {

        private ResultActions change(String token, String email, String current, String next) throws Exception {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("email", email);
            if (current != null) body.put("currentPassword", current);
            body.put("newPassword", next);
            return mockMvc.perform(put("/api/auth/change-password").header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON).content(json(body)));
        }

        @Test
        @DisplayName("correct current password → changed")
        void success() throws Exception {
            Player p = newPlayer();
            change(tokenFor(p), p.getEmail(), TestData.DEMO_PASSWORD, "Changed123").andExpect(status().isOk());
            login(p.getEmail(), "Changed123", "PLAYER").andExpect(status().isOk());
        }

        @Test
        @DisplayName("wrong or missing current password → 401")
        void wrongCurrent() throws Exception {
            Player p = newPlayer();
            change(tokenFor(p), p.getEmail(), "WrongPass1", "Changed123").andExpect(status().isUnauthorized());
            change(tokenFor(p), p.getEmail(), null, "Changed123").andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("Google/GitHub account without a password can set its first one")
        void setFirstPassword() throws Exception {
            Player p = newPlayer();
            p.setPasswordHash(null);
            p.setAuthProvider("GOOGLE");
            p.setProviderId("google-sub-1");
            playerRepository.saveAndFlush(p);

            mockMvc.perform(get("/api/auth/profile").param("email", p.getEmail()).header("Authorization", tokenFor(p)))
                .andExpect(jsonPath("$.authProvider").value("GOOGLE"))
                .andExpect(jsonPath("$.hasPassword").value(false));

            change(tokenFor(p), p.getEmail(), null, "FirstPass123").andExpect(status().isOk());
            login(p.getEmail(), "FirstPass123", "PLAYER").andExpect(status().isOk());
        }

        @Test
        @DisplayName("cannot change another user's password → 403")
        void otherUser() throws Exception {
            Player victim = newPlayer();
            change(playerToken(), victim.getEmail(), null, "Hijacked123").andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("new password shorter than 8 characters → 400")
        void tooShort() throws Exception {
            Player p = newPlayer();
            change(tokenFor(p), p.getEmail(), TestData.DEMO_PASSWORD, "short").andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("NFR 2.1.1: a new password without digits or without letters → 400")
        void notAlphanumeric() throws Exception {
            Player p = newPlayer();
            change(tokenFor(p), p.getEmail(), TestData.DEMO_PASSWORD, "onlyletters").andExpect(status().isBadRequest());
            change(tokenFor(p), p.getEmail(), TestData.DEMO_PASSWORD, "12345678").andExpect(status().isBadRequest());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Password policy (NFR 2.1.1)")
    class PasswordPolicy {

        @Test
        @DisplayName("registration requires letters and numbers")
        void registrationRequiresAlphanumeric() throws Exception {
            for (String weak : new String[]{"password", "12345678", "Ab1"}) {
                Map<String, Object> body = registration("weak@test.local", "PLAYER");
                body.put("password", weak);
                mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(json(body)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.fieldErrors.password", containsString("letters and numbers")));
            }
        }

        @Test
        @DisplayName("an OTP reset also enforces the policy")
        void otpResetEnforcesPolicy() throws Exception {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("email", TestData.PLAYER_EMAIL);
            body.put("otp", "123456");
            body.put("newPassword", "abcdefgh");
            mockMvc.perform(put("/api/auth/reset-password-otp").contentType(MediaType.APPLICATION_JSON).content(json(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.newPassword").exists());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Account lockout (NFR 2.1.2)")
    class Lockout {

        @Test
        @DisplayName("5 wrong passwords → 423 Locked; even the right password is refused for 10 minutes")
        void locksAfterFiveFailures() throws Exception {
            Player p = newPlayer();
            for (int i = 0; i < 4; i++) {
                login(p.getEmail(), "WrongPass1", "PLAYER").andExpect(status().isUnauthorized());
            }
            login(p.getEmail(), "WrongPass1", "PLAYER")
                .andExpect(status().isLocked())
                .andExpect(jsonPath("$.message", containsString("locked for 10 more minutes")));

            login(p.getEmail(), TestData.DEMO_PASSWORD, "PLAYER").andExpect(status().isLocked());
            assertThat(playerRepository.findById(p.getUserID()).orElseThrow().getLockedUntil())
                .isAfter(LocalDateTime.now().plusMinutes(9));
        }

        @Test
        @DisplayName("after the lock expires the right password works again")
        void unlocksAfterExpiry() throws Exception {
            Player p = newPlayer();
            p.setLockedUntil(LocalDateTime.now().minusMinutes(1));
            p.setFailedLoginAttempts(0);
            playerRepository.saveAndFlush(p);

            login(p.getEmail(), TestData.DEMO_PASSWORD, "PLAYER").andExpect(status().isOk());
        }

        @Test
        @DisplayName("resetting the password with an e-mailed OTP lifts the lock")
        void otpResetUnlocks() throws Exception {
            Player p = newPlayer();
            p.setLockedUntil(LocalDateTime.now().plusMinutes(10));
            p.setOtpCode("654321");
            p.setOtpExpiry(new java.util.Date(System.currentTimeMillis() + 60_000));
            playerRepository.saveAndFlush(p);

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("email", p.getEmail());
            body.put("otp", "654321");
            body.put("newPassword", "Unlocked123");
            mockMvc.perform(put("/api/auth/reset-password-otp").contentType(MediaType.APPLICATION_JSON).content(json(body)))
                .andExpect(status().isOk());

            login(p.getEmail(), "Unlocked123", "PLAYER").andExpect(status().isOk());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Username and player category (FR-1, FR-3, FR-5, FR-9)")
    class UsernameAndCategory {

        @Test
        @DisplayName("register with a username and category, then sign in with the username")
        void registerAndLoginWithUsername() throws Exception {
            Map<String, Object> body = registration("uname@test.local", "PLAYER");
            body.put("username", "Court_King");
            body.put("category", "student");
            mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(json(body)))
                .andExpect(status().isOk());

            Player saved = playerRepository.findByEmail("uname@test.local").orElseThrow();
            assertThat(saved.getUsername()).isEqualTo("court_king");
            assertThat(saved.getCategory()).isEqualTo("STUDENT");

            login("COURT_KING", "Secret123", "PLAYER")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("uname@test.local"))
                .andExpect(jsonPath("$.playerID").value(saved.getUserID()));
        }

        @Test
        @DisplayName("a taken username → 409")
        void duplicateUsername() throws Exception {
            Player existing = newPlayer();
            existing.setUsername("taken_name");
            playerRepository.saveAndFlush(existing);

            Map<String, Object> body = registration("other@test.local", "PLAYER");
            body.put("username", "Taken_Name");
            mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(json(body)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("username is already taken")));
        }

        @Test
        @DisplayName("invalid username or category → 400")
        void invalidValues() throws Exception {
            Map<String, Object> body = registration("bad@test.local", "PLAYER");
            body.put("username", "has@sign");
            body.put("category", "VIP");
            mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(json(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.username").exists())
                .andExpect(jsonPath("$.fieldErrors.category").exists());
        }

        @Test
        @DisplayName("the Group category needs the group size")
        void groupNeedsSize() throws Exception {
            Map<String, Object> body = registration("group@test.local", "PLAYER");
            body.put("category", "GROUP");
            mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(json(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("number of people")));

            body.put("groupSize", 6);
            mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(json(body)))
                .andExpect(status().isOk());
            assertThat(playerRepository.findByEmail("group@test.local").orElseThrow().getGroupSize())
                .isEqualTo(6);
        }

        @Test
        @DisplayName("no category given → Regular")
        void defaultsToRegular() throws Exception {
            mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                    .content(json(registration("regular@test.local", "PLAYER"))))
                .andExpect(status().isOk());
            assertThat(playerRepository.findByEmail("regular@test.local").orElseThrow().getCategory())
                .isEqualTo("REGULAR");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("PUT /profile (FR-10)")
    class UpdateProfile {

        private Map<String, Object> changes() {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("name", "Renamed Player");
            body.put("username", "renamed.player");
            body.put("phone", "+92 321 1234567");
            body.put("dateOfBirth", "1999-09-09");
            body.put("category", "GROUP");
            body.put("groupSize", 4);
            return body;
        }

        @Test
        @DisplayName("the player updates their own details")
        void updatesOwnProfile() throws Exception {
            Player p = newPlayer();
            mockMvc.perform(put("/api/auth/profile").header("Authorization", tokenFor(p))
                    .contentType(MediaType.APPLICATION_JSON).content(json(changes())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Renamed Player"))
                .andExpect(jsonPath("$.username").value("renamed.player"))
                .andExpect(jsonPath("$.category").value("GROUP"))
                .andExpect(jsonPath("$.groupSize").value(4))
                .andExpect(jsonPath("$.email").value(p.getEmail()));   // e-mail cannot change

            Player saved = playerRepository.findById(p.getUserID()).orElseThrow();
            assertThat(saved.getPhone()).isEqualTo("0321-1234567");   // stored in one format
            assertThat(saved.getDateOfBirth()).isEqualTo("1999-09-09");
        }

        @Test
        @DisplayName("category details from the design: student ID and university e-mail, family size, group lead")
        void categoryDetails() throws Exception {
            Player p = newPlayer();
            Map<String, Object> body = changes();
            body.put("category", "STUDENT");
            body.put("studentId", "22L-1234");
            body.put("universityEmail", "l221234@lhr.nu.edu.pk");
            body.put("familySize", 4);                       // ignored: not a family
            mockMvc.perform(put("/api/auth/profile").header("Authorization", tokenFor(p))
                    .contentType(MediaType.APPLICATION_JSON).content(json(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.studentId").value("22L-1234"))
                .andExpect(jsonPath("$.universityEmail").value("l221234@lhr.nu.edu.pk"))
                .andExpect(jsonPath("$.familySize").doesNotExist())
                .andExpect(jsonPath("$.groupSize").doesNotExist());

            body = changes();                                 // GROUP of 4, no lead given
            mockMvc.perform(put("/api/auth/profile").header("Authorization", tokenFor(p))
                    .contentType(MediaType.APPLICATION_JSON).content(json(body)))
                .andExpect(jsonPath("$.leadMemberName").value("Renamed Player"))   // defaults to the player
                .andExpect(jsonPath("$.studentId").doesNotExist());             // student details cleared

            body.put("category", "FAMILY");
            body.put("familySize", 5);
            mockMvc.perform(put("/api/auth/profile").header("Authorization", tokenFor(p))
                    .contentType(MediaType.APPLICATION_JSON).content(json(body)))
                .andExpect(jsonPath("$.familySize").value(5))
                .andExpect(jsonPath("$.groupSize").doesNotExist());

            body.put("universityEmail", "not-an-email");
            mockMvc.perform(put("/api/auth/profile").header("Authorization", tokenFor(p))
                    .contentType(MediaType.APPLICATION_JSON).content(json(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.universityEmail").exists());
        }

        @Test
        @DisplayName("always edits the caller's own account, whatever the body says")
        void cannotEditOthers() throws Exception {
            Player p = newPlayer();
            Map<String, Object> body = changes();
            body.put("email", TestData.PLAYER_EMAIL);    // ignored: not an editable field
            mockMvc.perform(put("/api/auth/profile").header("Authorization", tokenFor(p))
                    .contentType(MediaType.APPLICATION_JSON).content(json(body)))
                .andExpect(status().isOk());
            assertThat(playerRepository.findById(TestData.PLAYER_ID).orElseThrow().getName()).isEqualTo("Hamza Raza");
        }

        @Test
        @DisplayName("someone else's username → 409; keeping your own → 200")
        void usernameUniqueness() throws Exception {
            Player other = newPlayer();
            other.setUsername("renamed.player");
            playerRepository.saveAndFlush(other);
            Player p = newPlayer();

            mockMvc.perform(put("/api/auth/profile").header("Authorization", tokenFor(p))
                    .contentType(MediaType.APPLICATION_JSON).content(json(changes())))
                .andExpect(status().isConflict());

            mockMvc.perform(put("/api/auth/profile").header("Authorization", tokenFor(other))
                    .contentType(MediaType.APPLICATION_JSON).content(json(changes())))
                .andExpect(status().isOk());
        }

        @Test
        @DisplayName("missing required fields → 400; anonymous → 401")
        void validationAndAuth() throws Exception {
            Map<String, Object> body = changes();
            body.remove("name");
            mockMvc.perform(put("/api/auth/profile").header("Authorization", playerToken())
                    .contentType(MediaType.APPLICATION_JSON).content(json(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.name").exists());

            mockMvc.perform(put("/api/auth/profile").contentType(MediaType.APPLICATION_JSON).content(json(changes())))
                .andExpect(status().isUnauthorized());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Input validation")
    class InputValidation {

        private org.springframework.test.web.servlet.ResultActions register(Map<String, Object> body) throws Exception {
            return mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(json(body)));
        }

        @Test
        @DisplayName("Pakistani mobile numbers are accepted in any common format and stored as 03XX-XXXXXXX")
        void phoneFormats() throws Exception {
            String[] ok = {"03001234567", "0300-1234567", "+92 300 1234567", "0092 300 1234567"};
            for (int i = 0; i < ok.length; i++) {
                Map<String, Object> body = registration("phone" + i + "@test.local", "PLAYER");
                body.put("phone", ok[i]);
                register(body).andExpect(status().isOk());
                assertThat(playerRepository.findByEmail("phone" + i + "@test.local").orElseThrow().getPhone())
                    .isEqualTo("0300-1234567");
            }
        }

        @Test
        @DisplayName("phone numbers that are not 11-digit Pakistani mobiles → 400")
        void badPhones() throws Exception {
            for (String bad : new String[]{"0300123456", "030012345678", "04212345678", "abc", "+1 555 123 4567", "0300-12a4567"}) {
                Map<String, Object> body = registration("badphone@test.local", "PLAYER");
                body.put("phone", bad);
                register(body)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.fieldErrors.phone", containsString("11 digits starting with 03")));
            }
        }

        @Test
        @DisplayName("names with digits or symbols, and e-mails without a domain ending → 400")
        void namesAndEmails() throws Exception {
            Map<String, Object> body = registration("user@localhost", "PLAYER");
            body.put("name", "R2-D2 <script>");
            register(body)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.name").exists())
                .andExpect(jsonPath("$.fieldErrors.email").exists());
        }

        @Test
        @DisplayName("names like O'Brien and Muhammad Ali Jr. are allowed; e-mails are stored in lower case")
        void validNames() throws Exception {
            Map<String, Object> body = registration("Mixed.Case@Test.Local", "PLAYER");
            body.put("name", "Ayesha O'Brien-Khan Jr.");
            register(body).andExpect(status().isOk());
            assertThat(playerRepository.findByEmail("mixed.case@test.local")).isPresent();
            login("MIXED.CASE@test.local", "Secret123", "PLAYER").andExpect(status().isOk());   // any case works
        }

        @Test
        @DisplayName("date of birth must be a real past date with age 5-100")
        void dateOfBirth() throws Exception {
            String future = java.time.LocalDate.now().plusDays(1).toString();
            String toddler = java.time.LocalDate.now().minusYears(3).toString();
            for (String bad : new String[]{future, toddler, "1900-01-01", "2000-13-45", "01/01/2000"}) {
                Map<String, Object> body = registration("dob@test.local", "PLAYER");
                body.put("dateOfBirth", bad);
                register(body)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.fieldErrors.dateOfBirth").exists());
            }
        }

        @Test
        @DisplayName("arena managers must be at least 18")
        void managerAge() throws Exception {
            Map<String, Object> body = registration("young.manager@test.local", "MANAGER");
            body.put("dateOfBirth", java.time.LocalDate.now().minusYears(16).toString());
            register(body)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("at least 18")));
        }

        @Test
        @DisplayName("student details: university e-mail must be academic, student ID alphanumeric")
        void studentDetails() throws Exception {
            Map<String, Object> body = registration("stud@test.local", "PLAYER");
            body.put("category", "STUDENT");
            body.put("universityEmail", "someone@gmail.com");
            body.put("studentId", "22L 1234!");
            register(body)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.universityEmail").exists())
                .andExpect(jsonPath("$.fieldErrors.studentId").exists());
        }

        @Test
        @DisplayName("an unknown role → 400")
        void role() throws Exception {
            register(registration("role@test.local", "ADMIN"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.role").exists());
        }
    }
}
