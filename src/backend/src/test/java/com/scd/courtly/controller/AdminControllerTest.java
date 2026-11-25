package com.scd.courtly.controller;

import com.scd.courtly.model.Player;
import com.scd.courtly.model.VerificationDoc;
import com.scd.courtly.repository.NotificationRepository;
import com.scd.courtly.repository.VerificationDocRepository;
import com.scd.courtly.support.IntegrationTest;
import com.scd.courtly.support.TestData;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("Admin API  /api/admin")
class AdminControllerTest extends IntegrationTest {

    @Autowired VerificationDocRepository docRepository;
    @Autowired NotificationRepository notificationRepository;

    @ParameterizedTest(name = "{0} is admin-only")
    @ValueSource(strings = {"/api/admin/stats", "/api/admin/pending-docs", "/api/admin/pending-managers",
        "/api/admin/deletion-requests", "/api/admin/active-bookings", "/api/admin/payment-history"})
    void forbiddenForNonAdmins(String url) throws Exception {
        mockMvc.perform(get(url).header("Authorization", playerToken())).andExpect(status().isForbidden());
        mockMvc.perform(get(url).header("Authorization", managerToken())).andExpect(status().isForbidden());
        mockMvc.perform(get(url).header("Authorization", adminToken())).andExpect(status().isOk());
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Discount document verification")
    class Documents {

        private VerificationDoc pendingDoc(Player p, String type) {
            VerificationDoc d = new VerificationDoc();
            d.setPlayer(p);
            d.setDocType(type);
            d.setStatus("PENDING");
            d.setFileURL("uploads/verification/test.pdf");
            return docRepository.saveAndFlush(d);
        }

        @Test
        @DisplayName("approving a student ID gives the player the STUDENT tier")
        void approve() throws Exception {
            Player p = newPlayer();
            VerificationDoc d = pendingDoc(p, "STUDENT_ID");

            mockMvc.perform(get("/api/admin/pending-docs").header("Authorization", adminToken()))
                .andExpect(jsonPath("$[*].docID", hasItem(d.getDocID())));

            mockMvc.perform(post("/api/admin/verify-doc").header("Authorization", adminToken())
                    .param("docID", d.getDocID()).param("newStatus", "APPROVED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"));

            assertThat(playerRepository.findById(p.getUserID()).orElseThrow().getDiscountTier()).isEqualTo("STUDENT");
            assertThat(docRepository.findById(d.getDocID()).orElseThrow().getReviewedBy()).isEqualTo("ADMIN"); // ERD reviewed_by
            assertThat(notificationRepository.findByUserIdOrderByCreatedAtDesc(p.getUserID()))
                .anyMatch(n -> n.getType().equals("PROFILE_VERIFIED"));
        }

        @Test
        @DisplayName("rejecting stores the reason and notifies the player")
        void reject() throws Exception {
            Player p = newPlayer();
            VerificationDoc d = pendingDoc(p, "SENIOR_CARD");

            mockMvc.perform(post("/api/admin/verify-doc").header("Authorization", adminToken())
                    .param("docID", d.getDocID()).param("newStatus", "REJECTED").param("rejectionReason", "Blurry"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rejectionReason").value("Blurry"));

            assertThat(playerRepository.findById(p.getUserID()).orElseThrow().getDiscountTier()).isEqualTo("NONE");
        }

        @Test
        @DisplayName("unknown document → 404")
        void unknownDoc() throws Exception {
            mockMvc.perform(post("/api/admin/verify-doc").header("Authorization", adminToken())
                    .param("docID", "DOC-NOPE").param("newStatus", "APPROVED"))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("GET /stats reports today's review counts")
        void stats() throws Exception {
            mockMvc.perform(get("/api/admin/stats").header("Authorization", adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pendingCount").isNumber())
                .andExpect(jsonPath("$.approvedToday").isNumber())
                .andExpect(jsonPath("$.rejectedToday").isNumber());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Arena manager approval")
    class ManagerApproval {

        @Test
        @DisplayName("pending managers are listed and can be approved")
        void approve() throws Exception {
            Player m = newUser("MANAGER", "PENDING_APPROVAL");

            mockMvc.perform(get("/api/admin/pending-managers").header("Authorization", adminToken()))
                .andExpect(jsonPath("$[*].userID", hasItem(m.getUserID())));

            mockMvc.perform(post("/api/admin/approve-manager").header("Authorization", adminToken())
                    .param("playerID", m.getUserID()).param("action", "APPROVE"))
                .andExpect(status().isOk());
            assertThat(playerRepository.findById(m.getUserID()).orElseThrow().getAccountStatus()).isEqualTo("Active");
        }

        @Test
        @DisplayName("rejected managers are marked REJECTED")
        void reject() throws Exception {
            Player m = newUser("MANAGER", "PENDING_APPROVAL");
            mockMvc.perform(post("/api/admin/approve-manager").header("Authorization", adminToken())
                    .param("playerID", m.getUserID()).param("action", "REJECT").param("rejectionReason", "Incomplete"))
                .andExpect(status().isOk());
            assertThat(playerRepository.findById(m.getUserID()).orElseThrow().getAccountStatus()).isEqualTo("REJECTED");
        }

        @Test
        @DisplayName("invalid action → 400, unknown manager → 404")
        void invalid() throws Exception {
            Player m = newUser("MANAGER", "PENDING_APPROVAL");
            mockMvc.perform(post("/api/admin/approve-manager").header("Authorization", adminToken())
                    .param("playerID", m.getUserID()).param("action", "MAYBE"))
                .andExpect(status().isBadRequest());
            mockMvc.perform(post("/api/admin/approve-manager").header("Authorization", adminToken())
                    .param("playerID", "NOPE").param("action", "APPROVE"))
                .andExpect(status().isNotFound());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Account deletion requests")
    class Deletion {

        private Player requestedDeletion() {
            Player p = newPlayer();
            p.setDeletionStatus("PENDING");
            p.setDeletionRequestedAt(new Date());
            return playerRepository.saveAndFlush(p);
        }

        private void process(Player p, String action) throws Exception {
            mockMvc.perform(post("/api/admin/process-deletion").header("Authorization", adminToken())
                    .param("playerEmail", p.getEmail()).param("action", action))
                .andExpect(status().isOk());
        }

        @Test
        @DisplayName("new requests show a 7-day grace period")
        void listed() throws Exception {
            Player p = requestedDeletion();
            mockMvc.perform(get("/api/admin/deletion-requests").header("Authorization", adminToken()))
                .andExpect(jsonPath("$[?(@.email == '" + p.getEmail() + "')].daysRemaining").value(contains(7)));
        }

        @Test
        @DisplayName("ARCHIVE moves the account to archived accounts")
        void archive() throws Exception {
            Player p = requestedDeletion();
            process(p, "ARCHIVE");
            mockMvc.perform(get("/api/admin/archived-accounts").header("Authorization", adminToken()))
                .andExpect(jsonPath("$[*].email", hasItem(p.getEmail())));
        }

        @Test
        @DisplayName("CANCEL keeps the account active")
        void cancel() throws Exception {
            Player p = requestedDeletion();
            process(p, "CANCEL");
            assertThat(playerRepository.findById(p.getUserID()).orElseThrow().getDeletionStatus()).isNull();
        }

        @Test
        @DisplayName("DELETE_NOW removes the account")
        void deleteNow() throws Exception {
            Player p = requestedDeletion();
            process(p, "DELETE_NOW");
            assertThat(playerRepository.findById(p.getUserID())).isEmpty();
        }

        @Test
        @DisplayName("invalid action → 400")
        void invalid() throws Exception {
            Player p = requestedDeletion();
            mockMvc.perform(post("/api/admin/process-deletion").header("Authorization", adminToken())
                    .param("playerEmail", p.getEmail()).param("action", "EXPLODE"))
                .andExpect(status().isBadRequest());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Reports and monitoring")
    class Reports {

        @ParameterizedTest(name = "{0} report")
        @ValueSource(strings = {"COURT_UTILIZATION", "REVENUE_SUMMARY", "USER_DEMOGRAPHICS"})
        void reports(String type) throws Exception {
            mockMvc.perform(get("/api/admin/reports").header("Authorization", adminToken())
                    .param("type", type).param("startDate", "2026-04-01").param("endDate", "2026-05-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value(type))
                .andExpect(jsonPath("$.startDate").value("2026-04-01"));
        }

        @Test
        @DisplayName("revenue for the seeded April-May period is positive")
        void seededRevenue() throws Exception {
            mockMvc.perform(get("/api/admin/reports").header("Authorization", adminToken())
                    .param("type", "REVENUE_SUMMARY").param("startDate", "2026-04-01").param("endDate", "2026-05-31"))
                .andExpect(jsonPath("$.totalRevenue", greaterThan(0.0)))
                .andExpect(jsonPath("$.bookingCount", greaterThan(0)));
        }

        @Test
        @DisplayName("GET /active-bookings includes upcoming bookings")
        void activeBookings() throws Exception {
            Player p = newPlayer();
            saveBooking(p.getUserID(), TestData.TENNIS_COURT_1, TestData.futureWeekday(3).toString(), "10:00-11:00", "CONFIRMED");

            mockMvc.perform(get("/api/admin/active-bookings").header("Authorization", adminToken()))
                .andExpect(jsonPath("$[*].playerName", hasItem(p.getName())));
        }

        @Test
        @DisplayName("GET /payment-history accepts a date range")
        void paymentHistory() throws Exception {
            mockMvc.perform(get("/api/admin/payment-history").header("Authorization", adminToken())
                    .param("from", "2026-04-01").param("to", "2026-05-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
        }

        @Test
        @DisplayName("GET /test-email uses the e-mail service")
        void testEmail() throws Exception {
            mockMvc.perform(get("/api/admin/test-email").header("Authorization", adminToken()).param("to", "x@test.local"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"));
            verify(emailService).sendNotificationEmail(eq("x@test.local"), anyString(), anyString(), anyString());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Report history (SYSTEM_REPORT)")
    class ReportHistory {

        @Test
        @DisplayName("generating a report records who ran it, with which filters")
        void recordsGeneratedReports() throws Exception {
            mockMvc.perform(get("/api/admin/reports").header("Authorization", adminToken())
                    .param("type", "REVENUE_SUMMARY").param("startDate", "2026-04-01").param("endDate", "2026-05-31"))
                .andExpect(status().isOk());

            mockMvc.perform(get("/api/admin/reports/history").header("Authorization", adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].reportType").value("REVENUE_SUMMARY"))
                .andExpect(jsonPath("$[0].adminId").value("ADMIN"))
                .andExpect(jsonPath("$[0].exportFormat").value("VIEW"))
                .andExpect(jsonPath("$[0].filters", containsString("\"startDate\":\"2026-04-01\"")))
                .andExpect(jsonPath("$[0].generatedAt").exists());
        }

        @Test
        @DisplayName("the rankings report is recorded too")
        void recordsRankings() throws Exception {
            mockMvc.perform(get("/api/matches/rankings").header("Authorization", adminToken()).param("sportType", "TENNIS"))
                .andExpect(status().isOk());
            mockMvc.perform(get("/api/admin/reports/history").header("Authorization", adminToken()))
                .andExpect(jsonPath("$[0].reportType").value("PLAYER_RANKINGS"))
                .andExpect(jsonPath("$[0].filters", containsString("TENNIS")));
        }

        @Test
        @DisplayName("POST /reports/log records a PDF export; unknown types or formats → 400")
        void logsExports() throws Exception {
            mockMvc.perform(post("/api/admin/reports/log").header("Authorization", adminToken())
                    .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                    .content(json(java.util.Map.of("reportType", "facility_feedback", "exportFormat", "pdf",
                        "filters", java.util.Map.of("sport", "TENNIS")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reportType").value("FACILITY_FEEDBACK"))
                .andExpect(jsonPath("$.exportFormat").value("PDF"));

            mockMvc.perform(post("/api/admin/reports/log").header("Authorization", adminToken())
                    .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                    .content(json(java.util.Map.of("reportType", "SECRET_DUMP", "exportFormat", "PDF"))))
                .andExpect(status().isBadRequest());
            mockMvc.perform(post("/api/admin/reports/log").header("Authorization", adminToken())
                    .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                    .content(json(java.util.Map.of("reportType", "REVENUE_SUMMARY", "exportFormat", "EXE"))))
                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("only admins can see or add report history")
        void adminOnly() throws Exception {
            mockMvc.perform(get("/api/admin/reports/history").header("Authorization", managerToken()))
                .andExpect(status().isForbidden());
            mockMvc.perform(post("/api/admin/reports/log").header("Authorization", playerToken())
                    .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                    .content(json(java.util.Map.of("reportType", "REVENUE_SUMMARY", "exportFormat", "PDF"))))
                .andExpect(status().isForbidden());
        }
    }
}
