package com.scd.courtly.service;

import com.scd.courtly.dto.response.LoginResponse;
import com.scd.courtly.model.Player;
import com.scd.courtly.model.User;
import com.scd.courtly.repository.UserRepository;
import com.scd.courtly.security.JwtService;
import com.scd.courtly.security.oauth2.OAuth2UserProfile;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

/**
 * Business logic for Google / GitHub sign-in: finds the matching Courtly
 * account (or links / creates one) and issues the same JWT as password login.
 *
 * Failure codes returned in {@link LoginResponse#message()}:
 * ADMIN_OAUTH_NOT_SUPPORTED, EMAIL_NOT_VERIFIED, ACCOUNT_PENDING_DELETION, ROLE_MISMATCH:&lt;role&gt;.
 */
@Service
@RequiredArgsConstructor
public class OAuth2AccountService {

    private static final String ADMIN_EMAIL = "admin.playfair@gmail.com";

    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final JwtService jwtService;

    @Transactional
    public LoginResponse signIn(OAuth2UserProfile profile, String requestedRole) {
        String role = "MANAGER".equalsIgnoreCase(requestedRole) ? "MANAGER" : "PLAYER";

        // The admin account is not stored in the database and keeps password-only login.
        if (ADMIN_EMAIL.equalsIgnoreCase(profile.email())) {
            return LoginResponse.failure("ADMIN_OAUTH_NOT_SUPPORTED");
        }

        Optional<User> linked = userRepository.findByAuthProviderAndProviderId(profile.provider(), profile.providerId());
        User user;
        if (linked.isPresent()) {
            user = linked.get();
        } else {
            // Matching or creating by email is only safe when the provider has verified the address.
            if (!profile.emailVerified()) {
                return LoginResponse.failure("EMAIL_NOT_VERIFIED");
            }
            Optional<User> byEmail = userRepository.findByEmail(profile.email());
            user = byEmail.map(existing -> linkProvider(existing, profile))
                          .orElseGet(() -> createAccount(profile, role));
        }

        String ds = user.getDeletionStatus();
        if ("PENDING".equals(ds) || "ARCHIVED".equals(ds)) {
            return LoginResponse.failure("ACCOUNT_PENDING_DELETION");
        }

        String actualRole = user.getRole() != null ? user.getRole() : "PLAYER";
        if (requestedRole != null && !requestedRole.isBlank() && !actualRole.equalsIgnoreCase(requestedRole)) {
            return LoginResponse.failure("ROLE_MISMATCH:" + actualRole);
        }

        String accountStatus = "MANAGER".equalsIgnoreCase(actualRole) ? user.getAccountStatus() : null;
        String token = jwtService.generateToken(user.getEmail(), actualRole, user.getUserID());
        return new LoginResponse(true, actualRole, null, user.getUserID(), user.getName(),
            accountStatus, token, jwtService.getExpirationMs());
    }

    /** An existing email/password account signs in with a provider for the first time. */
    private User linkProvider(User user, OAuth2UserProfile profile) {
        if (user.getAuthProvider() == null || "LOCAL".equals(user.getAuthProvider())) {
            user.setAuthProvider(profile.provider());
            user.setProviderId(profile.providerId());
            return userRepository.save(user);
        }
        return user; // already linked to the other provider; the verified email still identifies it
    }

    private User createAccount(OAuth2UserProfile profile, String role) {
        Player player = new Player();
        player.setUserID("U-" + UUID.randomUUID().toString().substring(0, 8));
        player.setName(profile.name() != null && !profile.name().isBlank() ? profile.name() : profile.email());
        player.setEmail(profile.email());
        player.setPasswordHash(null); // social-only account; a password can be added via "Forgot password"
        player.setRole(role);
        player.setAccountStatus("MANAGER".equals(role) ? "PENDING_APPROVAL" : "Active");
        player.setAuthProvider(profile.provider());
        player.setProviderId(profile.providerId());
        User saved = userRepository.save(player);

        String providerLabel = "GOOGLE".equals(profile.provider()) ? "Google" : "GitHub";
        String roleLabel = "MANAGER".equals(role) ? "Arena Manager" : "Player";
        notificationService.create(
            NotificationService.ADMIN_USER_ID,
            "NEW_REGISTRATION",
            "New User Registration",
            saved.getName() + " (" + saved.getEmail() + ") has registered as a " + roleLabel
                + " using " + providerLabel + ".");
        notificationService.create(
            saved.getUserID(),
            "NEW_REGISTRATION",
            "Welcome to Courtly!",
            "MANAGER".equals(role)
                ? "Welcome to Courtly, " + saved.getName() + "! Your Arena Manager account is pending admin approval. You'll be notified once reviewed."
                : "Welcome to Courtly, " + saved.getName() + "! Your account is ready. Start booking courts now.");
        return saved;
    }
}
