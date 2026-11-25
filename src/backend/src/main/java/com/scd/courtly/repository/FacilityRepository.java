package com.scd.courtly.repository;

import com.scd.courtly.model.Facility;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FacilityRepository extends JpaRepository<Facility, String> {
    Optional<Facility> findByManagerId(String managerId);
}
