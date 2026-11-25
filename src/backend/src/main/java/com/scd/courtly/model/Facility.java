package com.scd.courtly.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * A sports facility (class diagram: Facility, ERD: FACILITY). It is run by one arena
 * manager and contains one or more courts ({@link Court#getFacilityId()}).
 */
@Data
@NoArgsConstructor
@Entity
@Table(name = "facilities")
public class Facility {

    @Id
    private String facilityID;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 200)
    private String location;

    private String openingTime;    // "HH:mm"
    private String closingTime;    // "HH:mm"

    /** The arena manager who runs this facility (ERD: ARENA_MANAGER.facility_id). One facility per manager. */
    @Column(unique = true)
    private String managerId;

    private LocalDateTime createdAt;

    @PrePersist
    protected void setDefaults() {
        if (facilityID == null) facilityID = "FAC-" + java.util.UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (openingTime == null) openingTime = "08:00";
        if (closingTime == null) closingTime = "22:00";
    }

    /** Class diagram: getFacilityDetails(). */
    @JsonIgnore
    public String getFacilityDetails() {
        return name + " (" + (location != null ? location : "location not set") + "), open "
            + openingTime + "-" + closingTime;
    }

    /** Class diagram: checkOperatingStatus(). OPEN or CLOSED at the given time; handles past-midnight closing. */
    public String checkOperatingStatus(LocalTime at) {
        try {
            LocalTime open = LocalTime.parse(openingTime);
            LocalTime close = LocalTime.parse(closingTime);
            boolean isOpen = close.isAfter(open)
                ? !at.isBefore(open) && at.isBefore(close)
                : !at.isBefore(open) || at.isBefore(close);   // e.g. 18:00-02:00
            return isOpen ? "OPEN" : "CLOSED";
        } catch (Exception e) {
            return "UNKNOWN";
        }
    }
}
