package com.scd.courtly.dto.response;

public record LoginResponse(
    boolean success,
    String role,
    String message,
    String playerID,
    String name,
    String email,          // the account's e-mail, also when the user signed in with a username
    String accountStatus,
    String token,
    long expiresIn
) {
    public static LoginResponse failure(String message) {
        return new LoginResponse(false, null, message, null, null, null, null, null, 0);
    }
}
