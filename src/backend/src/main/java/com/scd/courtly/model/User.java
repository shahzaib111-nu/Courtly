package com.scd.courtly.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.Date;

@Data
@NoArgsConstructor // Fixes the "Cannot construct instance" trap
@Entity
@Inheritance(strategy = InheritanceType.JOINED)
@Table(name = "app_users", // Fixes the H2 database restricted keyword crash!
       uniqueConstraints = @UniqueConstraint(name = "uk_user_oauth_identity",
                                             columnNames = {"authProvider", "providerId"}))
public abstract class User {
    @Id
    protected String userID;

    protected String name;
    protected String email;
    protected String passwordHash;
    protected String role;          // "PLAYER" or "MANAGER"
    protected String accountStatus;
    protected String sessionToken;
    protected String phone;
    protected String dateOfBirth;
    protected String deletionStatus;
    protected Date deletionRequestedAt;
    protected String otpCode;
    protected Date otpExpiry;

    // OAuth2 social login: "LOCAL" (email/password), "GOOGLE" or "GITHUB"
    protected String authProvider;
    // Stable account id issued by the OAuth2 provider (Google "sub", GitHub "id")
    protected String providerId;

    @Column(updatable = false)
    protected LocalDateTime createdAt;

    @PrePersist
    protected void setCreatedAt() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}