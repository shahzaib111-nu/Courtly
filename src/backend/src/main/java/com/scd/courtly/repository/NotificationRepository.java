package com.scd.courtly.repository;

import com.scd.courtly.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, String> {
    List<Notification> findByUserIdOrderByCreatedAtDesc(String userId);
    long countByUserIdAndIsReadFalse(String userId);
    List<Notification> findByUserIdAndIsReadFalse(String userId);
    boolean existsByUserIdAndTypeAndMessage(String userId, String type, String message);
}
