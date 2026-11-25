package com.scd.courtly.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "notifications")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String notificationID;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String type;

    @Column(nullable = false)
    private String title;

    @Column(length = 600)
    private String message;

    // Force JSON property name to "read" so JS can use n.read reliably
    @JsonProperty("read")
    private boolean isRead;

    private LocalDateTime createdAt;

    @PrePersist
    protected void setDefaults() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        isRead = false;
    }
}
