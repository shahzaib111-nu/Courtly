package com.scd.courtly.controller;

import com.scd.courtly.exception.ConflictException;
import com.scd.courtly.dto.request.*;
import com.scd.courtly.dto.response.ProfileResponse;
import com.scd.courtly.dto.response.RegistrationResponse;
import com.scd.courtly.dto.response.LoginResponse;
import com.scd.courtly.exception.UnauthorizedException;
import com.scd.courtly.model.Player;
import com.scd.courtly.model.User;
import com.scd.courtly.repository.PlayerRepository;
import com.scd.courtly.service.EmailService;
import com.scd.courtly.service.NotificationService;
import com.scd.courtly.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;

import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private UserService userService;

    @Autowired
    private PlayerRepository playerRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private EmailService emailService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
            Player newPlayer = new Player();
            newPlayer.setName(request.name());
            newPlayer.setEmail(request.email());
            newPlayer.setPasswordHash(request.password());
            newPlayer.setPhone(request.phone());
            newPlayer.setDateOfBirth(request.dateOfBirth());
            newPlayer.setRole("MANAGER".equalsIgnoreCase(request.role()) ? "MANAGER" : "PLAYER");

            User savedUser = userService.register(newPlayer);

            if (savedUser == null) {
                throw new ConflictException("Email already in use. Please use a different one.");
            }

            String roleLabel = "MANAGER".equals(savedUser.getRole()) ? "Arena Manager" : "Player";
            notificationService.create(
                NotificationService.ADMIN_USER_ID,
                "NEW_REGISTRATION",
                "New User Registration",
                savedUser.getName() + " (" + savedUser.getEmail() + ") has registered as a " + roleLabel + "."
            );

            // Welcome notification → triggers email if user's email is real
            String welcomeMsg = "MANAGER".equals(savedUser.getRole())
                ? "Welcome to Courtly, " + savedUser.getName() + "! Your Arena Manager account is pending admin approval. You'll be notified once reviewed."
                : "Welcome to Courtly, " + savedUser.getName() + "! Your account is ready. Start booking courts now.";
            notificationService.create(
                savedUser.getUserID(),
                "NEW_REGISTRATION",
                "Welcome to Courtly!",
                welcomeMsg
            );

            RegistrationResponse response = new RegistrationResponse(
                savedUser.getUserID(), savedUser.getName(), savedUser.getEmail(),
                savedUser.getRole(), savedUser.getAccountStatus());
            return ResponseEntity.ok(response);
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(
            @RequestParam String email,
            @RequestParam String pass,
            @RequestParam(required = false) String role) {
        LoginResponse result = userService.login(email, pass, role);
        if (!result.success()) {
            throw new UnauthorizedException(
                switch (result.message() == null ? "" : result.message()) {
                    case "EMAIL_NOT_FOUND" -> "No account found with that email address";
                    case "ACCOUNT_PENDING_DELETION" -> "This account is pending deletion";
                    default -> result.message() != null && result.message().startsWith("ROLE_MISMATCH")
                        ? "Incorrect account role" : "Incorrect email or password";
                });
        }
        return ResponseEntity.ok(result);
    }

    @PreAuthorize("hasRole('USER')")
    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(@RequestParam String email) {
        Optional<Player> playerOpt = playerRepository.findByEmail(email);
        if (playerOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Player p = playerOpt.get();
        ProfileResponse profile = new ProfileResponse(
            p.getName(), p.getEmail(), p.getPhone(), p.getDateOfBirth(),
            p.getDiscountTier() != null ? p.getDiscountTier() : "NONE",
            p.getAccountStatus(), p.getDeletionStatus(),
            p.getAuthProvider() != null ? p.getAuthProvider() : "LOCAL",
            p.getPasswordHash() != null && !p.getPasswordHash().isBlank());
        return ResponseEntity.ok(profile);
    }

    @PreAuthorize("hasRole('USER')")
    @GetMapping("/account-status")
    public ResponseEntity<?> getAccountStatus(@RequestParam String playerID) {
        return playerRepository.findById(playerID)
                .map(p -> ResponseEntity.ok(Map.of("accountStatus", p.getAccountStatus() != null ? p.getAccountStatus() : "Active")))
                .orElse(ResponseEntity.notFound().build());
    }

    @PreAuthorize("hasRole('USER')")
    @PostMapping("/request-deletion")
    public ResponseEntity<?> requestDeletion(@RequestParam String playerEmail) {
        Optional<Player> playerOpt = playerRepository.findByEmail(playerEmail);
        if (playerOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Player player = playerOpt.get();
        player.setDeletionStatus("PENDING");
        player.setDeletionRequestedAt(new Date());
        playerRepository.save(player);

        notificationService.create(
            NotificationService.ADMIN_USER_ID,
            "DELETION_REQUEST",
            "Account Deletion Request",
            player.getName() + " (" + player.getEmail() + ") has requested account deletion. " +
            "A 7-day grace period has started. Review under Account Requests."
        );

        return ResponseEntity.ok().build();
    }

    @PutMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        String email = request.email().trim();
        String newPass = request.newPassword().trim();

        if (email.isBlank() || newPass.isBlank())
            return ResponseEntity.badRequest().body("Email and new password are required.");

        Optional<Player> playerOpt = playerRepository.findByEmail(email);
        if (playerOpt.isEmpty())
            return ResponseEntity.status(404).body("No account found with that email address.");

        Player p = playerOpt.get();
        p.setPasswordHash(passwordEncoder.encode(newPass));
        playerRepository.save(p);
        return ResponseEntity.ok(Map.of("message", "Password reset successfully. You can now sign in."));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        String email = request.email();
        Optional<Player> playerOpt = playerRepository.findByEmail(email.trim());
        if (playerOpt.isEmpty())
            return ResponseEntity.status(404).body(Map.of("error", "No account found with that email address."));

        String otpCode = String.format("%06d", (int)(Math.random() * 1000000));
        Date   expiry  = new Date(System.currentTimeMillis() + 10L * 60 * 1000);

        Player p = playerOpt.get();
        p.setOtpCode(otpCode);
        p.setOtpExpiry(expiry);
        playerRepository.save(p);

        boolean sent = emailService.sendOtpEmail(email.trim(), otpCode);
        if (!sent) {
            p.setOtpCode(null);
            p.setOtpExpiry(null);
            playerRepository.save(p);
            return ResponseEntity.status(500).body(Map.of("error", "Could not send OTP. Please check your email address and try again."));
        }
        return ResponseEntity.ok(Map.of("message", "OTP sent to your email address."));
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<?> verifyOtp(@Valid @RequestBody OtpVerifyRequest request) {
        String email = request.email().trim();
        String otp = request.otp().trim();

        if (email.isBlank() || otp.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "Email and OTP are required."));

        Optional<Player> playerOpt = playerRepository.findByEmail(email);
        if (playerOpt.isEmpty())
            return ResponseEntity.status(404).body(Map.of("error", "No account found with that email address."));

        Player p = playerOpt.get();
        if (p.getOtpCode() == null || !p.getOtpCode().equals(otp))
            return ResponseEntity.status(400).body(Map.of("error", "Invalid OTP. Please check the code and try again."));
        if (p.getOtpExpiry() == null || p.getOtpExpiry().before(new Date()))
            return ResponseEntity.status(400).body(Map.of("error", "OTP has expired. Please request a new one."));

        return ResponseEntity.ok(Map.of("message", "OTP verified."));
    }

    @PutMapping("/reset-password-otp")
    public ResponseEntity<?> resetPasswordWithOtp(@Valid @RequestBody OtpResetPasswordRequest request) {
        String email = request.email().trim();
        String otp = request.otp().trim();
        String newPass = request.newPassword().trim();

        if (email.isBlank() || otp.isBlank() || newPass.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "Email, OTP and new password are required."));

        Optional<Player> playerOpt = playerRepository.findByEmail(email);
        if (playerOpt.isEmpty())
            return ResponseEntity.status(404).body(Map.of("error", "No account found with that email address."));

        Player p = playerOpt.get();
        if (p.getOtpCode() == null || !p.getOtpCode().equals(otp))
            return ResponseEntity.status(400).body(Map.of("error", "Invalid OTP. Please request a new code."));
        if (p.getOtpExpiry() == null || p.getOtpExpiry().before(new Date()))
            return ResponseEntity.status(400).body(Map.of("error", "OTP has expired. Please request a new one."));

        p.setPasswordHash(passwordEncoder.encode(newPass));
        p.setOtpCode(null);
        p.setOtpExpiry(null);
        playerRepository.save(p);
        return ResponseEntity.ok(Map.of("message", "Password reset successfully. You can now sign in."));
    }

    @PreAuthorize("hasRole('USER')")
    @PutMapping("/change-password")
    public ResponseEntity<?> changePassword(@Valid @RequestBody ChangePasswordRequest request,
                                            Authentication authentication) {
        String email = request.email().trim();
        String currentPass = request.currentPassword() == null ? "" : request.currentPassword().trim();
        String newPass = request.newPassword().trim();

        // Only the signed-in user may change their own password.
        if (authentication == null || !email.equalsIgnoreCase(authentication.getName()))
            return ResponseEntity.status(403).body(Map.of("error", "You can only change your own password."));

        if (email.isBlank() || newPass.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "All fields are required."));

        Optional<Player> playerOpt = playerRepository.findByEmail(email);
        if (playerOpt.isEmpty())
            return ResponseEntity.status(404).body(Map.of("error", "Account not found."));

        Player p = playerOpt.get();
        boolean hasPassword = p.getPasswordHash() != null && !p.getPasswordHash().isBlank();
        // Accounts created via Google/GitHub have no password yet: allow setting the first one.
        boolean currentPasswordValid = !hasPassword || (!currentPass.isBlank()
            && (p.getPasswordHash().startsWith("$2")
                ? passwordEncoder.matches(currentPass, p.getPasswordHash())
                : currentPass.equals(p.getPasswordHash())));
        if (!currentPasswordValid)
            return ResponseEntity.status(401).body(Map.of("error", "Current password is incorrect."));

        p.setPasswordHash(passwordEncoder.encode(newPass));
        playerRepository.save(p);
        return ResponseEntity.ok(Map.of("message", "Password changed successfully."));
    }
}
