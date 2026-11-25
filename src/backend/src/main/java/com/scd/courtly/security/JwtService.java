package com.scd.courtly.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Date;
import java.util.Map;

@Slf4j
@Service
public class JwtService {

    @Value("${jwt.secret:}")
    private String secret;

    @Value("${jwt.expiration-ms:3600000}")
    private long expirationMs;

    public String generateToken(String subject, String role, String userId) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);
        return Jwts.builder()
            .subject(subject)
            .claims(Map.of("role", role, "userId", userId))
            .issuedAt(now)
            .expiration(expiry)
            .signWith(getSigningKey())
            .compact();
    }

    public Claims extractClaims(String token) {
        return Jwts.parser().verifyWith(getSigningKey()).build().parseSignedClaims(token).getPayload();
    }

    public String extractSubject(String token) {
        return extractClaims(token).getSubject();
    }

    public boolean isTokenValid(String token) {
        try {
            Claims claims = extractClaims(token);
            return claims.getExpiration().after(new Date());
        } catch (Exception ignored) {
            return false;
        }
    }

    public long getExpirationMs() {
        return expirationMs;
    }

    /** The secret that used to be committed in application.properties: public, so never trusted. */
    static final String PUBLIC_DEFAULT_SECRET = "Courtly-Change-This-Secret-Key-In-Production-At-Least-32-Chars";

    private SecretKey signingKey;

    /**
     * Signs tokens with {@code jwt.secret} from secrets.yml. A missing, publicly known or short
     * (< 32 bytes) secret would let anyone forge tokens, so a random secret is used instead:
     * tokens then stay unforgeable, but users must sign in again after a restart.
     */
    private synchronized SecretKey getSigningKey() {
        if (signingKey == null) {
            byte[] keyBytes = secret == null ? new byte[0] : secret.getBytes(StandardCharsets.UTF_8);
            if (keyBytes.length < 32 || PUBLIC_DEFAULT_SECRET.equals(secret)) {
                log.warn("jwt.secret is missing, too short or the public default: using a random secret. "
                    + "Set jwt.secret in secrets.yml (at least 32 random characters) so logins survive restarts.");
                keyBytes = new byte[64];
                new SecureRandom().nextBytes(keyBytes);
            }
            signingKey = Keys.hmacShaKeyFor(keyBytes);
        }
        return signingKey;
    }
}
