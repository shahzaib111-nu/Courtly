package com.scd.courtly.service;

import com.scd.courtly.exception.BusinessException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Tag("unit")
@DisplayName("PaymentGateway")
class PaymentGatewayTest {

    @Test
    @DisplayName("without a Stripe key, payments fail with a clear 503 instead of calling Stripe")
    void notConfigured() {
        PaymentGateway gateway = new PaymentGateway("");
        assertThatThrownBy(() -> gateway.createIntent("B1", 100_000))
            .isInstanceOf(BusinessException.class)
            .hasMessage("Online payments are not configured on this server")
            .extracting(e -> ((BusinessException) e).getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }
}
