package com.scd.courtly.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * A record of a report an admin generated or exported (class diagram: SystemReport,
 * ERD: SYSTEM_REPORT). The report figures themselves are always calculated live by
 * {@link com.scd.courtly.service.ReportService}; this keeps the history.
 */
@Data
@NoArgsConstructor
@Entity
@Table(name = "system_reports")
public class SystemReport {

    public static final java.util.Set<String> TYPES = java.util.Set.of(
        "COURT_UTILIZATION", "REVENUE_SUMMARY", "USER_DEMOGRAPHICS", "PLAYER_RANKINGS", "FACILITY_FEEDBACK");
    public static final java.util.Set<String> FORMATS = java.util.Set.of("VIEW", "PDF", "CSV");

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String reportID;

    @Column(nullable = false)
    private String adminId;          // who generated it

    @Column(nullable = false, length = 20)
    private String reportType;       // one of TYPES

    @Column(length = 1000)
    private String filters;          // JSON, e.g. {"startDate":"2026-11-01","endDate":"2026-11-25"}

    @Column(nullable = false, length = 10)
    private String exportFormat;     // VIEW (on screen), PDF or CSV

    private LocalDateTime generatedAt;

    @PrePersist
    protected void setDefaults() {
        if (generatedAt == null) generatedAt = LocalDateTime.now();
    }
}
