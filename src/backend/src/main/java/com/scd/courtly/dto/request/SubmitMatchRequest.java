package com.scd.courtly.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SubmitMatchRequest(
    @NotBlank String bookingID,
    @NotBlank String playerID,
    @NotBlank @Size(min = 2, max = 100, message = "Opponent: 2-100 characters (a name, username or e-mail)") String opponentName,
    @NotNull @Min(0) @Max(999) Integer playerScore,
    @NotNull @Min(0) @Max(999) Integer opponentScore,
    @NotBlank @Pattern(regexp = "(?i)WIN|LOSS|DRAW") String result
) {}
