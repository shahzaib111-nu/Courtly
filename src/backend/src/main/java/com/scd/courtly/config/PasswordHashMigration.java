package com.scd.courtly.config;

import com.scd.courtly.model.User;
import com.scd.courtly.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PasswordHashMigration {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @EventListener(ApplicationReadyEvent.class)
    public void migrateLegacyPasswords() {
        for (User user : userRepository.findAll()) {
            String stored = user.getPasswordHash();
            if (stored != null && !stored.startsWith("$2")) {
                user.setPasswordHash(passwordEncoder.encode(stored));
                userRepository.save(user);
            }
        }
    }
}
