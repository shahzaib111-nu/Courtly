package com.scd.courtly.controller;

import com.scd.courtly.model.Booking;
import com.scd.courtly.model.Player;
import com.scd.courtly.model.SystemReport;
import com.scd.courtly.model.VerificationDoc;
import com.scd.courtly.repository.BookingRepository;
import com.scd.courtly.repository.PlayerRepository;
import com.scd.courtly.repository.VerificationDocRepository;
import com.scd.courtly.service.EmailService;
import com.scd.courtly.service.NotificationService;
import com.scd.courtly.service.ReportService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@PreAuthorize("hasRole('ADMIN')")
@RequestMapping("/api/admin")
public class AdminController {

    @Autowired
    private VerificationDocRepository verificationDocRepository;

    @Autowired
    private com.scd.courtly.service.DocumentStorageService documentStorage;

    @Autowired
    private PlayerRepository playerRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private ReportService reportService;

    @Autowired
    private EmailService emailService;

    /** Quick smoke-test: GET /api/admin/test-email?to=you@gmail.com */
    @GetMapping("/test-email")
    public ResponseEntity<Map<String, String>> testEmail(@RequestParam String to) {
        boolean ok = emailService.sendNotificationEmail(
            to,
            "BOOKING_CONFIRMED",
            "Courtly Email Test",
            "If you can read this, email notifications are working correctly!"
        );
        Map<String, String> body = new LinkedHashMap<>();
        body.put("status",  ok ? "SUCCESS" : "FAILED");
        body.put("sentTo",  to);
        body.put("message", ok
            ? "Email delivered. Check your inbox (and spam folder)."
            : "Email failed. Check the backend console for the full error.");
        return ResponseEntity.ok(body);
    }

    @GetMapping("/pending-docs")
    public ResponseEntity<List<VerificationDoc>> getPendingDocs() {
        return ResponseEntity.ok(verificationDocRepository.findByStatus("PENDING"));
    }

