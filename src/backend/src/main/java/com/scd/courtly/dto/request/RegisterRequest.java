package com.scd.courtly.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import com.fasterxml.jackson.annotation.JsonAlias;

public record RegisterRequest(
    @NotBlank @Size(min = 2, max = 100) String name,
    @NotBlank @Email String email,
    @JsonAlias({"password", "passwordHash"}) @NotBlank @Size(min = 8, max = 100) String password,
    @NotBlank @Size(max = 30) String phone,
    @NotBlank String dateOfBirth,
    @NotBlank String role
) {}
