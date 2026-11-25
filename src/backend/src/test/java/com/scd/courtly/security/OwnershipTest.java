package com.scd.courtly.security;

import com.scd.courtly.model.Booking;
import com.scd.courtly.model.Notification;
import com.scd.courtly.model.Player;
import com.scd.courtly.repository.CourtRepository;
import com.scd.courtly.repository.NotificationRepository;
import com.scd.courtly.support.IntegrationTest;
import com.scd.courtly.support.TestData;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.time.LocalDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Users may only act on their own data (FR-8). Every test here is an attack that
 * used to succeed: one user acting on another user's account, booking or court.
 */
@DisplayName("Security: users can only access their own data")
class OwnershipTest extends IntegrationTest {

    @Autowired NotificationRepository notificationRepository;
    @Autowired CourtRepository courtRepository;

    private Player victim;
    private Player attacker;

    @BeforeEach
    void twoPlayers() {
        victim = newPlayer();
        attacker = newPlayer();
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Accounts")
    class Accounts {

        @Test
        @DisplayName("the old password reset without OTP is gone; the victim's password still works")
        void unprotectedResetRemoved() throws Exception {
            String body = json(Map.of("email", victim.getEmail(), "newPassword", "Hijacked123"));
            mockMvc.perform(put("/api/auth/reset-password").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized());
            mockMvc.perform(put("/api/auth/reset-password").header("Authorization", tokenFor(attacker))
                    .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isNotFound());

            mockMvc.perform(post("/api/auth/login").param("email", victim.getEmail()).param("pass", TestData.DEMO_PASSWORD))
                .andExpect(status().isOk());
        }

        @Test
        @DisplayName("cannot request deletion of someone else's account")
        void deletionRequest() throws Exception {
            mockMvc.perform(post("/api/auth/request-deletion").param("playerEmail", victim.getEmail())
                    .header("Authorization", tokenFor(attacker)))
                .andExpect(status().isForbidden());
            assertThat(playerRepository.findById(victim.getUserID()).orElseThrow().getDeletionStatus()).isNull();
        }

        @Test
        @DisplayName("cannot read someone else's account status")
        void accountStatus() throws Exception {
            mockMvc.perform(get("/api/auth/account-status").param("playerID", victim.getUserID())
                    .header("Authorization", tokenFor(attacker)))
                .andExpect(status().isForbidden());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Bookings")
    class Bookings {

        private Booking victimBooking;

        @BeforeEach
        void booking() {
            victimBooking = saveBooking(victim.getUserID(), TestData.TENNIS_COURT_1,
                TestData.futureWeekday(6).toString(), "10:00-11:00", "PENDING");
        }

        @Test
        @DisplayName("cannot book in someone else's name")
        void bookAsSomeoneElse() throws Exception {
            mockMvc.perform(post("/api/bookings").header("Authorization", tokenFor(attacker))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json(Map.of("playerID", victim.getUserID(), "courtID", TestData.TENNIS_COURT_1,
                        "bookingDate", TestData.futureWeekday(6).toString(), "timeSlot", "12:00-13:00"))))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("cannot list someone else's bookings")
        void listOthers() throws Exception {
            mockMvc.perform(get("/api/bookings/player/{id}", victim.getUserID()).header("Authorization", tokenFor(attacker)))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("cannot cancel someone else's booking")
        void cancelOthers() throws Exception {
            mockMvc.perform(put("/api/bookings/{id}/cancel", victimBooking.getBookingID()).header("Authorization", tokenFor(attacker)))
                .andExpect(status().isForbidden());
            assertThat(bookingRepository.findById(victimBooking.getBookingID()).orElseThrow().getStatus()).isEqualTo("PENDING");
        }

        @Test
        @DisplayName("the court's own manager may cancel; another manager may not")
        void managerCancel() throws Exception {
            mockMvc.perform(put("/api/bookings/{id}/cancel", victimBooking.getBookingID()).header("Authorization", manager2Token()))
                .andExpect(status().isForbidden());
            mockMvc.perform(put("/api/bookings/{id}/cancel", victimBooking.getBookingID()).header("Authorization", managerToken()))
                .andExpect(status().isOk());
        }

        @Test
        @DisplayName("only the court's own manager may confirm a booking manually")
        void managerConfirm() throws Exception {
            mockMvc.perform(put("/api/bookings/{id}/confirm", victimBooking.getBookingID()).header("Authorization", manager2Token()))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("cannot submit a rating or match result as someone else")
        void ratingsAndResults() throws Exception {
            mockMvc.perform(post("/api/ratings/submit").header("Authorization", tokenFor(attacker))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json(Map.of("bookingID", victimBooking.getBookingID(), "playerID", victim.getUserID(), "ratingScore", 1))))
                .andExpect(status().isForbidden());
            mockMvc.perform(post("/api/matches/submit").header("Authorization", tokenFor(attacker))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json(Map.of("bookingID", victimBooking.getBookingID(), "playerID", victim.getUserID(),
                        "opponentName", "x", "playerScore", 0, "opponentScore", 9, "result", "LOSS"))))
                .andExpect(status().isForbidden());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Notifications")
    class Notifications {

        private Notification victimNote;

        @BeforeEach
        void note() {
            Notification n = new Notification();
            n.setUserId(victim.getUserID());
            n.setType("BOOKING_MADE");
            n.setTitle("Private");
            n.setMessage("Private message");
            victimNote = notificationRepository.saveAndFlush(n);
        }

        @Test
        @DisplayName("cannot read, mark or delete someone else's notifications")
        void othersNotifications() throws Exception {
            String t = tokenFor(attacker);
            mockMvc.perform(get("/api/notifications").param("userId", victim.getUserID()).header("Authorization", t))
                .andExpect(status().isForbidden());
            mockMvc.perform(get("/api/notifications/unread-count").param("userId", victim.getUserID()).header("Authorization", t))
                .andExpect(status().isForbidden());
            mockMvc.perform(put("/api/notifications/{id}/read", victimNote.getNotificationID()).header("Authorization", t))
                .andExpect(status().isForbidden());
            mockMvc.perform(put("/api/notifications/read-all").param("userId", victim.getUserID()).header("Authorization", t))
                .andExpect(status().isForbidden());
            mockMvc.perform(delete("/api/notifications/{id}", victimNote.getNotificationID()).header("Authorization", t))
                .andExpect(status().isForbidden());
            mockMvc.perform(delete("/api/notifications/all").param("userId", victim.getUserID()).header("Authorization", t))
                .andExpect(status().isForbidden());

            assertThat(notificationRepository.findById(victimNote.getNotificationID())).isPresent();
        }

        @Test
        @DisplayName("the admin reads the admin inbox")
        void adminInbox() throws Exception {
            mockMvc.perform(get("/api/notifications").param("userId", "ADMIN").header("Authorization", adminToken()))
                .andExpect(status().isOk());
            mockMvc.perform(get("/api/notifications").param("userId", "ADMIN").header("Authorization", tokenFor(attacker)))
                .andExpect(status().isForbidden());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Arena managers")
    class Managers {

        @Test
        @DisplayName("cannot view another manager's bookings or maintenance")
        void otherManagersData() throws Exception {
            mockMvc.perform(get("/api/manager/bookings/upcoming").param("managerID", TestData.MANAGER_2_ID).header("Authorization", managerToken()))
                .andExpect(status().isForbidden());
            mockMvc.perform(get("/api/manager/courts/maintenances").param("managerID", TestData.MANAGER_2_ID).header("Authorization", managerToken()))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("cannot edit, delete or schedule maintenance on another manager's court")
        void otherManagersCourt() throws Exception {
            String court = TestData.TENNIS_COURT_2;   // belongs to MGR002
            mockMvc.perform(put("/api/courts/{id}", court).header("Authorization", managerToken())
                    .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("name", "Hijacked", "sportType", "TENNIS", "hourlyRate", 1))))
                .andExpect(status().isForbidden());
            mockMvc.perform(delete("/api/courts/{id}", court).header("Authorization", managerToken()))
                .andExpect(status().isForbidden());
            mockMvc.perform(post("/api/manager/courts/{id}/schedule-maintenance", court).header("Authorization", managerToken())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json(Map.of("maintenanceFrom", LocalDateTime.now().plusDays(2).withNano(0).toString()))))
                .andExpect(status().isForbidden());

            assertThat(courtRepository.findById(court).orElseThrow().getName()).isEqualTo("DHA Tennis Academy");
        }

        @Test
        @DisplayName("a new court always belongs to the manager who created it")
        void createdCourtIsOwn() throws Exception {
            mockMvc.perform(post("/api/courts").header("Authorization", managerToken())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json(Map.of("name", "Sneaky", "sportType", "TENNIS", "hourlyRate", 900, "managerId", TestData.MANAGER_2_ID))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.managerId").value(TestData.MANAGER_1_ID));
        }

        @Test
        @DisplayName("a manager awaiting approval has no manager rights yet")
        void pendingManager() throws Exception {
            Player pending = newUser("MANAGER", "PENDING_APPROVAL");
            String t = tokenFor(pending);

            mockMvc.perform(get("/api/manager/bookings/upcoming").param("managerID", pending.getUserID()).header("Authorization", t))
                .andExpect(status().isForbidden());
            mockMvc.perform(post("/api/courts").header("Authorization", t)
                    .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("name", "Too Early", "sportType", "TENNIS", "hourlyRate", 900))))
                .andExpect(status().isForbidden());
            // ...but can still check whether they have been approved
            mockMvc.perform(get("/api/auth/account-status").param("playerID", pending.getUserID()).header("Authorization", t))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountStatus").value("PENDING_APPROVAL"));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Uploaded ID documents and CORS")
    class DocumentsAndCors {

        @Test
        @DisplayName("players cannot view uploaded ID documents, only admins")
        void documentView() throws Exception {
            mockMvc.perform(get("/api/docs/view/{id}", "DOC-ANY").header("Authorization", tokenFor(attacker)))
                .andExpect(status().isForbidden());
            mockMvc.perform(get("/api/docs/status").param("playerEmail", victim.getEmail()).header("Authorization", tokenFor(attacker)))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("CORS: the configured frontend origin is allowed, other websites are not")
        void cors() throws Exception {
            mockMvc.perform(options("/api/courts").header("Origin", "http://localhost:5501")
                    .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5501"));
            mockMvc.perform(options("/api/courts").header("Origin", "https://evil.example")
                    .header("Access-Control-Request-Method", "GET"))
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
        }
    }
}
