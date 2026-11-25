package com.scd.courtly.dto.request;

import com.scd.courtly.validation.StrongPassword;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record ChangePasswordRequest(
    @NotBlank @Email String email,
    String currentPassword, // not needed when the account has no password yet (Google/GitHub sign-up)
    @NotBlank @StrongPassword String newPassword
) {}
