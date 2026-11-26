package com.scd.courtly.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record CreateBookingRequest(
    @NotBlank String playerID,
    @NotBlank String courtID,
    @NotBlank @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}", message = "Use the date format YYYY-MM-DD") String bookingDate,
    @NotBlank @Pattern(regexp = "([01]\\d|2[0-3]):[0-5]\\d-([01]\\d|2[0-3]):[0-5]\\d",
        message = "Use the time slot format HH:mm-HH:mm") String timeSlot
) {}
