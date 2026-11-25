package com.scd.courtly.repository;

import com.scd.courtly.model.Court;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CourtRepository extends JpaRepository<Court, String> {

    List<Court> findBySportType(String sportType);
    List<Court> findByFacilityId(String facilityId);
    long countByFacilityId(String facilityId);
    List<Court> findByStatus(String status);
    List<Court> findBySportTypeAndStatus(String sportType, String status);

    /**
     * Acquires a pessimistic write lock (SELECT ... FOR UPDATE) on the court row.
     * Used in createBooking to serialize concurrent slot-booking attempts for the
     * same court, preventing two users from booking the same slot simultaneously.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Court c WHERE c.courtID = :courtID")
    Optional<Court> findByIdForUpdate(@Param("courtID") String courtID);
}
