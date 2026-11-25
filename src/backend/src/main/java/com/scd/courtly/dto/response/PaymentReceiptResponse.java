package com.scd.courtly.dto.response;

/** Digital receipt for a completed payment (FR-24). */
public record PaymentReceiptResponse(
    String receiptNo,
    String paymentID,
    String status,
    String bookingID,
    String playerName,
    String courtName,
    String bookingDate,
    String timeSlot,
    boolean peakHour,
    double subtotal,
    double discount,
    double amountPaid,
    String cardBrand,
    String maskedCard,      // "•••• 4242"
    String transactionRef,
    String paidAt
) {}
