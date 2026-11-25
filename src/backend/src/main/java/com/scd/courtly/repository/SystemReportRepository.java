package com.scd.courtly.repository;

import com.scd.courtly.model.SystemReport;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SystemReportRepository extends JpaRepository<SystemReport, String> {
    List<SystemReport> findAllByOrderByGeneratedAtDesc(Pageable page);
}
