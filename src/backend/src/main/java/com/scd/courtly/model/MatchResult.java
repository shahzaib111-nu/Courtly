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

    private LocalDateTime submittedAt;

    @PrePersist
    protected void setDefaults() {
        if (submittedAt == null) submittedAt = LocalDateTime.now();
    }
}
