package com.scd.courtly.security.oauth2;

/**
 * Provider-independent view of the account returned by Google or GitHub.
 *
 * @param provider      "GOOGLE" or "GITHUB"
 * @param providerId    stable id of the account at the provider
 * @param email         email address (may be null if the provider shares none)
 * @param emailVerified whether the provider confirmed the address belongs to the user
 * @param name          display name
 */
public record OAuth2UserProfile(
    String provider,
    String providerId,
    String email,
    boolean emailVerified,
    String name
) {}
