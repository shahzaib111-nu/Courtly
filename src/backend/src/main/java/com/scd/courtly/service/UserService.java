package com.scd.courtly.service;

import com.scd.courtly.exception.ConflictException;
import com.scd.courtly.model.User;
import com.scd.courtly.repository.UserRepository;
import com.scd.courtly.dto.response.LoginResponse;
import com.scd.courtly.security.AdminAccount;
import com.scd.courtly.security.JwtService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Service
public class UserService {

    /** NFR 2.1.2: this many wrong passwords in a row lock the account ... */
    public static final int MAX_FAILED_LOGINS = 5;
    /** ... for this long. */
    public static final Duration LOCKOUT_DURATION = Duration.ofMinutes(10);

    /** Failure codes returned in {@link LoginResponse#message()}. */
    public static final String EMAIL_NOT_FOUND = "EMAIL_NOT_FOUND";
    public static final String INVALID_CREDENTIALS = "INVALID_CREDENTIALS";
    public static final String ACCOUNT_PENDING_DELETION = "ACCOUNT_PENDING_DELETION";
    public static final String ACCOUNT_LOCKED = "ACCOUNT_LOCKED";   // sent as "ACCOUNT_LOCKED:<minutes left>"

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private AdminAccount adminAccount;

    // The admin has no database row, so its lockout state lives in memory.
    private int adminFailedAttempts;
    private LocalDateTime adminLockedUntil;

    /** Returns null when the e-mail is already registered; throws ConflictException for a taken username. */
    public User register(User userData) {
        Optional<User> existing = userRepository.findByEmailIgnoreCase(userData.getEmail());
        if (existing.isPresent()) {
            return null;
        }
        String username = normalizeUsername(userData.getUsername());
        if (username != null && userRepository.existsByUsername(username)) {
            throw new ConflictException("That username is already taken. Please choose another.");
        }
        userData.setUsername(username);
        userData.setUserID("U-" + UUID.randomUUID().toString().substring(0, 8));
        userData.setPasswordHash(passwordEncoder.encode(userData.getPasswordHash()));
        userData.setAuthProvider("LOCAL");
        userData.setAccountStatus("MANAGER".equalsIgnoreCase(userData.getRole()) ? "PENDING_APPROVAL" : "Active");
        userData.setFailedLoginAttempts(0);
        return userRepository.save(userData);
    }

    /** Blank becomes null; otherwise trimmed and lower-cased so usernames are case-insensitive. */
    public static String normalizeUsername(String username) {
        if (username == null || username.isBlank()) return null;
        return username.trim().toLowerCase(Locale.ROOT);
    }

    /** Finds an account by e-mail, or by username when the identifier has no '@' (FR-5). */
    public Optional<User> findByIdentifier(String identifier) {
        if (identifier == null || identifier.isBlank()) return Optional.empty();
        String id = identifier.trim();
        return id.contains("@")
            ? userRepository.findByEmailIgnoreCase(id)
            : userRepository.findByUsername(normalizeUsername(id));
    }

    /**
     * @param identifier e-mail address or username
     */
    public LoginResponse login(String identifier, String password, String requestedRole) {
        if (adminAccount.isAdminEmail(identifier)) {
            return adminLogin(password, requestedRole);
        }
        Optional<User> user = findByIdentifier(identifier);
        if (user.isEmpty()) {
            return LoginResponse.failure(EMAIL_NOT_FOUND);
        }
        User u = user.get();
        String ds = u.getDeletionStatus();
        if ("PENDING".equals(ds) || "ARCHIVED".equals(ds)) {
            return LoginResponse.failure(ACCOUNT_PENDING_DELETION);
        }
        LocalDateTime now = LocalDateTime.now();
        if (u.getLockedUntil() != null && u.getLockedUntil().isAfter(now)) {
            return locked(u.getLockedUntil(), now);
        }
        if (!passwordMatches(password, u.getPasswordHash())) {
            int failures = (u.getFailedLoginAttempts() == null ? 0 : u.getFailedLoginAttempts()) + 1;
            if (failures >= MAX_FAILED_LOGINS) {
                u.setFailedLoginAttempts(0);
                u.setLockedUntil(now.plus(LOCKOUT_DURATION));
                userRepository.save(u);
                return locked(u.getLockedUntil(), now);
            }
            u.setFailedLoginAttempts(failures);
            u.setLockedUntil(null);
            userRepository.save(u);
            return LoginResponse.failure(INVALID_CREDENTIALS);
        }

        boolean dirty = false;
        if (u.getPasswordHash() != null && !u.getPasswordHash().startsWith("$2")) {
            u.setPasswordHash(passwordEncoder.encode(password));
            dirty = true;
        }
        if ((u.getFailedLoginAttempts() != null && u.getFailedLoginAttempts() != 0) || u.getLockedUntil() != null) {
            u.setFailedLoginAttempts(0);
            u.setLockedUntil(null);
            dirty = true;
        }
        if (dirty) userRepository.save(u);

        String actualRole = u.getRole() != null ? u.getRole() : "PLAYER";
        if (requestedRole != null && !requestedRole.isBlank()
                && !actualRole.equalsIgnoreCase(requestedRole)) {
            return LoginResponse.failure("ROLE_MISMATCH:" + actualRole);
        }
        String accountStatus = "MANAGER".equalsIgnoreCase(actualRole) ? u.getAccountStatus() : null;
        String token = jwtService.generateToken(u.getEmail(), actualRole, u.getUserID());
        return new LoginResponse(true, actualRole, null, u.getUserID(), u.getName(), u.getEmail(),
            accountStatus, token, jwtService.getExpirationMs());
    }

    private synchronized LoginResponse adminLogin(String password, String requestedRole) {
        LocalDateTime now = LocalDateTime.now();
        if (adminLockedUntil != null && adminLockedUntil.isAfter(now)) {
            return locked(adminLockedUntil, now);
        }
        if (!adminAccount.matches(adminAccount.email(), password)) {
            if (++adminFailedAttempts >= MAX_FAILED_LOGINS) {
                adminFailedAttempts = 0;
                adminLockedUntil = now.plus(LOCKOUT_DURATION);
                return locked(adminLockedUntil, now);
            }
            return LoginResponse.failure(INVALID_CREDENTIALS);
        }
        adminFailedAttempts = 0;
        adminLockedUntil = null;
        if ("PLAYER".equalsIgnoreCase(requestedRole)) {
            return LoginResponse.failure("ROLE_MISMATCH:ADMIN");
        }
        String token = jwtService.generateToken(adminAccount.email(), "ADMIN", AdminAccount.USER_ID);
        return new LoginResponse(true, "ADMIN", null, null, "Admin", adminAccount.email(),
            null, token, jwtService.getExpirationMs());
    }

    private static LoginResponse locked(LocalDateTime until, LocalDateTime now) {
        long minutes = Math.max(1, (Duration.between(now, until).toSeconds() + 59) / 60);
        return LoginResponse.failure(ACCOUNT_LOCKED + ":" + minutes);
    }

    /** Clears a lockout, e.g. after the user proves ownership of the e-mail with an OTP reset. */
    public void clearLockout(User u) {
        u.setFailedLoginAttempts(0);
        u.setLockedUntil(null);
    }

    private boolean passwordMatches(String rawPassword, String storedPassword) {
        if (storedPassword == null || rawPassword == null) return false;
        if (storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$") || storedPassword.startsWith("$2y$")) {
            return passwordEncoder.matches(rawPassword, storedPassword);
        }
        return rawPassword.equals(storedPassword);
    }

    public void logout(String userID) {
    }
}
