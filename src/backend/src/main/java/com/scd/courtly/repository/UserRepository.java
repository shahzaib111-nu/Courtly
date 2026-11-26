package com.scd.courtly.repository;

import com.scd.courtly.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, String> {
    // This perfectly supports your UserService login/register logic
    Optional<User> findByEmail(String email);

    Optional<User> findByEmailIgnoreCase(String email);

    Optional<User> findByUsername(String username);

    boolean existsByUsername(String username);

    Optional<User> findByAuthProviderAndProviderId(String authProvider, String providerId);
}