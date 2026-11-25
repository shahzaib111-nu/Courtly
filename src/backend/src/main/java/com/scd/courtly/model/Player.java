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
}