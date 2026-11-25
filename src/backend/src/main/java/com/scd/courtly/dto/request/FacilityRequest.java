package com.scd.courtly.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Facility information an arena manager can update (FR-32). */
public record FacilityRequest(
    @NotBlank @Size(min = 2, max = 100) String name,
    @NotBlank @Size(max = 200) String location,
    @NotBlank @Pattern(regexp = "([01]\\d|2[0-3]):[0-5]\\d", message = "Use HH:mm (24-hour)") String openingTime,
    @NotBlank @Pattern(regexp = "([01]\\d|2[0-3]):[0-5]\\d", message = "Use HH:mm (24-hour)") String closingTime
) {}
