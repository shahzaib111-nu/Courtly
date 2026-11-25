package com.scd.courtly.repository;

import com.scd.courtly.model.FacilityRating;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface FacilityRatingRepository extends JpaRepository<FacilityRating, String> {
    boolean existsByBookingID(String bookingID);
    List<FacilityRating> findByPlayerIDOrderBySubmittedAtDesc(String playerID);
    List<FacilityRating> findByCourtID(String courtID);
    List<FacilityRating> findByFacilityId(String facilityId);
    List<FacilityRating> findAllByOrderBySubmittedAtDesc();

    @Query("SELECT AVG(r.ratingScore) FROM FacilityRating r WHERE r.courtID = :courtID")
    Double findAverageScoreByCourtID(@Param("courtID") String courtID);
}
