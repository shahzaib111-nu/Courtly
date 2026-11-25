package com.scd.courtly.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.scd.courtly.model.Booking;
import com.scd.courtly.model.Player;
import com.scd.courtly.repository.BookingRepository;
import com.scd.courtly.repository.PlayerRepository;
import com.scd.courtly.security.JwtService;
import com.scd.courtly.service.EmailService;
import com.scd.courtly.service.SchedulerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Base class for end-to-end API tests.
 *
 * <ul>
 *   <li>Starts the full Spring Boot application with an in-memory H2 database seeded by data.sql.</li>
 *   <li>Every test runs in a transaction that is rolled back afterwards, so tests never affect each other.</li>
 *   <li>{@link EmailService} is mocked, so no real e-mail is ever sent.</li>
 *   <li>{@link SchedulerService} is mocked, so background jobs cannot change data during a test.</li>
 * </ul>
 * All subclasses share one cached application context, so the app only starts once.
 */
@Tag("integration")
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(locations = "classpath:application-test.properties")
@Transactional
public abstract class IntegrationTest {

    @Autowired protected MockMvc mockMvc;
    @Autowired protected ObjectMapper objectMapper;
    @Autowired protected JwtService jwtService;
    @Autowired protected PlayerRepository playerRepository;
    @Autowired protected BookingRepository bookingRepository;
    @Autowired protected PasswordEncoder passwordEncoder;

    @MockitoBean protected EmailService emailService;
    @MockitoBean protected SchedulerService schedulerService;

    @BeforeEach
    void stubEmail() {
        when(emailService.sendNotificationEmail(anyString(), anyString(), anyString(), anyString())).thenReturn(true);
        when(emailService.sendOtpEmail(anyString(), anyString())).thenReturn(true);
    }

    // ── Authentication helpers ───────────────────────────────────────────────

    protected String bearer(String email, String role, String userId) {
        return "Bearer " + jwtService.generateToken(email, role, userId);
    }

    protected String playerToken()   { return bearer(TestData.PLAYER_EMAIL, "PLAYER", TestData.PLAYER_ID); }
    protected String player2Token()  { return bearer(TestData.PLAYER_2_EMAIL, "PLAYER", TestData.PLAYER_2_ID); }
    protected String managerToken()  { return bearer(TestData.MANAGER_1_EMAIL, "MANAGER", TestData.MANAGER_1_ID); }
    protected String adminToken()    { return bearer(TestData.ADMIN_EMAIL, "ADMIN", "ADMIN"); }

    protected String tokenFor(Player p) {
        return bearer(p.getEmail(), p.getRole(), p.getUserID());
    }

    // ── Test data helpers (rolled back after each test) ──────────────────────

    /** A fresh player with no bookings; password is {@link TestData#DEMO_PASSWORD}. */
    protected Player newPlayer() {
        return newUser("PLAYER", "Active");
    }

    protected Player newUser(String role, String accountStatus) {
        String id = "T-" + UUID.randomUUID().toString().substring(0, 8);
        Player p = Fixtures.player(id, id.toLowerCase() + "@test.local");
        p.setRole(role);
        p.setAccountStatus(accountStatus);
        p.setAuthProvider("LOCAL");
        p.setPasswordHash(passwordEncoder.encode(TestData.DEMO_PASSWORD));
        return playerRepository.saveAndFlush(p);
    }

    protected Booking saveBooking(String playerID, String courtID, String date, String timeSlot, String status) {
        Booking b = Fixtures.booking(null, playerID, courtID, date, timeSlot, status);
        return bookingRepository.saveAndFlush(b);
    }

    // ── JSON helper ──────────────────────────────────────────────────────────

    protected String json(Object body) throws Exception {
        return objectMapper.writeValueAsString(body);
    }
}
