package com.scd.courtly.dto.response;

/** Everything the checkout page shows, calculated by the server. */
public record CheckoutResponse(
    String bookingID,
    String paymentIntentID,
    String clientSecret,
    String publishableKey,
    String courtName,
    String sportType,
    String bookingDate,
    String timeSlot,
    boolean peakHour,
    double subtotal,        // before discount
    double discount,        // PKR off
    double amount,          // PKR to pay
    String currency,
    String paymentDeadline  // ISO local date-time; the slot is released after this (NFR 3.2)
) {}
