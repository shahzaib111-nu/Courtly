package com.scd.courtly.dto.request;

import com.scd.courtly.validation.StrongPassword;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record OtpResetPasswordRequest(
    @NotBlank @Email String email,
    @NotBlank @Pattern(regexp = "\\d{6}") String otp,
    @NotBlank @StrongPassword String newPassword
) {}
