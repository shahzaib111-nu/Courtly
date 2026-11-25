package com.scd.courtly.security;

import com.scd.courtly.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;
    private final AdminAccount adminAccount;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        if (adminAccount.isAdminEmail(email)) {
            if (!adminAccount.isEnabled()) throw new UsernameNotFoundException("Admin login is disabled");
            // Authentication happens via JWT; this password is never checked.
            return new User(adminAccount.email(), "",
                List.of(new SimpleGrantedAuthority("ROLE_USER"),
                        new SimpleGrantedAuthority("ROLE_ADMIN")));
        }
        var user = userRepository.findByEmail(email)
            .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
        String role = user.getRole() == null ? "PLAYER" : user.getRole();
        // OAuth2-only accounts have no password; Spring's User rejects null passwords.
        String password = user.getPasswordHash() == null ? "" : user.getPasswordHash();
        // Arena managers only get manager rights once an admin has approved them.
        if ("MANAGER".equals(role) && !isApproved(user.getAccountStatus())) {
            return new User(user.getEmail(), password, List.of(new SimpleGrantedAuthority("ROLE_USER")));
        }
        return new User(user.getEmail(), password,
            List.of(new SimpleGrantedAuthority("ROLE_USER"),
                    new SimpleGrantedAuthority("ROLE_" + role)));
    }

    private static boolean isApproved(String accountStatus) {
        return "Active".equalsIgnoreCase(accountStatus) || "APPROVED".equalsIgnoreCase(accountStatus);
    }
}