    @PostMapping("/verify-doc")
    public ResponseEntity<?> verifyDiscountDoc(
            @RequestParam String docID,
            @RequestParam String newStatus,
            @RequestParam(required = false) String rejectionReason) {

        Optional<VerificationDoc> docOpt = verificationDocRepository.findById(docID);
        if (docOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        VerificationDoc doc = docOpt.get();
        doc.setStatus(newStatus);
        doc.setReviewedAt(new Date());

        if ("APPROVED".equals(newStatus)) {
            Player player = doc.getPlayer();
            String tier = switch (doc.getDocType()) {
                case "STUDENT_ID"  -> "STUDENT";
                case "SENIOR_CARD" -> "SENIOR";
                case "FAMILY_CARD" -> "FAMILY";
                default            -> "NONE";
            };
            player.setDiscountTier(tier);
            playerRepository.save(player);

            notificationService.create(
                player.getUserID(),
                "PROFILE_VERIFIED",
                "Document Approved!",
                "Your " + formatDocType(doc.getDocType()) + " has been approved. " +
                "Your " + tier + " discount tier is now active on all bookings."
            );
        } else if ("REJECTED".equals(newStatus)) {
            doc.setRejectionReason(rejectionReason);

            notificationService.create(
                doc.getPlayer().getUserID(),
                "PROFILE_REJECTED",
                "Document Rejected",
                "Your " + formatDocType(doc.getDocType()) + " was rejected. " +
                "Reason: " + (rejectionReason != null && !rejectionReason.isBlank()
                    ? rejectionReason : "Please contact support for details.") +
                " You may resubmit after addressing the issue."
            );
        }

        verificationDocRepository.save(doc);
        return ResponseEntity.ok(doc);
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Long>> getStats() {
        LocalDate today = LocalDate.now();
        Date startOfToday = Date.from(today.atStartOfDay(ZoneId.systemDefault()).toInstant());
        Date endOfToday   = Date.from(today.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant());

        long pendingCount   = verificationDocRepository.countByStatus("PENDING");
        long approvedToday  = verificationDocRepository.countByStatusAndReviewedAtBetween("APPROVED", startOfToday, endOfToday);
        long rejectedToday  = verificationDocRepository.countByStatusAndReviewedAtBetween("REJECTED", startOfToday, endOfToday);

        return ResponseEntity.ok(Map.of(
                "pendingCount",  pendingCount,
                "approvedToday", approvedToday,
                "rejectedToday", rejectedToday
        ));
    }

    @GetMapping("/deletion-requests")
    public ResponseEntity<List<Map<String, Object>>> getDeletionRequests() {
        List<Player> pending = playerRepository.findByDeletionStatus("PENDING");
        long nowMs = System.currentTimeMillis();
        long dayMs = 24L * 60 * 60 * 1000;

        List<Map<String, Object>> result = pending.stream().map(p -> {
            long elapsed      = nowMs - p.getDeletionRequestedAt().getTime();
            long daysRemaining = Math.max(0, 7 - (elapsed / dayMs));
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name",                 p.getName()               != null ? p.getName()               : "");
            row.put("email",                p.getEmail()              != null ? p.getEmail()              : "");
            row.put("deletionRequestedAt",  p.getDeletionRequestedAt());
            row.put("daysRemaining",        daysRemaining);
            return row;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    @PostMapping("/process-deletion")
    public ResponseEntity<?> processDeletion(
            @RequestParam String playerEmail,
            @RequestParam String action) {

        Optional<Player> playerOpt = playerRepository.findByEmail(playerEmail);
        if (playerOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Player player = playerOpt.get();

        switch (action) {
            case "DELETE_NOW" -> {
                documentStorage.deleteAllFor(player.getUserID());   // documents and their encrypted contents
                playerRepository.delete(player);
            }
            case "ARCHIVE" -> {
                player.setDeletionStatus("ARCHIVED");
                playerRepository.save(player);
            }
            case "CANCEL" -> {
                player.setDeletionStatus(null);
                player.setDeletionRequestedAt(null);
                playerRepository.save(player);

                notificationService.create(
                    player.getUserID(),
                    "DELETION_CANCELLED",
                    "Deletion Request Cancelled",
                    "Your account deletion request has been cancelled by the admin. Your account remains active."
                );
            }
            default -> { return ResponseEntity.badRequest().body("Invalid action. Use DELETE_NOW, ARCHIVE, or CANCEL."); }
        }
        return ResponseEntity.ok().build();
    }

    @GetMapping("/archived-accounts")
    public ResponseEntity<List<Map<String, Object>>> getArchivedAccounts() {
        List<Player> archived = playerRepository.findByDeletionStatus("ARCHIVED");

        List<Map<String, Object>> result = archived.stream().map(p -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name",                p.getName()              != null ? p.getName()              : "");
            row.put("email",               p.getEmail()             != null ? p.getEmail()             : "");
            row.put("deletionRequestedAt", p.getDeletionRequestedAt());
            return row;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    @GetMapping("/reports")
    public ResponseEntity<Map<String, Object>> generateReport(
            @RequestParam String type,
            @RequestParam String startDate,
            @RequestParam String endDate,
            @RequestParam(required = false) String courtType) {
        return ResponseEntity.ok(reportService.buildReport(type, startDate, endDate, courtType));
    }

    @GetMapping("/pending-managers")
    public ResponseEntity<List<Map<String, Object>>> getPendingManagers() {
        List<Player> managers = playerRepository.findByRoleAndAccountStatus("MANAGER", "PENDING_APPROVAL");
        List<Map<String, Object>> result = managers.stream().map(p -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("userID",      p.getUserID());
            row.put("name",        p.getName()        != null ? p.getName()        : "");
            row.put("email",       p.getEmail()       != null ? p.getEmail()       : "");
            row.put("phone",       p.getPhone()       != null ? p.getPhone()       : "");
            row.put("dateOfBirth", p.getDateOfBirth() != null ? p.getDateOfBirth() : "");
            return row;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/approve-manager")
    public ResponseEntity<?> approveManager(
            @RequestParam String playerID,
            @RequestParam String action,
            @RequestParam(required = false) String rejectionReason) {

        Optional<Player> playerOpt = playerRepository.findById(playerID);
        if (playerOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Player manager = playerOpt.get();

        if ("APPROVE".equals(action)) {
            manager.setAccountStatus("Active");
            playerRepository.save(manager);
            notificationService.create(
                manager.getUserID(),
                "PROFILE_VERIFIED",
                "Account Approved",
                "Your Arena Manager account has been approved! Refresh this page to access your manager dashboard."
            );
        } else if ("REJECT".equals(action)) {
            manager.setAccountStatus("REJECTED");
            playerRepository.save(manager);
            String reason = (rejectionReason != null && !rejectionReason.isBlank())
                    ? rejectionReason : "Please contact support for details.";
            notificationService.create(
                manager.getUserID(),
                "PROFILE_REJECTED",
                "Account Not Approved",
                "Your Arena Manager registration was not approved. Reason: " + reason
            );
        } else {
            return ResponseEntity.badRequest().body("Invalid action. Use APPROVE or REJECT.");
        }
        return ResponseEntity.ok().build();
    }

    @GetMapping("/active-bookings")
    public ResponseEntity<List<Map<String, Object>>> getActiveBookings() {
        String today = LocalDate.now().toString();

        List<Booking> bookings = bookingRepository
                .findByStatusInAndBookingDateGreaterThanEqual(List.of("PENDING", "CONFIRMED"), today);

        List<Map<String, Object>> result = bookings.stream()
                .sorted(Comparator.comparing(Booking::getBookingDate)
                        .thenComparing(b -> b.getTimeSlot() != null ? b.getTimeSlot() : ""))
                .map(b -> {
                    String playerName = playerRepository.findById(b.getPlayerID())
                            .map(Player::getName)
                            .orElse("Unknown");
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("courtName",   b.getCourtName()  != null ? b.getCourtName()  : "");
                    row.put("bookingDate", b.getBookingDate() != null ? b.getBookingDate() : "");
                    row.put("timeSlot",    b.getTimeSlot()   != null ? b.getTimeSlot()   : "");
                    row.put("playerName",  playerName);
                    row.put("status",      b.getStatus());
                    return row;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    @GetMapping("/payment-history")
    public ResponseEntity<List<Map<String, Object>>> getPaymentHistory(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {

        LocalDateTime fromDt = (from != null && !from.isBlank())
                ? LocalDate.parse(from).atStartOfDay()
                : LocalDateTime.now().minusDays(30);
        LocalDateTime toDt = (to != null && !to.isBlank())
                ? LocalDate.parse(to).atTime(LocalTime.MAX)
                : LocalDateTime.now();

        List<Booking> bookings = bookingRepository
                .findByStatusInAndConfirmedAtBetweenOrderByConfirmedAtDesc(
                        List.of("CONFIRMED", "COMPLETED"), fromDt, toDt);

        List<Map<String, Object>> result = bookings.stream().map(b -> {
            String payerName = playerRepository.findById(b.getPlayerID())
                    .map(p -> p.getName() != null && !p.getName().isBlank() ? p.getName() : p.getEmail())
                    .orElse("Unknown");
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("payerName",       payerName);
            row.put("paymentDateTime", b.getConfirmedAt() != null ? b.getConfirmedAt().toString() : "");
            row.put("courtName",       b.getCourtName()  != null ? b.getCourtName()  : "");
            row.put("bookingDate",     b.getBookingDate() != null ? b.getBookingDate() : "");
            row.put("timeSlot",        b.getTimeSlot()   != null ? b.getTimeSlot()   : "");
            row.put("amountPaid",      b.getTotalCost());
            return row;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    private String formatDocType(String docType) {
        return switch (docType) {
            case "STUDENT_ID"  -> "Student ID";
            case "SENIOR_CARD" -> "Senior Card";
            case "FAMILY_CARD" -> "Family Card";
            default            -> "document";
        };
    }
}
