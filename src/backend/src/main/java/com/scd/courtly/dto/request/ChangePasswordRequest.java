package com.scd.courtly.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
    @NotBlank @Email String email,
    String currentPassword, // not needed when the account has no password yet (Google/GitHub sign-up)
    @NotBlank @Size(min = 8, max = 100) String newPassword
) {}
