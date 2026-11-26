package com.scd.courtly.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SubmitRatingRequest(
    @NotBlank String bookingID,
    @NotBlank String playerID,
    @NotNull @Min(1) @Max(5) Integer ratingScore,
    @Size(max = 500, message = "Feedback can be at most 500 characters") String feedbackText
) {}
