package com.scd.courtly.repository;

import com.scd.courtly.model.MatchResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface MatchResultRepository extends JpaRepository<MatchResult, String> {
    boolean existsByBookingID(String bookingID);
    List<MatchResult> findByPlayerIDOrderBySubmittedAtDesc(String playerID);

    @Query("SELECT m FROM MatchResult m WHERE " +
           "(:sportType IS NULL OR m.sportType = :sportType) AND " +
           "(:dateFrom  IS NULL OR m.bookingDate >= :dateFrom) AND " +
           "(:dateTo    IS NULL OR m.bookingDate <= :dateTo) " +
           "ORDER BY m.bookingDate DESC")
    List<MatchResult> findWithFilters(@Param("sportType") String sportType,
                                      @Param("dateFrom")  String dateFrom,
                                      @Param("dateTo")    String dateTo);
}
