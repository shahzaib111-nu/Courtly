package com.scd.courtly.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "match_results")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MatchResult {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String matchID;

    @Column(nullable = false, unique = true)
    private String bookingID;

    @Column(nullable = false)
    private String playerID;

    private String playerName;
    private String courtName;
    private String sportType;

    @Column(nullable = false)
    private String bookingDate;

    @Column(nullable = false)
    private String timeSlot;

    private String opponentName;
    private int    playerScore;
    private int    opponentScore;

    @Column(nullable = false)
    private String result;        // WIN | LOSS | DRAW

    private int pointsEarned;

    // FR-38: VALID (counts for rankings), DISPUTED (the scores contradict the stated
    // result; waiting for an admin) or RESOLVED (an admin set the final result).
    private String status;
    @Column(length = 300)
    private String disputeReason;
    private LocalDateTime resolvedAt;

    private LocalDateTime submittedAt;

    @PrePersist
    protected void setDefaults() {
        if (submittedAt == null) submittedAt = LocalDateTime.now();
        if (status == null) status = "VALID";
    }
}
