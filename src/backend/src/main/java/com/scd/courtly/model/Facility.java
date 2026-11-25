package com.scd.courtly.model;

import jakarta.persistence.*;
import java.util.List;

@Entity
public class Facility {
    @Id
    private String facilityID; // Matches facilityID: string 
    
    private String location; // Matches location: string 
    private String operatingHours; // Matches operatingHours: string 

    @OneToMany(cascade = CascadeType.ALL)
    private List<Court> courtsList; // Matches vector<Court> 

    // Matches DCD: getFacilityDetails() : string [cite: 49]
    public String getFacilityDetails() {
        return "Location: " + location + ", Hours: " + operatingHours;
    }
}