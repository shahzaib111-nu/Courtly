package com.scd.courtly.repository;

import com.scd.courtly.model.NotificationDelivery;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface NotificationDeliveryRepository extends JpaRepository<NotificationDelivery, String> {

    List<NotificationDelivery> findByStatusAndNextAttemptAtLessThanEqual(String status, LocalDateTime now);

    List<NotificationDelivery> findAllByOrderByCreatedAtDesc(Pageable page);

    List<NotificationDelivery> findByStatusOrderByCreatedAtDesc(String status, Pageable page);

    long countByStatus(String status);
}
