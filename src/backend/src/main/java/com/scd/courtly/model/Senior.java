package com.scd.courtly.model;

import jakarta.persistence.Entity;
import java.util.Date;

@Entity
public class Senior extends Player {
    private Date dateOfBirth; // Matches dateOfBirth: date [cite: 39]
}