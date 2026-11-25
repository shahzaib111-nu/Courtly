package com.scd.courtly.repository;

import com.scd.courtly.model.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, String> {
    Optional<Payment> findByBookingID(String bookingID);
    boolean existsByReceiptNo(String receiptNo);
}
