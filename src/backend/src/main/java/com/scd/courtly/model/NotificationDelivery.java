package com.scd.courtly.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Delivery log for notification e-mails (FR-43). One row per notification, kept even
 * when the user clears the in-app notification. Failed e-mails stay QUEUED and are
 * retried with a growing delay until they are SENT or give up as FAILED.
 */
@Data
@NoArgsConstructor
@Entity
@Table(name = "notification_deliveries", indexes = @Index(columnList = "status, nextAttemptAt"))
public class NotificationDelivery {

    public static final String SENT = "SENT";
    public static final String QUEUED = "QUEUED";
    public static final String FAILED = "FAILED";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String deliveryID;

    private String notificationID;
    @Column(nullable = false)
    private String userId;
    private String recipientEmail;   // the address used on the last attempt

    @Column(nullable = false)
    private String type;
    @Column(nullable = false)
    private String title;
    @Column(length = 600)
    private String message;

    @Column(nullable = false)
    private String status;           // SENT, QUEUED or FAILED
    private int attempts;
    @Column(length = 300)
    private String lastError;

    private LocalDateTime createdAt;
    private LocalDateTime lastAttemptAt;
    private LocalDateTime nextAttemptAt;
    private LocalDateTime deliveredAt;

    @PrePersist
    protected void setDefaults() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
