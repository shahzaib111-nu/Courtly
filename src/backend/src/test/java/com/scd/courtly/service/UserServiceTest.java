package com.scd.courtly.service;

import com.scd.courtly.dto.response.LoginResponse;
import com.scd.courtly.exception.ConflictException;
import com.scd.courtly.model.Player;
import com.scd.courtly.model.User;
import com.scd.courtly.repository.UserRepository;
import com.scd.courtly.security.AdminAccount;
import com.scd.courtly.security.JwtService;
import com.scd.courtly.support.Fixtures;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.AdditionalAnswers.returnsFirstArg;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@Tag("unit")
@DisplayName("UserService (registration and password login)")
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class UserServiceTest {

    @Mock UserRepository userRepository;
    @Mock JwtService jwtService;
    @Spy AdminAccount adminAccount = new AdminAccount("admin.playfair@gmail.com", "Admin123");
    @Spy BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder(4); // low cost keeps tests fast
    @InjectMocks UserService service;

    @BeforeEach
    void setUp() {
        when(userRepository.save(any())).thenAnswer(returnsFirstArg());
        when(jwtService.generateToken(anyString(), anyString(), anyString())).thenReturn("jwt");
        when(jwtService.getExpirationMs()).thenReturn(3600000L);
    }

    private Player stored(String email, String rawPassword, String role) {
        Player p = Fixtures.player("U-1", email);
        p.setRole(role);
        p.setPasswordHash(rawPassword == null ? null : passwordEncoder.encode(rawPassword));
        when(userRepository.findByEmail(email)).thenReturn(Optional.of(p));
        return p;
    }

    @Nested
    @DisplayName("Registration")
    class Register {

        @Test
        @DisplayName("hashes the password, assigns an id and activates players")
        void player() {
            Player p = Fixtures.player(null, "new@x.com");
            p.setPasswordHash("Secret123");

            User saved = service.register(p);

            assertThat(saved.getUserID()).startsWith("U-");
            assertThat(saved.getPasswordHash()).startsWith("$2").isNotEqualTo("Secret123");
            assertThat(saved.getAccountStatus()).isEqualTo("Active");
            assertThat(saved.getAuthProvider()).isEqualTo("LOCAL");
        }

        @Test
        @DisplayName("managers start in PENDING_APPROVAL")
        void manager() {
            Player p = Fixtures.player(null, "mgr@x.com");
            p.setRole("MANAGER");
            p.setPasswordHash("Secret123");

            assertThat(service.register(p).getAccountStatus()).isEqualTo("PENDING_APPROVAL");
        }

        @Test
        @DisplayName("returns null when the email is already registered")
        void duplicate() {
            stored("taken@x.com", "Secret123", "PLAYER");
            assertThat(service.register(Fixtures.player(null, "taken@x.com"))).isNull();
            verify(userRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("Login")
    class Login {

        @Test
        @DisplayName("valid credentials return a token")
        void success() {
            stored("p@x.com", "Secret123", "PLAYER");

            LoginResponse r = service.login("p@x.com", "Secret123", "PLAYER");

            assertThat(r.success()).isTrue();
            assertThat(r.token()).isEqualTo("jwt");
            assertThat(r.role()).isEqualTo("PLAYER");
            assertThat(r.accountStatus()).isNull(); // only reported for managers
        }

        @Test
        @DisplayName("managers also receive their approval status")
        void managerStatus() {
            Player m = stored("m@x.com", "Secret123", "MANAGER");
            m.setAccountStatus("PENDING_APPROVAL");
            assertThat(service.login("m@x.com", "Secret123", "MANAGER").accountStatus()).isEqualTo("PENDING_APPROVAL");
        }

        @Test
        @DisplayName("wrong password is rejected")
        void wrongPassword() {
            stored("p@x.com", "Secret123", "PLAYER");
            assertThat(service.login("p@x.com", "nope", "PLAYER").message()).isEqualTo("INVALID_CREDENTIALS");
        }

        @Test
        @DisplayName("unknown email is rejected")
        void unknownEmail() {
            assertThat(service.login("ghost@x.com", "x", null).message()).isEqualTo("EMAIL_NOT_FOUND");
        }

        @Test
        @DisplayName("accounts pending deletion cannot sign in")
        void pendingDeletion() {
            stored("p@x.com", "Secret123", "PLAYER").setDeletionStatus("PENDING");
            assertThat(service.login("p@x.com", "Secret123", null).message()).isEqualTo("ACCOUNT_PENDING_DELETION");
        }

        @Test
        @DisplayName("signing in on the wrong role tab is rejected")
        void roleMismatch() {
            stored("p@x.com", "Secret123", "PLAYER");
            assertThat(service.login("p@x.com", "Secret123", "MANAGER").message()).isEqualTo("ROLE_MISMATCH:PLAYER");
        }

        @Test
        @DisplayName("password-less (Google/GitHub) accounts cannot use password login")
        void oauthOnlyAccount() {
            stored("o@x.com", null, "PLAYER");
            assertThat(service.login("o@x.com", "anything", null).success()).isFalse();
        }

        @Test
        @DisplayName("legacy plain-text passwords work once and are re-hashed")
        void legacyPassword() {
            Player p = stored("old@x.com", null, "PLAYER");
            p.setPasswordHash("Plain123");

            assertThat(service.login("old@x.com", "Plain123", null).success()).isTrue();
            assertThat(p.getPasswordHash()).startsWith("$2");
        }

        @Test
        @DisplayName("built-in admin signs in with the admin role")
        void admin() {
            LoginResponse r = service.login("admin.playfair@gmail.com", "Admin123", null);
            assertThat(r.success()).isTrue();
            assertThat(r.role()).isEqualTo("ADMIN");
        }

        @Test
        @DisplayName("admin cannot sign in on the player tab")
        void adminOnPlayerTab() {
            assertThat(service.login("admin.playfair@gmail.com", "Admin123", "PLAYER").message())
                .isEqualTo("ROLE_MISMATCH:ADMIN");
        }
    }

    @Nested
    @DisplayName("Username sign-in (FR-1, FR-5)")
    class Username {

        @Test
        @DisplayName("registration stores the username in lower case")
        void storedLowerCase() {
            Player p = Fixtures.player(null, "u@x.com");
            p.setPasswordHash("Secret123");
            p.setUsername("  Hamza_R ");
            assertThat(service.register(p).getUsername()).isEqualTo("hamza_r");
        }

        @Test
        @DisplayName("a taken username is rejected")
        void takenUsername() {
            when(userRepository.existsByUsername("hamza")).thenReturn(true);
            Player p = Fixtures.player(null, "new@x.com");
            p.setPasswordHash("Secret123");
            p.setUsername("Hamza");
            assertThatThrownBy(() -> service.register(p)).isInstanceOf(ConflictException.class);
            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("login accepts a username (any case) instead of the e-mail")
        void loginWithUsername() {
            Player p = Fixtures.player("U-1", "p@x.com");
            p.setRole("PLAYER");
            p.setPasswordHash(passwordEncoder.encode("Secret123"));
            when(userRepository.findByUsername("hamza")).thenReturn(Optional.of(p));

            LoginResponse r = service.login("Hamza", "Secret123", "PLAYER");

            assertThat(r.success()).isTrue();
            assertThat(r.email()).isEqualTo("p@x.com");   // the browser needs the real e-mail
            verify(userRepository, never()).findByEmail(any());
        }
    }

    @Nested
    @DisplayName("Account lockout (NFR 2.1.2)")
    class Lockout {

        @Test
        @DisplayName("the 5th wrong password in a row locks the account for 10 minutes")
        void locksAfterFiveFailures() {
            Player p = stored("p@x.com", "Secret123", "PLAYER");
            for (int i = 1; i < UserService.MAX_FAILED_LOGINS; i++) {
                assertThat(service.login("p@x.com", "Wrong123", null).message()).isEqualTo("INVALID_CREDENTIALS");
                assertThat(p.getFailedLoginAttempts()).isEqualTo(i);
            }

            LoginResponse fifth = service.login("p@x.com", "Wrong123", null);

            assertThat(fifth.message()).isEqualTo("ACCOUNT_LOCKED:10");
            assertThat(p.getLockedUntil())
                .isBetween(LocalDateTime.now().plusMinutes(9), LocalDateTime.now().plusMinutes(10));
        }

        @Test
        @DisplayName("a locked account rejects even the correct password")
        void lockedRejectsCorrectPassword() {
            Player p = stored("p@x.com", "Secret123", "PLAYER");
            p.setLockedUntil(LocalDateTime.now().plusMinutes(4));

            LoginResponse r = service.login("p@x.com", "Secret123", null);

            assertThat(r.success()).isFalse();
            assertThat(r.message()).isEqualTo("ACCOUNT_LOCKED:4");
            verify(jwtService, never()).generateToken(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("once the lock expires the user can sign in, and the counter resets")
        void lockExpires() {
            Player p = stored("p@x.com", "Secret123", "PLAYER");
            p.setLockedUntil(LocalDateTime.now().minusSeconds(1));
            p.setFailedLoginAttempts(3);

            assertThat(service.login("p@x.com", "Secret123", null).success()).isTrue();
            assertThat(p.getFailedLoginAttempts()).isZero();
            assertThat(p.getLockedUntil()).isNull();
        }

        @Test
        @DisplayName("a successful login resets the failure counter")
        void successResets() {
            Player p = stored("p@x.com", "Secret123", "PLAYER");
            p.setFailedLoginAttempts(4);
            assertThat(service.login("p@x.com", "Secret123", null).success()).isTrue();
            assertThat(p.getFailedLoginAttempts()).isZero();
        }

        @Test
        @DisplayName("accounts created before lockout existed (NULL counter) still work")
        void nullCounter() {
            Player p = stored("p@x.com", "Secret123", "PLAYER");
            p.setFailedLoginAttempts(null);
            assertThat(service.login("p@x.com", "Wrong123", null).message()).isEqualTo("INVALID_CREDENTIALS");
            assertThat(p.getFailedLoginAttempts()).isEqualTo(1);
        }

        @Test
        @DisplayName("the built-in admin is locked out the same way")
        void adminLockout() {
            for (int i = 1; i < UserService.MAX_FAILED_LOGINS; i++) {
                service.login("admin.playfair@gmail.com", "Wrong123", null);
            }
            assertThat(service.login("admin.playfair@gmail.com", "Wrong123", null).message())
                .startsWith("ACCOUNT_LOCKED:");
            assertThat(service.login("admin.playfair@gmail.com", "Admin123", null).success()).isFalse();
        }
    }
}
