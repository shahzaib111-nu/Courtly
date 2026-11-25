package com.scd.courtly.dto.response;

public record RegistrationResponse(
    String userID,
    String name,
    String email,
    String role,
    String accountStatus
) {}
