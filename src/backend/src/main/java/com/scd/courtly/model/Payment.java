package com.scd.courtly.model;

import jakarta.persistence.*;
import java.util.Date;

@Entity
public class Payment {
    @Id
    private String paymentID; // Matches paymentID: string [cite: 63]
    
    private Date transactionDate; // Matches transactionDate: date [cite: 63]
    private double amount; // Matches amount: double [cite: 63]
    private String method; // Matches PaymentMethod enum (card, cash) [cite: 6, 63]
    private String status; // Matches PaymentStatus enum (success, failed, etc.) [cite: 5, 63]
    private String stripeTransactionRef; // Matches stripeTransactionRef: string [cite: 63]
}