package com.scd.courtly.model;

import jakarta.persistence.*;
import java.util.Date;

@Entity
public class SystemReport {
    @Id
    private String reportID; // Matches reportID: string [cite: 76]
    
    private String type; // Matches ReportType enum 
    private Date generatedAt; // Matches generatedAt: date [cite: 76]
    
    @Column(columnDefinition = "TEXT")
    private String reportData; // Compiled JSON data [cite: 76]
}