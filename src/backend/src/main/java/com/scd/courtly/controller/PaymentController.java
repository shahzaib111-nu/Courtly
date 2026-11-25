package com.scd.courtly.controller;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import com.stripe.param.PaymentIntentCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.scd.courtly.dto.request.PaymentIntentRequest;
import com.scd.courtly.dto.response.PaymentIntentResponse;
import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    @Value("${stripe.api.secret.key}")
    private String stripeSecretKey;

    @PostMapping("/create-payment-intent")
    @PreAuthorize("hasRole('USER')")
    public PaymentIntentResponse createPaymentIntent(@Valid @RequestBody(required = false) PaymentIntentRequest request)
            throws StripeException {
        Stripe.apiKey = stripeSecretKey;

        long amount = 500L;
        if (request != null && request.amount() != null) {
            amount = request.amount();
        }

        PaymentIntentCreateParams params = PaymentIntentCreateParams.builder()
                .setAmount(amount * 100L)
                .setCurrency("pkr")
                .build();

        PaymentIntent intent = PaymentIntent.create(params);
        return new PaymentIntentResponse(intent.getClientSecret());
    }
}
