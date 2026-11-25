package com.scd.courtly.controller;

import com.scd.courtly.model.Player;
import com.scd.courtly.model.VerificationDoc;
import com.scd.courtly.repository.PlayerRepository;
import com.scd.courtly.repository.VerificationDocRepository;
import com.scd.courtly.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/docs")
public class VerificationDocController {

    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024;
    private static final List<String> ALLOWED_EXTENSIONS = List.of("jpg", "jpeg", "png", "pdf");
    private static final String UPLOAD_DIR = "uploads/verification/";

    @Autowired
    private VerificationDocRepository verificationDocRepository;

    @Autowired
    private PlayerRepository playerRepository;

    @Autowired
    private NotificationService notificationService;

    @PostMapping("/upload")
    public ResponseEntity<?> uploadDocument(
            @RequestParam MultipartFile file,
            @RequestParam String docType,
            @RequestParam String playerEmail) {

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

        try {
            File uploadDir = new File(UPLOAD_DIR);
            if (!uploadDir.exists()) {
                uploadDir.mkdirs();
            }
            String savedFileName = UUID.randomUUID() + "." + extension;
            Path savePath = Paths.get(UPLOAD_DIR + savedFileName);
            Files.write(savePath, file.getBytes());

            VerificationDoc doc = new VerificationDoc();
            doc.setPlayer(playerOpt.get());
            doc.setDocType(docType);
            doc.setFileURL(UPLOAD_DIR + savedFileName);
            doc.setStatus("PENDING");

            VerificationDoc saved = verificationDocRepository.save(doc);

            Player player = playerOpt.get();
            notificationService.create(
                NotificationService.ADMIN_USER_ID,
                "VERIFICATION_REQUEST",
                "New Verification Request",
                player.getName() + " (" + playerEmail + ") submitted a " +
                formatDocType(docType) + " for discount verification. Please review."
            );

            return ResponseEntity.ok(saved);

        } catch (IOException e) {
            return ResponseEntity.internalServerError().body("Failed to save file: " + e.getMessage());
        }
    }

    @GetMapping("/status")
    public ResponseEntity<?> getStatus(@RequestParam String playerEmail) {
        Optional<Player> playerOpt = playerRepository.findByEmail(playerEmail);
        if (playerOpt.isEmpty()) {
            return ResponseEntity.badRequest().body("Player not found.");
        }
        List<VerificationDoc> docs = verificationDocRepository.findByPlayer_UserID(playerOpt.get().getUserID());
        return ResponseEntity.ok(docs);
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    @GetMapping("/view/{docID}")
    public ResponseEntity<Resource> viewDocument(@PathVariable String docID) {
        Optional<VerificationDoc> docOpt = verificationDocRepository.findById(docID);
        if (docOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Path filePath = Paths.get(docOpt.get().getFileURL());
        Resource resource = new FileSystemResource(filePath);
        if (!resource.exists()) {
            return ResponseEntity.notFound().build();
        }

        String fileURL = docOpt.get().getFileURL();
        String ext = fileURL.substring(fileURL.lastIndexOf('.') + 1).toLowerCase();
        String contentType = switch (ext) {
            case "pdf" -> "application/pdf";
            case "png" -> "image/png";
            default    -> "image/jpeg";
        };

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + resource.getFilename() + "\"")
                .contentType(MediaType.parseMediaType(contentType))
                .body(resource);
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
