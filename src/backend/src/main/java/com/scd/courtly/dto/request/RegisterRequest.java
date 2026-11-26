package com.scd.courtly.dto.request;

import com.scd.courtly.validation.PakistaniPhone;
import com.scd.courtly.validation.Rules;
import com.scd.courtly.validation.StrongPassword;
import com.scd.courtly.validation.ValidDateOfBirth;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import com.fasterxml.jackson.annotation.JsonAlias;

public record RegisterRequest(
    @NotBlank @Pattern(regexp = Rules.NAME, message = Rules.NAME_MESSAGE) String name,
    @NotBlank @Size(max = 100) @Pattern(regexp = Rules.EMAIL, message = Rules.EMAIL_MESSAGE) String email,
    @Pattern(regexp = "^$|" + PlayerFields.USERNAME_REGEX, message = PlayerFields.USERNAME_MESSAGE) String username,
    @JsonAlias({"password", "passwordHash"}) @NotBlank @StrongPassword String password,
    @NotBlank @PakistaniPhone String phone,
    @NotBlank @ValidDateOfBirth String dateOfBirth,
    @NotBlank @Pattern(regexp = "(?i)PLAYER|MANAGER", message = "Role must be PLAYER or MANAGER") String role,
    @Pattern(regexp = "^$|" + PlayerFields.CATEGORY_REGEX, message = PlayerFields.CATEGORY_MESSAGE) String category,
    @Min(value = 2, message = "A group has at least 2 people") @Max(value = 50, message = "A group can have at most 50 people") Integer groupSize,
    @Pattern(regexp = "^$|" + Rules.STUDENT_ID, message = Rules.STUDENT_ID_MESSAGE) String studentId,
    @Size(max = 100) @Pattern(regexp = "^$|" + Rules.UNIVERSITY_EMAIL, message = Rules.UNIVERSITY_EMAIL_MESSAGE) String universityEmail,
    @Min(value = 2, message = "A family has at least 2 members") @Max(value = 20, message = "A family can have at most 20 members") Integer familySize,
    @Pattern(regexp = "^$|" + Rules.NAME, message = Rules.NAME_MESSAGE) String leadMemberName
) {}
