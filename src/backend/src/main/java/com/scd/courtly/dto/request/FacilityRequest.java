package com.scd.courtly.dto.request;

import com.scd.courtly.validation.Rules;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Facility information an arena manager can update (FR-32). */
public record FacilityRequest(
    @NotBlank @Size(min = 2, max = 100) @Pattern(regexp = "^(?=.*\\p{L})[\\p{L}\\d .,'&()-]+$",
        message = "Use letters, numbers, spaces and . , ' & ( ) -") String name,
    @NotBlank @Size(min = 5, max = 200, message = "Enter the full location (5-200 characters)") String location,
    @NotBlank @Pattern(regexp = Rules.TIME, message = "Use HH:mm (24-hour)") String openingTime,
    @NotBlank @Pattern(regexp = Rules.TIME, message = "Use HH:mm (24-hour)") String closingTime
) {}
