package com.scd.courtly.service;

import com.scd.courtly.dto.response.LoginResponse;
import com.scd.courtly.model.Player;
import com.scd.courtly.model.User;
import com.scd.courtly.repository.UserRepository;
import com.scd.courtly.security.JwtService;
import com.scd.courtly.security.oauth2.OAuth2UserProfile;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@Tag("unit")
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OAuth2AccountServiceTest {

    @Mock UserRepository userRepository;
    @Mock NotificationService notificationService;
    @Mock JwtService jwtService;
    @InjectMocks OAuth2AccountService service;

    @BeforeEach
    void setUp() {
        when(jwtService.generateToken(anyString(), anyString(), anyString())).thenReturn("jwt");
        when(jwtService.getExpirationMs()).thenReturn(3600000L);
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(userRepository.findByAuthProviderAndProviderId(anyString(), anyString())).thenReturn(Optional.empty());
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());
    }

    private static OAuth2UserProfile google(String email, boolean verified) {
        return new OAuth2UserProfile("GOOGLE", "g-123", email, verified, "Test User");
    }

    private static Player player(String email, String role) {
        Player p = new Player();
        p.setUserID("U-1");
        p.setEmail(email);
        p.setName("Existing");
        p.setRole(role);
        p.setAccountStatus("Active");
        p.setPasswordHash("$2a$hash");
        return p;
    }

    @Test
    void createsNewPlayerForUnknownVerifiedEmail() {
        LoginResponse r = service.signIn(google("new@x.com", true), "PLAYER");

        assertThat(r.success()).isTrue();
        assertThat(r.token()).isEqualTo("jwt");
        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(saved.capture());
        assertThat(saved.getValue()).isInstanceOf(Player.class);
        assertThat(saved.getValue().getAuthProvider()).isEqualTo("GOOGLE");
        assertThat(saved.getValue().getProviderId()).isEqualTo("g-123");
        assertThat(saved.getValue().getAccountStatus()).isEqualTo("Active");
        assertThat(saved.getValue().getPasswordHash()).isNull();
    }

    @Test
    void newManagerIsPendingApproval() {
        LoginResponse r = service.signIn(google("mgr@x.com", true), "MANAGER");

        assertThat(r.success()).isTrue();
        assertThat(r.role()).isEqualTo("MANAGER");
        assertThat(r.accountStatus()).isEqualTo("PENDING_APPROVAL");
    }

    @Test
    void linksExistingPasswordAccountByVerifiedEmail() {
        Player existing = player("hamza@x.com", "PLAYER");
        when(userRepository.findByEmail("hamza@x.com")).thenReturn(Optional.of(existing));

        LoginResponse r = service.signIn(google("hamza@x.com", true), "PLAYER");

        assertThat(r.success()).isTrue();
        assertThat(r.playerID()).isEqualTo("U-1");
        assertThat(existing.getAuthProvider()).isEqualTo("GOOGLE");
        assertThat(existing.getPasswordHash()).isEqualTo("$2a$hash");
    }

    @Test
    void refusesUnverifiedEmailForLinkingOrCreating() {
        when(userRepository.findByEmail("hamza@x.com")).thenReturn(Optional.of(player("hamza@x.com", "PLAYER")));

        LoginResponse r = service.signIn(google("hamza@x.com", false), "PLAYER");

        assertThat(r.success()).isFalse();
        assertThat(r.message()).isEqualTo("EMAIL_NOT_VERIFIED");
        verify(userRepository, never()).save(any());
    }

    @Test
    void alreadyLinkedAccountSignsInEvenIfEmailUnverified() {
        Player linked = player("hamza@x.com", "PLAYER");
        when(userRepository.findByAuthProviderAndProviderId("GOOGLE", "g-123")).thenReturn(Optional.of(linked));

        assertThat(service.signIn(google("hamza@x.com", false), "PLAYER").success()).isTrue();
    }

    @Test
    void rejectsRoleMismatch() {
        when(userRepository.findByEmail("m@x.com")).thenReturn(Optional.of(player("m@x.com", "MANAGER")));

        LoginResponse r = service.signIn(google("m@x.com", true), "PLAYER");

        assertThat(r.success()).isFalse();
        assertThat(r.message()).isEqualTo("ROLE_MISMATCH:MANAGER");
    }

    @Test
    void rejectsAccountPendingDeletion() {
        Player p = player("d@x.com", "PLAYER");
        p.setDeletionStatus("PENDING");
        when(userRepository.findByEmail("d@x.com")).thenReturn(Optional.of(p));

        assertThat(service.signIn(google("d@x.com", true), "PLAYER").message()).isEqualTo("ACCOUNT_PENDING_DELETION");
    }

    @Test
    void adminCannotUseSocialLogin() {
        LoginResponse r = service.signIn(google("admin.playfair@gmail.com", true), null);

        assertThat(r.message()).isEqualTo("ADMIN_OAUTH_NOT_SUPPORTED");
        verify(userRepository, never()).save(any());
    }
}
