package com.scd.courtly.dto.request;

import jakarta.validation.constraints.Min;

public record PaymentIntentRequest(@Min(1) Long amount) {}
