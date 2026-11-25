package com.scd.courtly.controller;

import com.scd.courtly.support.IntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Only security and validation are tested here: a valid request would call the real
 * Stripe API, which is an external paid service and must not be hit from unit tests.
 */
@DisplayName("Payments API  /api/payments")
class PaymentControllerTest extends IntegrationTest {

    @Test
    @DisplayName("POST /create-payment-intent without a token → 401")
    void anonymous() throws Exception {
        mockMvc.perform(post("/api/payments/create-payment-intent")
                .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("amount", 1200))))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /create-payment-intent with amount below 1 → 400 (before Stripe is called)")
    void invalidAmount() throws Exception {
        mockMvc.perform(post("/api/payments/create-payment-intent").header("Authorization", playerToken())
                .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("amount", 0))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.fieldErrors.amount").exists());
    }
}
