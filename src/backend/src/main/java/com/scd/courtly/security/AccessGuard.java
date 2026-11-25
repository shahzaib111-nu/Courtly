package com.scd.courtly.security;

import com.scd.courtly.exception.ForbiddenException;
import com.scd.courtly.exception.NotFoundException;
import com.scd.courtly.exception.UnauthorizedException;
import com.scd.courtly.model.Court;
import com.scd.courtly.model.User;
import com.scd.courtly.repository.CourtRepository;
import com.scd.courtly.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Answers "who is calling?" from the verified JWT, never from request parameters,
 * and enforces that users only touch their own data (FR-8).
 *
 * Usage in a controller: {@code guard.requireSelfOrAdmin(playerID);}
 */
@Component
@RequiredArgsConstructor
public class AccessGuard {

    private final UserRepository userRepository;
    private final CourtRepository courtRepository;
    private final AdminAccount adminAccount;

    /** The authenticated caller. */
    public record Caller(String userId, String email, boolean admin, boolean manager) {}

    public Caller caller() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getName() == null || "anonymousUser".equals(auth.getName())) {
            throw new UnauthorizedException("Authentication is required");
        }
        boolean admin = hasRole(auth, "ROLE_ADMIN");
        boolean manager = hasRole(auth, "ROLE_MANAGER");
        if (admin && adminAccount.isAdminEmail(auth.getName())) {
            return new Caller(AdminAccount.USER_ID, auth.getName(), true, false);
        }
        User user = userRepository.findByEmail(auth.getName())
            .orElseThrow(() -> new UnauthorizedException("Your account no longer exists"));
        return new Caller(user.getUserID(), user.getEmail(), admin, manager);
    }

    /** The caller must be the given user, or an admin. */
    public Caller requireSelfOrAdmin(String userId) {
        Caller c = caller();
        if (!c.admin() && !c.userId().equals(userId)) {
            throw new ForbiddenException("You can only access your own account data.");
        }
        return c;
    }

    /** Same as {@link #requireSelfOrAdmin} but identified by e-mail address. */
    public Caller requireSelfEmailOrAdmin(String email) {
        Caller c = caller();
        if (!c.admin() && (email == null || !c.email().equalsIgnoreCase(email.trim()))) {
            throw new ForbiddenException("You can only access your own account data.");
        }
        return c;
    }

    /** The caller must manage this court, or be an admin. Returns the court. */
    public Court requireCourtManagerOrAdmin(String courtID) {
        Court court = courtRepository.findById(courtID)
            .orElseThrow(() -> new NotFoundException("Court not found"));
        Caller c = caller();
        if (!c.admin() && !c.userId().equals(court.getManagerId())) {
            throw new ForbiddenException("You can only manage your own courts.");
        }
        return court;
    }

    /** True if the caller manages the given court. */
    public boolean managesCourt(Caller c, String courtID) {
        return courtRepository.findById(courtID)
            .map(court -> c.userId().equals(court.getManagerId()))
            .orElse(false);
    }

    private static boolean hasRole(Authentication auth, String role) {
        return auth.getAuthorities().stream().anyMatch(a -> role.equals(a.getAuthority()));
    }
}
