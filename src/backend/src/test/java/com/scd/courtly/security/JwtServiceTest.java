package com.scd.courtly.security;

import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("unit")
@DisplayName("JwtService")
class JwtServiceTest {

    private JwtService jwt;

    private JwtService create(String secret, long expirationMs) {
        JwtService s = new JwtService();
        ReflectionTestUtils.setField(s, "secret", secret);
        ReflectionTestUtils.setField(s, "expirationMs", expirationMs);
        return s;
    }

    @BeforeEach
    void setUp() {
        jwt = create("unit-test-secret-that-is-long-enough-123", 60_000);
    }

    @Test
    @DisplayName("token carries subject, role and user id")
    void roundTrip() {
        String token = jwt.generateToken("p@x.com", "PLAYER", "PLR001");

        Claims claims = jwt.extractClaims(token);
        assertThat(jwt.isTokenValid(token)).isTrue();
        assertThat(jwt.extractSubject(token)).isEqualTo("p@x.com");
        assertThat(claims.get("role")).isEqualTo("PLAYER");
        assertThat(claims.get("userId")).isEqualTo("PLR001");
    }

    @Test
    @DisplayName("expired tokens are invalid")
    void expired() {
        JwtService shortLived = create("unit-test-secret-that-is-long-enough-123", -1_000);
        assertThat(shortLived.isTokenValid(shortLived.generateToken("p@x.com", "PLAYER", "1"))).isFalse();
    }

    @Test
    @DisplayName("tampered or foreign tokens are invalid")
    void tampered() {
        String token = jwt.generateToken("p@x.com", "PLAYER", "1");
        JwtService other = create("a-completely-different-secret-value-456", 60_000);

        assertThat(jwt.isTokenValid(token + "x")).isFalse();
        assertThat(other.isTokenValid(token)).isFalse();
        assertThat(jwt.isTokenValid("not-a-jwt")).isFalse();
    }

    @Test
    @DisplayName("short secrets are padded instead of crashing")
    void shortSecret() {
        JwtService weak = create("short", 60_000);
        assertThat(weak.isTokenValid(weak.generateToken("p@x.com", "PLAYER", "1"))).isTrue();
    }
}
