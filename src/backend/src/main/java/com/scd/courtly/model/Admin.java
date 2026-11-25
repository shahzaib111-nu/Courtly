package com.scd.courtly.model;

import jakarta.persistence.Entity;

@Entity
public class Admin extends User { 
    private int adminRoleLevel; // Matches adminRoleLevel: int
}