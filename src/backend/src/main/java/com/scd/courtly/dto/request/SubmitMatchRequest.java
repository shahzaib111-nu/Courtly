package com.scd.courtly.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record SubmitMatchRequest(
    @NotBlank String bookingID,
    @NotBlank String playerID,
    @NotBlank String opponentName,
    @NotNull @Min(0) @Max(999) Integer playerScore,
    @NotNull @Min(0) @Max(999) Integer opponentScore,
    @NotBlank @Pattern(regexp = "(?i)WIN|LOSS|DRAW") String result
) {}
