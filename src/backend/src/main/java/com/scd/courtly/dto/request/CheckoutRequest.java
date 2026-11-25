package com.scd.courtly.dto.request;

import jakarta.validation.constraints.NotBlank;

/** Starts payment for one of the caller's PENDING bookings. The amount comes from the booking. */
public record CheckoutRequest(@NotBlank String bookingID) {}
