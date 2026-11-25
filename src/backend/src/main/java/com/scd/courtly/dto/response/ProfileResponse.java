package com.scd.courtly.dto.response;

public record ProfileResponse(
    String name,
    String email,
    String username,
    String phone,
    String dateOfBirth,
    String category,       // REGULAR, STUDENT, SENIOR, FAMILY or GROUP
    Integer groupSize,
    String studentId,
    String universityEmail,
    Integer familySize,
    String leadMemberName,
    String discountTier,
    String accountStatus,
    String deletionStatus,
    String authProvider,   // LOCAL, GOOGLE or GITHUB
    boolean hasPassword    // false for accounts created through Google/GitHub until a password is set
) {}
