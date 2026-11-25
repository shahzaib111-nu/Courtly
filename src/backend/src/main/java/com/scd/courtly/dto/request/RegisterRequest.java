package com.scd.courtly.dto.request;

import com.scd.courtly.validation.StrongPassword;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import com.fasterxml.jackson.annotation.JsonAlias;

public record RegisterRequest(
    @NotBlank @Size(min = 2, max = 100) String name,
    @NotBlank @Email String email,
    @Pattern(regexp = "^$|" + PlayerFields.USERNAME_REGEX, message = PlayerFields.USERNAME_MESSAGE) String username,
    @JsonAlias({"password", "passwordHash"}) @NotBlank @StrongPassword String password,
    @NotBlank @Size(max = 30) String phone,
    @NotBlank String dateOfBirth,
    @NotBlank String role,
    @Pattern(regexp = "^$|" + PlayerFields.CATEGORY_REGEX, message = PlayerFields.CATEGORY_MESSAGE) String category,
    @Min(2) @Max(50) Integer groupSize
) {}
