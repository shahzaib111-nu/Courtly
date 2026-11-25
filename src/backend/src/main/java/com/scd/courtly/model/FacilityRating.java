package com.scd.courtly.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "facility_ratings")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FacilityRating {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String ratingID;

    @Column(nullable = false, unique = true)
    private String bookingID;

    @Column(nullable = false)
    private String playerID;

    private String courtID;
    private String courtName;
    private String facilityId;     // ERD: FACILITY_FEEDBACK.facility_id
    private String facilityName;
    private String sportType;
    private String bookingDate;

    @Column(nullable = false)
    private int ratingScore;     // 1–5

    @Column(length = 500)
    private String feedbackText;

    private LocalDateTime submittedAt;

    @PrePersist
    protected void setDefaults() {
        if (submittedAt == null) submittedAt = LocalDateTime.now();
    }
}
