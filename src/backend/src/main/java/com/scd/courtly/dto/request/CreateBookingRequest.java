package com.scd.courtly.dto.request;

import jakarta.validation.constraints.NotBlank;

public record CreateBookingRequest(
    @NotBlank String playerID,
    @NotBlank String courtID,
    @NotBlank String bookingDate,
    @NotBlank String timeSlot
) {}
