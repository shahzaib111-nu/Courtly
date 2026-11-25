package com.scd.courtly.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Editable profile fields (FR-10). The e-mail is the account identity and cannot be changed here. */
public record UpdateProfileRequest(
    @NotBlank @Size(min = 2, max = 100) String name,
    @Pattern(regexp = "^$|" + PlayerFields.USERNAME_REGEX, message = PlayerFields.USERNAME_MESSAGE) String username,
    @NotBlank @Size(max = 30) String phone,
    @NotBlank String dateOfBirth,
    @Pattern(regexp = "^$|" + PlayerFields.CATEGORY_REGEX, message = PlayerFields.CATEGORY_MESSAGE) String category,
    @Min(2) @Max(50) Integer groupSize,
    @Size(max = 30) String studentId,
    @Email @Size(max = 100) String universityEmail,
    @Min(2) @Max(20) Integer familySize,
    @Size(max = 100) String leadMemberName
) {}
