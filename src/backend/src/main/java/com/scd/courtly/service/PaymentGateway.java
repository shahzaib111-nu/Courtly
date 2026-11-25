package com.scd.courtly.service;

import com.scd.courtly.model.Payment;
import org.springframework.stereotype.Component;

@Component
public class PaymentGateway {

    /**
     * Matches DCD: processTransaction(bookingID, amount, method) : Payment
     */
    public Payment processTransaction(String bookingID, double amount, String method) {
        Payment payment = new Payment();
        // Logic: Interact with Stripe API and return Payment object with status [cite: 63, 86]
        return payment;
    }

    /**
     * Matches DCD: issueRefund(paymentID) : bool
     */
    public boolean issueRefund(String paymentID) {
        // Logic: Request refund from Stripe [cite: 86]
        return true;
    }
}