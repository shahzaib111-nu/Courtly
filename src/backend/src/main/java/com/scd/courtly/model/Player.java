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
    // Category details (class diagram: Student, Family and Group players; ERD: PLAYER)
    private String studentId;          // STUDENT
    private String universityEmail;    // STUDENT
    private Integer familySize;        // FAMILY
    private Integer groupSize;         // GROUP: number of people in the party
    private String leadMemberName;     // GROUP
}