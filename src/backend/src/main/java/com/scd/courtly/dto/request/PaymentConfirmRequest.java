package com.scd.courtly.dto.request;

import jakarta.validation.constraints.NotBlank;

/** Sent after Stripe reports success in the browser; the server re-checks it with Stripe. */
public record PaymentConfirmRequest(@NotBlank String bookingID, @NotBlank String paymentIntentID) {}
