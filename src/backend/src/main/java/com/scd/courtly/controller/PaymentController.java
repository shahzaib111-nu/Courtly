package com.scd.courtly.controller;

import com.scd.courtly.dto.request.CheckoutRequest;
import com.scd.courtly.dto.request.PaymentConfirmRequest;
import com.scd.courtly.dto.response.CheckoutResponse;
import com.scd.courtly.dto.response.PaymentReceiptResponse;
import com.scd.courtly.service.PaymentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Card payments for bookings.
 *
 *  POST /api/payments/create-payment-intent  { bookingID }                  → amount + Stripe client secret
 *  POST /api/payments/confirm                { bookingID, paymentIntentID } → receipt (booking becomes CONFIRMED)
 *  GET  /api/payments/booking/{bookingID}                                   → receipt (owner or admin)
 */
@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping("/create-payment-intent")
    @PreAuthorize("hasRole('USER')")
    public CheckoutResponse createPaymentIntent(@Valid @RequestBody CheckoutRequest request, Authentication auth) {
        return paymentService.startCheckout(request.bookingID(), auth.getName());
    }

    @PostMapping("/confirm")
    @PreAuthorize("hasRole('USER')")
    public PaymentReceiptResponse confirm(@Valid @RequestBody PaymentConfirmRequest request, Authentication auth) {
        return paymentService.confirmPayment(request.bookingID(), request.paymentIntentID(), auth.getName());
    }

    @GetMapping("/booking/{bookingID}")
    @PreAuthorize("hasRole('USER')")
    public PaymentReceiptResponse receipt(@PathVariable String bookingID, Authentication auth) {
        boolean isAdmin = auth.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        return paymentService.getReceipt(bookingID, auth.getName(), isAdmin);
    }
}
