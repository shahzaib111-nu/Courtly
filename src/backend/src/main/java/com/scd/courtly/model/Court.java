package com.scd.courtly.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "courts")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Court {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String courtID;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String sportType;   // TENNIS, CRICKET, FOOTBALL, BASKETBALL, FUTSAL, BADMINTON, SQUASH, VOLLEYBALL

    @Column(nullable = false)
    private double hourlyRate;

    private int capacity;

    private String openTime;            // "HH:mm"
    private String closeTime;           // "HH:mm"
    private int slotDurationMinutes;    // e.g. 60

    private String status;              // AVAILABLE, MAINTENANCE, CLOSED

    @Column(length = 500)
    private String description;

    private String managerId;       // userId of the arena manager who owns this court

    private String facilityId;      // the facility that contains this court (ERD: COURT.facility_id)

    // ── Variable pricing ──────────────────────────────────────────────────
    private String peakStartTime;       // "HH:mm"  e.g. "17:00"
    private String peakEndTime;         // "HH:mm"  e.g. "21:00"
    private double peakMultiplier;      // e.g. 1.5  (50 % surcharge in peak hours)
    private double weekendMultiplier;   // e.g. 1.25 (25 % surcharge on weekends)

    // ── Scheduled maintenance ─────────────────────────────────────────────
    private LocalDateTime maintenanceFrom;  // slot bookings blocked from this datetime
    private LocalDateTime maintenanceTo;    // court reverts to AVAILABLE at this datetime

    /** Typical number of players per sport, used when a manager leaves capacity empty. */
    public static int defaultCapacity(String sportType) {
        return switch (sportType == null ? "" : sportType) {
            case "TENNIS", "BADMINTON", "SQUASH" -> 4;
            case "BASKETBALL", "VOLLEYBALL", "FUTSAL" -> 12;
            case "CRICKET", "FOOTBALL" -> 22;
            default -> 10;
        };
    }

    @PrePersist
    protected void applyDefaults() {
        if (status == null || status.isBlank())         status = "AVAILABLE";
        if (slotDurationMinutes <= 0)                   slotDurationMinutes = 60;
        if (openTime  == null || openTime.isBlank())    openTime  = "08:00";
        if (closeTime == null || closeTime.isBlank())   closeTime = "22:00";
        if (peakMultiplier    <= 0)                     peakMultiplier    = 1.0;
        if (weekendMultiplier <= 0)                     weekendMultiplier = 1.0;
    }
}
