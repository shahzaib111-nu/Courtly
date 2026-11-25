package com.scd.courtly;

import com.scd.courtly.support.IntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Application starts")
class CourtlyApplicationTests extends IntegrationTest {

    @Test
    @DisplayName("Spring context loads and seed data is present")
    void contextLoads() {
        assertThat(playerRepository.count()).isGreaterThanOrEqualTo(10);
    }
}
