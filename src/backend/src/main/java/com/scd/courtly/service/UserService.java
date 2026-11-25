package com.scd.courtly.service;

import com.scd.courtly.model.User;
import com.scd.courtly.repository.UserRepository;
import com.scd.courtly.dto.response.LoginResponse;
import com.scd.courtly.security.AdminAccount;
import com.scd.courtly.security.JwtService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.util.Optional;
import java.util.UUID;

@Service
public class UserService {


    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private AdminAccount adminAccount;

    public User register(User userData) {
        Optional<User> existing = userRepository.findByEmail(userData.getEmail());
        if (existing.isPresent()) {
            return null;
        }
        userData.setUserID("U-" + UUID.randomUUID().toString().substring(0, 8));
        userData.setPasswordHash(passwordEncoder.encode(userData.getPasswordHash()));
        userData.setAuthProvider("LOCAL");
        userData.setAccountStatus("MANAGER".equalsIgnoreCase(userData.getRole()) ? "PENDING_APPROVAL" : "Active");
        return userRepository.save(userData);
    }

    public LoginResponse login(String email, String password, String requestedRole) {
        if (adminAccount.matches(email, password)) {
            if ("PLAYER".equalsIgnoreCase(requestedRole)) {
                return LoginResponse.failure("ROLE_MISMATCH:ADMIN");
            }
            String token = jwtService.generateToken(adminAccount.email(), "ADMIN", AdminAccount.USER_ID);
            return new LoginResponse(true, "ADMIN", null, null, "Admin", null, token, jwtService.getExpirationMs());
        }
        Optional<User> user = userRepository.findByEmail(email);
        if (user.isEmpty()) {
            return LoginResponse.failure("EMAIL_NOT_FOUND");
        }
        User u = user.get();
        String ds = u.getDeletionStatus();
        if ("PENDING".equals(ds) || "ARCHIVED".equals(ds)) {
            return LoginResponse.failure("ACCOUNT_PENDING_DELETION");
        }
        if (passwordMatches(password, u.getPasswordHash())) {
            if (u.getPasswordHash() != null && !u.getPasswordHash().startsWith("$2")) {
                u.setPasswordHash(passwordEncoder.encode(password));
                userRepository.save(u);
            }
            String actualRole = u.getRole() != null ? u.getRole() : "PLAYER";
            if (requestedRole != null && !requestedRole.isBlank()
                    && !actualRole.equalsIgnoreCase(requestedRole)) {
                return LoginResponse.failure("ROLE_MISMATCH:" + actualRole);
            }
            String accountStatus = "MANAGER".equalsIgnoreCase(actualRole) ? u.getAccountStatus() : null;
            String token = jwtService.generateToken(u.getEmail(), actualRole, u.getUserID());
            return new LoginResponse(true, actualRole, null, u.getUserID(), u.getName(), accountStatus, token, jwtService.getExpirationMs());
        }
        return LoginResponse.failure("INVALID_CREDENTIALS");
    }

    private boolean passwordMatches(String rawPassword, String storedPassword) {
        if (storedPassword == null) return false;
        if (storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$") || storedPassword.startsWith("$2y$")) {
            return passwordEncoder.matches(rawPassword, storedPassword);
        }
        return rawPassword.equals(storedPassword);
    }

    public void logout(String userID) {
    }
}
