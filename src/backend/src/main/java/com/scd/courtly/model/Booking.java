package com.scd.courtly.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "bookings", indexes = {
    // The searches the app runs most (NFR 1.2: results within 3-4 s on 50,000 bookings)
    @Index(name = "idx_booking_court_date", columnList = "courtID, bookingDate"),
    @Index(name = "idx_booking_player",     columnList = "playerID"),
    @Index(name = "idx_booking_status_date", columnList = "status, bookingDate"),
    @Index(name = "idx_booking_status_confirmed", columnList = "status, confirmedAt")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String bookingID;

    @Column(nullable = false)
    private String playerID;

    @Column(nullable = false)
    private String courtID;

    private String courtName;   // denormalized — avoids join on read
    private String sportType;   // denormalized

    @Column(nullable = false)
    private String bookingDate; // "YYYY-MM-DD"

    @Column(nullable = false)
    private String timeSlot;    // "HH:mm-HH:mm"

    private double baseRate;         // hourly rate at time of booking
    private double totalCost;        // final price after peak/weekend multipliers and discount
    private double discountApplied;  // PKR amount discounted from player tier
    private boolean peakHour;

    @Column(nullable = false)
    private String status;      // PENDING | CONFIRMED | COMPLETED | CANCELLED

    private LocalDateTime createdAt;

    private LocalDateTime confirmedAt;

    private LocalDateTime closedAt;

    @PrePersist
    protected void setDefaults() {
        if (status    == null) status    = "PENDING";
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
