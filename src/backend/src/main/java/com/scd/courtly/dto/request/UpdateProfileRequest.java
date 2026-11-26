package com.scd.courtly.dto.request;

import com.scd.courtly.validation.PakistaniPhone;
import com.scd.courtly.validation.Rules;
import com.scd.courtly.validation.ValidDateOfBirth;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Editable profile fields (FR-10). The e-mail is the account identity and cannot be changed here. */
public record UpdateProfileRequest(
    @NotBlank @Pattern(regexp = Rules.NAME, message = Rules.NAME_MESSAGE) String name,
    @Pattern(regexp = "^$|" + PlayerFields.USERNAME_REGEX, message = PlayerFields.USERNAME_MESSAGE) String username,
    @NotBlank @PakistaniPhone String phone,
    @NotBlank @ValidDateOfBirth String dateOfBirth,
    @Pattern(regexp = "^$|" + PlayerFields.CATEGORY_REGEX, message = PlayerFields.CATEGORY_MESSAGE) String category,
    @Min(value = 2, message = "A group has at least 2 people") @Max(value = 50, message = "A group can have at most 50 people") Integer groupSize,
    @Pattern(regexp = "^$|" + Rules.STUDENT_ID, message = Rules.STUDENT_ID_MESSAGE) String studentId,
    @Size(max = 100) @Pattern(regexp = "^$|" + Rules.UNIVERSITY_EMAIL, message = Rules.UNIVERSITY_EMAIL_MESSAGE) String universityEmail,
    @Min(value = 2, message = "A family has at least 2 members") @Max(value = 20, message = "A family can have at most 20 members") Integer familySize,
    @Pattern(regexp = "^$|" + Rules.NAME, message = Rules.NAME_MESSAGE) String leadMemberName
) {}
