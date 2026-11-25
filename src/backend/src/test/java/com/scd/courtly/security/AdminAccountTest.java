package com.scd.courtly.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("unit")
@DisplayName("AdminAccount")
class AdminAccountTest {

    private final AdminAccount admin = new AdminAccount("admin@courtly.test", "S3cret-pass");

    @Test
    @DisplayName("accepts only the configured e-mail and password")
    void matches() {
        assertThat(admin.matches("admin@courtly.test", "S3cret-pass")).isTrue();
        assertThat(admin.matches("ADMIN@courtly.test", "S3cret-pass")).isTrue();   // e-mail is case-insensitive
        assertThat(admin.matches("admin@courtly.test", "s3cret-pass")).isFalse();  // password is not
        assertThat(admin.matches("other@courtly.test", "S3cret-pass")).isFalse();
        assertThat(admin.matches("admin@courtly.test", null)).isFalse();
    }

    @Test
    @DisplayName("without a configured password, admin login is disabled")
    void disabledWithoutPassword() {
        AdminAccount noPassword = new AdminAccount("admin@courtly.test", "");
        assertThat(noPassword.isEnabled()).isFalse();
        assertThat(noPassword.matches("admin@courtly.test", "")).isFalse();
    }
}
