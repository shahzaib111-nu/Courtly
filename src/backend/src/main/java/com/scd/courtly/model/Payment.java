package com.scd.courtly.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * A completed card payment for one booking (class diagram: Payment).
 * Only the details needed for receipts are stored; the card number itself
 * never reaches the server, only its last four digits (NFR 2.3.1).
 */
@Data
@NoArgsConstructor
@Entity
@Table(name = "payments")
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String paymentID;

    @Column(nullable = false, unique = true)
    private String bookingID;

    @Column(nullable = false)
    private String playerID;

    private double amount;                 // PKR actually charged

    private String method;                 // "CARD"

    @Column(nullable = false)
    private String status;                 // SUCCESS | REFUNDED

    @Column(unique = true)
    private String stripeTransactionRef;   // Stripe PaymentIntent id

    @Column(length = 4)
    private String maskedCard;             // last four digits only

    private String cardBrand;              // visa, mastercard, ...

    @Column(nullable = false, unique = true)
    private String receiptNo;              // e.g. CRT-20261125-7K2Q9F

    private LocalDateTime transactionDate;

    @PrePersist
    protected void setDefaults() {
        if (transactionDate == null) transactionDate = LocalDateTime.now();
    }
}
