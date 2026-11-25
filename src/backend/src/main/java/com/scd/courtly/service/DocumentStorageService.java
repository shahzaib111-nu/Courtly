package com.scd.courtly.service;

import com.scd.courtly.exception.BusinessException;
import com.scd.courtly.model.Player;
import com.scd.courtly.model.VerificationDoc;
import com.scd.courtly.model.VerificationDocContent;
import com.scd.courtly.repository.VerificationDocContentRepository;
import com.scd.courtly.repository.VerificationDocRepository;
import com.scd.courtly.security.DocumentCipher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Optional;

/**
 * Stores uploaded verification documents encrypted in the database (NFR 2.2.1, 2.2.2).
 * Nothing readable is written to disk. Documents uploaded before encryption existed are
 * moved into the database by {@link #migrateLegacyFiles()}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DocumentStorageService {

    /** Marker in {@link VerificationDoc#getFileURL()} for documents held encrypted in the database. */
    public static final String ENCRYPTED_DB = "encrypted-db";

    private final VerificationDocRepository docRepository;
    private final VerificationDocContentRepository contentRepository;
    private final DocumentCipher cipher;

    public record StoredFile(byte[] data, String contentType, String fileName) {}

    public boolean isEnabled() {
        return cipher.isEnabled();
    }

    /** Checks the file really is a PDF/PNG/JPEG (by its first bytes) and returns its media type. */
    public static String detectContentType(byte[] data) {
        if (data.length >= 4 && data[0] == '%' && data[1] == 'P' && data[2] == 'D' && data[3] == 'F') {
            return "application/pdf";
        }
        if (data.length >= 8 && (data[0] & 0xFF) == 0x89 && data[1] == 'P' && data[2] == 'N' && data[3] == 'G') {
            return "image/png";
        }
        if (data.length >= 3 && (data[0] & 0xFF) == 0xFF && (data[1] & 0xFF) == 0xD8 && (data[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        return null;
    }

    @Transactional
    public VerificationDoc store(Player player, String docType, byte[] data) {
        if (!isEnabled()) {
            throw new BusinessException("Document uploads are not configured on this server.",
                HttpStatus.SERVICE_UNAVAILABLE);
        }
        String contentType = detectContentType(data);
        if (contentType == null) {
            throw new BusinessException("The file content is not a valid JPG, PNG or PDF.");
        }
        VerificationDoc doc = new VerificationDoc();
        doc.setPlayer(player);
        doc.setDocType(docType);
        doc.setFileURL(ENCRYPTED_DB);
        doc.setStatus("PENDING");
        VerificationDoc saved = docRepository.save(doc);
        saveContent(saved.getDocID(), data, contentType);
        return saved;
    }

    /** Decrypted file for the admin viewer; empty when the document or its contents are missing. */
    public Optional<StoredFile> load(VerificationDoc doc) {
        Optional<VerificationDocContent> content = contentRepository.findById(doc.getDocID());
        if (content.isPresent()) {
            VerificationDocContent c = content.get();
            return Optional.of(new StoredFile(cipher.decrypt(c.getEncryptedData()), c.getContentType(),
                doc.getDocID() + extensionFor(c.getContentType())));
        }
        // Legacy plaintext file that has not been migrated yet (no key configured at startup)
        Path legacy = legacyPath(doc);
        if (legacy != null && Files.isRegularFile(legacy)) {
            try {
                byte[] data = Files.readAllBytes(legacy);
                String type = Optional.ofNullable(detectContentType(data)).orElse("application/octet-stream");
                return Optional.of(new StoredFile(data, type, legacy.getFileName().toString()));
            } catch (IOException e) {
                log.warn("Could not read legacy document {}: {}", doc.getDocID(), e.getMessage());
            }
        }
        return Optional.empty();
    }

    @Transactional
    public void deleteAllFor(String playerID) {
        List<VerificationDoc> docs = docRepository.findByPlayer_UserID(playerID);
        for (VerificationDoc d : docs) {
            contentRepository.deleteById(d.getDocID());
            Path legacy = legacyPath(d);
            if (legacy != null) {
                try { Files.deleteIfExists(legacy); } catch (IOException ignored) {}
            }
        }
        docRepository.deleteAll(docs);
    }

    /**
     * Encrypts documents still stored as plain files on disk into the database, then deletes
     * the plain files. Skipped when no encryption key is configured.
     *
     * @return the number of documents migrated
     */
    @Transactional
    public int migrateLegacyFiles() {
        if (!isEnabled()) return 0;
        int migrated = 0;
        for (VerificationDoc doc : docRepository.findAll()) {
            Path legacy = legacyPath(doc);
            if (legacy == null || contentRepository.existsById(doc.getDocID())) continue;
            if (!Files.isRegularFile(legacy)) continue;
            try {
                byte[] data = Files.readAllBytes(legacy);
                String type = Optional.ofNullable(detectContentType(data)).orElse("application/octet-stream");
                saveContent(doc.getDocID(), data, type);
                doc.setFileURL(ENCRYPTED_DB);
                docRepository.save(doc);
                Files.delete(legacy);
                migrated++;
            } catch (IOException e) {
                log.warn("Could not encrypt legacy document {}: {}", doc.getDocID(), e.getMessage());
            }
        }
        if (migrated > 0) log.info("Encrypted {} verification document(s) into the database", migrated);
        return migrated;
    }

    private void saveContent(String docID, byte[] data, String contentType) {
        VerificationDocContent c = new VerificationDocContent();
        c.setDocID(docID);
        c.setEncryptedData(cipher.encrypt(data));
        c.setContentType(contentType);
        c.setOriginalSize(data.length);
        contentRepository.save(c);
    }

    /** Path of an old plaintext upload, or null for encrypted documents. */
    private static Path legacyPath(VerificationDoc doc) {
        String url = doc.getFileURL();
        if (url == null || url.isBlank() || ENCRYPTED_DB.equals(url)) return null;
        Path p = Paths.get(url).normalize();
        // only ever touch files inside the old upload folder
        return p.startsWith(Paths.get("uploads/verification")) ? p : null;
    }

    private static String extensionFor(String contentType) {
        return switch (contentType) {
            case "application/pdf" -> ".pdf";
            case "image/png" -> ".png";
            default -> ".jpg";
        };
    }
}
