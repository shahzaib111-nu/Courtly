package com.scd.courtly.controller;

import com.scd.courtly.model.Player;
import com.scd.courtly.model.VerificationDoc;
import com.scd.courtly.repository.PlayerRepository;
import com.scd.courtly.repository.VerificationDocRepository;
import com.scd.courtly.security.AccessGuard;
import com.scd.courtly.service.DocumentStorageService;
import com.scd.courtly.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/docs")
public class VerificationDocController {

    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024;
    private static final List<String> ALLOWED_EXTENSIONS = List.of("jpg", "jpeg", "png", "pdf");

    @Autowired
    private VerificationDocRepository verificationDocRepository;

    @Autowired
    private PlayerRepository playerRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private AccessGuard guard;

    @Autowired
    private DocumentStorageService storage;

    @PostMapping("/upload")
    public ResponseEntity<?> uploadDocument(
            @RequestParam MultipartFile file,
            @RequestParam String docType,
            @RequestParam String playerEmail) {
        guard.requireSelfEmailOrAdmin(playerEmail);   // upload only to your own account

        if (!com.scd.courtly.validation.Rules.DOC_TYPES.contains(docType)) {
            return ResponseEntity.badRequest().body("Invalid document type. Choose Student ID, Senior Card or Family Card.");
        }
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("The file is empty.");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            return ResponseEntity.badRequest().body("File too large. Maximum allowed size is 5MB.");
        }

        String originalName = file.getOriginalFilename();
        if (originalName == null || !originalName.contains(".")) {
            return ResponseEntity.badRequest().body("Invalid file. No extension found.");
        }
        String extension = originalName.substring(originalName.lastIndexOf('.') + 1).toLowerCase();
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            return ResponseEntity.badRequest().body("Invalid file type. Only JPG, PNG, and PDF are accepted.");
        }

        Optional<Player> playerOpt = playerRepository.findByEmail(playerEmail);
        if (playerOpt.isEmpty()) {
            return ResponseEntity.badRequest().body("No player account found for email: " + playerEmail);
        }

        byte[] data;
        try {
            data = file.getBytes();
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body("Failed to read the uploaded file.");
        }

        VerificationDoc saved = storage.store(playerOpt.get(), docType, data);

        Player player = playerOpt.get();
        notificationService.create(
            NotificationService.ADMIN_USER_ID,
            "VERIFICATION_REQUEST",
            "New Verification Request",
            player.getName() + " (" + playerEmail + ") submitted a " +
            formatDocType(docType) + " for discount verification. Please review."
        );

        return ResponseEntity.ok(saved);
    }

    @GetMapping("/status")
    public ResponseEntity<?> getStatus(@RequestParam String playerEmail) {
        guard.requireSelfEmailOrAdmin(playerEmail);
        Optional<Player> playerOpt = playerRepository.findByEmail(playerEmail);
        if (playerOpt.isEmpty()) {
            return ResponseEntity.badRequest().body("Player not found.");
        }
        List<VerificationDoc> docs = verificationDocRepository.findByPlayer_UserID(playerOpt.get().getUserID());
        return ResponseEntity.ok(docs);
    }

    /** Uploaded ID documents are visible to admins only (NFR 2.2.1). */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/view/{docID}")
    public ResponseEntity<byte[]> viewDocument(@PathVariable String docID) {
        Optional<VerificationDoc> docOpt = verificationDocRepository.findById(docID);
        if (docOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        return storage.load(docOpt.get())
                .map(f -> ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + f.fileName() + "\"")
                        .header(HttpHeaders.CACHE_CONTROL, "no-store")
                        .contentType(MediaType.parseMediaType(f.contentType()))
                        .body(f.data()))
                .orElse(ResponseEntity.notFound().build());
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
