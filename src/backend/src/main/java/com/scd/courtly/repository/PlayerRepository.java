package com.scd.courtly.repository;

import com.scd.courtly.model.Player;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Date;
import java.util.List;
import java.util.Optional;

@Repository
public interface PlayerRepository extends JpaRepository<Player, String> {
    Optional<Player> findByEmail(String email);
    boolean existsByEmail(String email);
    List<Player> findByDeletionStatus(String deletionStatus);
    List<Player> findByDeletionStatusAndDeletionRequestedAtBefore(String deletionStatus, Date cutoff);
    List<Player> findAllByOrderByRankPointsDesc();
    List<Player> findByRoleAndAccountStatus(String role, String accountStatus);
}
