package com.scd.courtly.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@Entity
@Table(name = "player_group") // THIS SAVES THE DAY! Bypasses the SQL keyword.
public class Group extends Player {
    private int groupSize; 
    // Add any other specific fields from your DCD here
}