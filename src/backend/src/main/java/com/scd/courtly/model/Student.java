package com.scd.courtly.model;

import jakarta.persistence.Entity;

@Entity
public class Student extends Player {
    private String studentID;      // Matches studentID: string [cite: 35]
    private String universityEmail; // Matches universityEmail: string [cite: 35]
}