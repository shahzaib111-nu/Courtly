package com.scd.courtly.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record SubmitMatchRequest(
    @NotBlank String bookingID,
    @NotBlank String playerID,
    @NotBlank String opponentName,
    @NotNull Integer playerScore,
    @NotNull Integer opponentScore,
    @NotBlank @Pattern(regexp = "(?i)WIN|LOSS|DRAW") String result
) {}
