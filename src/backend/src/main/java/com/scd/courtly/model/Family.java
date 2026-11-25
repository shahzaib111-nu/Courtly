package com.scd.courtly.model;

import jakarta.persistence.Entity;

@Entity
public class Family extends Player {
    private int familyMemberCount; // Matches familyMemberCount: int [cite: 41]
}