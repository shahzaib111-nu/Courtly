package com.scd.courtly.security;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * The built-in administrator. It has no database row; its e-mail comes from
 * {@code app.admin.email} and its password from {@code app.admin.password}
 * in secrets.yml, so no admin credential is stored in the source code.
 * If no password is configured, admin login is disabled.
 */
@Slf4j
@Component
public class AdminAccount {

    public static final String USER_ID = "ADMIN";

    private final String email;
    private final String password;

    public AdminAccount(@Value("${app.admin.email:admin.playfair@gmail.com}") String email,
                        @Value("${app.admin.password:}") String password) {
        this.email = email.trim();
        this.password = password;
    }

    @PostConstruct
    void warnIfDisabled() {
        if (!isEnabled()) {
            log.warn("Admin login is disabled: set app.admin.password in secrets.yml");
        }
    }

    public String email() {
        return email;
    }

    public boolean isEnabled() {
        return password != null && !password.isBlank();
    }

    public boolean isAdminEmail(String candidate) {
        return candidate != null && email.equalsIgnoreCase(candidate.trim());
    }

    /** Constant-time comparison so response timing reveals nothing about the password. */
    public boolean matches(String candidateEmail, String candidatePassword) {
        if (!isEnabled() || !isAdminEmail(candidateEmail) || candidatePassword == null) return false;
        return MessageDigest.isEqual(password.getBytes(StandardCharsets.UTF_8),
                                     candidatePassword.getBytes(StandardCharsets.UTF_8));
    }
}
