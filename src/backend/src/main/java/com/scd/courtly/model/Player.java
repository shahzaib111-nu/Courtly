package com.scd.courtly.model;

import jakarta.persistence.Entity;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@Entity
public class Player extends User {
    private String discountTier;
    private int rankPoints;

    // Player category chosen at registration (FR-1, FR-9): REGULAR, STUDENT, SENIOR,
    // FAMILY or GROUP. Discounts still need an approved verification document.
    private String category;
    // Number of people in the party, for the GROUP category
    private Integer groupMemberCount;
}