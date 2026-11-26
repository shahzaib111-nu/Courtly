package com.scd.courtly.controller;

import com.scd.courtly.exception.ConflictException;
import com.scd.courtly.dto.request.*;
import com.scd.courtly.dto.response.ProfileResponse;
import com.scd.courtly.dto.response.RegistrationResponse;
import com.scd.courtly.dto.response.LoginResponse;
import com.scd.courtly.exception.BusinessException;
import com.scd.courtly.exception.NotFoundException;
import com.scd.courtly.exception.UnauthorizedException;
import com.scd.courtly.repository.UserRepository;
import com.scd.courtly.validation.PhoneNumbers;
import com.scd.courtly.validation.Rules;
import org.springframework.http.HttpStatus;
import com.scd.courtly.model.Player;
import com.scd.courtly.model.User;
import com.scd.courtly.repository.PlayerRepository;
import com.scd.courtly.service.EmailService;
import com.scd.courtly.service.NotificationService;
import com.scd.courtly.security.AccessGuard;
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
    private UserRepository userRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private EmailService emailService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private AccessGuard guard;

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
            Player newPlayer = new Player();
            newPlayer.setName(request.name());
            newPlayer.setEmail(request.email());
            newPlayer.setPasswordHash(request.password());
            newPlayer.setPhone(PhoneNumbers.normalize(request.phone()));   // stored as 03XX-XXXXXXX
            newPlayer.setDateOfBirth(request.dateOfBirth());
            newPlayer.setRole("MANAGER".equalsIgnoreCase(request.role()) ? "MANAGER" : "PLAYER");
            if ("MANAGER".equals(newPlayer.getRole()) && Rules.age(request.dateOfBirth()) < Rules.MIN_MANAGER_AGE) {
                throw new BusinessException("Arena managers must be at least " + Rules.MIN_MANAGER_AGE + " years old.");
            }
            newPlayer.setName(request.name().trim());
            newPlayer.setEmail(request.email().trim().toLowerCase());
            newPlayer.setUsername(request.username());
            if ("PLAYER".equals(newPlayer.getRole())) {
                applyCategory(newPlayer, request.category(), request.groupSize(), request.studentId(),
                    request.universityEmail(), request.familySize(), request.leadMemberName());
            }

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
            @RequestParam String email,          // e-mail address or username (FR-5)
            @RequestParam String pass,
            @RequestParam(required = false) String role) {
        LoginResponse result = userService.login(email, pass, role);
        if (!result.success() && result.message() != null
                && result.message().startsWith(UserService.ACCOUNT_LOCKED)) {
            String minutes = result.message().substring(UserService.ACCOUNT_LOCKED.length() + 1);
            throw new BusinessException("Too many failed sign-in attempts. This account is locked for "
                + minutes + " more minute" + ("1".equals(minutes) ? "" : "s")
                + ". You can also reset your password with \"Forgot your password?\".", HttpStatus.LOCKED);
        }
        if (!result.success()) {
            throw new UnauthorizedException(
                switch (result.message() == null ? "" : result.message()) {
                    case "EMAIL_NOT_FOUND" -> "No account found with that email address or username";
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
        guard.requireSelfEmailOrAdmin(email);
        Optional<Player> playerOpt = playerRepository.findByEmail(email);
        if (playerOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(toProfile(playerOpt.get()));
    }

    /** FR-10: the signed-in user updates their own profile. */
    @PreAuthorize("hasRole('USER')")
    @PutMapping("/profile")
    public ResponseEntity<ProfileResponse> updateProfile(@Valid @RequestBody UpdateProfileRequest request) {
        AccessGuard.Caller caller = guard.caller();
        Player p = playerRepository.findById(caller.userId())
                .orElseThrow(() -> new NotFoundException("Account not found"));

        String username = UserService.normalizeUsername(request.username());
        if (username != null && !username.equals(p.getUsername())
                && userRepository.existsByUsername(username)) {
            throw new ConflictException("That username is already taken. Please choose another.");
        }
        p.setUsername(username);
        p.setName(request.name().trim());
        p.setPhone(PhoneNumbers.normalize(request.phone()));
        if ("MANAGER".equals(p.getRole()) && Rules.age(request.dateOfBirth()) < Rules.MIN_MANAGER_AGE) {
            throw new BusinessException("Arena managers must be at least " + Rules.MIN_MANAGER_AGE + " years old.");
        }
        p.setDateOfBirth(request.dateOfBirth());
        if (!"MANAGER".equals(p.getRole())) {
            applyCategory(p, request.category(), request.groupSize(), request.studentId(),
                request.universityEmail(), request.familySize(), request.leadMemberName());
        }
        return ResponseEntity.ok(toProfile(playerRepository.save(p)));
    }

    private static ProfileResponse toProfile(Player p) {
        return new ProfileResponse(
            p.getName(), p.getEmail(), p.getUsername(), p.getPhone(), p.getDateOfBirth(),
            p.getCategory() != null ? p.getCategory() : "REGULAR", p.getGroupSize(),
            p.getStudentId(), p.getUniversityEmail(), p.getFamilySize(), p.getLeadMemberName(),
            p.getDiscountTier() != null ? p.getDiscountTier() : "NONE",
            p.getAccountStatus(), p.getDeletionStatus(),
            p.getAuthProvider() != null ? p.getAuthProvider() : "LOCAL",
            p.getPasswordHash() != null && !p.getPasswordHash().isBlank());
    }

    /**
     * FR-9: Regular (default), Student, Senior, Family or Group, with the details each category
     * has in the class diagram. Details that do not belong to the chosen category are cleared.
     */
    private static void applyCategory(Player p, String category, Integer groupSize, String studentId,
                                      String universityEmail, Integer familySize, String leadMemberName) {
        String c = category == null || category.isBlank() ? "REGULAR" : category.trim().toUpperCase();
        if ("GROUP".equals(c) && groupSize == null) {
            throw new BusinessException("Enter the number of people in your group (2-50).");
        }
        p.setCategory(c);
        boolean student = "STUDENT".equals(c), family = "FAMILY".equals(c), group = "GROUP".equals(c);
        p.setStudentId(student ? blankToNull(studentId) : null);
        p.setUniversityEmail(student ? blankToNull(universityEmail) : null);
        p.setFamilySize(family ? familySize : null);
        p.setGroupSize(group ? groupSize : null);
        p.setLeadMemberName(group
            ? (blankToNull(leadMemberName) != null ? leadMemberName.trim() : p.getName())
            : null);
    }

    private static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }

    @PreAuthorize("hasRole('USER')")
    @GetMapping("/account-status")
    public ResponseEntity<?> getAccountStatus(@RequestParam String playerID) {
        guard.requireSelfOrAdmin(playerID);
        return playerRepository.findById(playerID)
                .map(p -> ResponseEntity.ok(Map.of("accountStatus", p.getAccountStatus() != null ? p.getAccountStatus() : "Active")))
                .orElse(ResponseEntity.notFound().build());
    }

    @PreAuthorize("hasRole('USER')")
    @PostMapping("/request-deletion")
    public ResponseEntity<?> requestDeletion(@RequestParam String playerEmail) {
        guard.requireSelfEmailOrAdmin(playerEmail);
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
        userService.clearLockout(p);   // proving ownership of the e-mail lifts a lockout
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
