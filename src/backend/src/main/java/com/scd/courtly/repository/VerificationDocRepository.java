package com.scd.courtly.repository;

import com.scd.courtly.model.VerificationDoc;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Date;
import java.util.List;

@Repository
public interface VerificationDocRepository extends JpaRepository<VerificationDoc, String> {
    List<VerificationDoc> findByStatus(String status);
    List<VerificationDoc> findByPlayer_UserID(String userID);
    long countByStatus(String status);
    long countByStatusAndReviewedAtBetween(String status, Date start, Date end);
}
