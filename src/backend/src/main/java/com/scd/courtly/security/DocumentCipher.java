package com.scd.courtly.security;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Encrypts uploaded verification documents (NFR 2.2.1) with AES-256-GCM.
 * The key is {@code app.uploads.encryption-key} in secrets.yml: 32 random bytes, Base64-encoded.
 * GCM also detects tampering: a modified file fails to decrypt.
 *
 * <p>Stored format: {@code [version=1][12-byte IV][ciphertext + 16-byte tag]}.
 */
@Slf4j
@Component
public class DocumentCipher {

    private static final byte VERSION = 1;
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final SecretKeySpec key;

    public DocumentCipher(@Value("${app.uploads.encryption-key:}") String base64Key) {
        this.key = parseKey(base64Key);
    }

    private static SecretKeySpec parseKey(String base64Key) {
        if (base64Key == null || base64Key.isBlank()) return null;
        byte[] raw;
        try {
            raw = Base64.getDecoder().decode(base64Key.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("app.uploads.encryption-key is not valid Base64");
        }
        if (raw.length != 32) {
            throw new IllegalStateException("app.uploads.encryption-key must be 32 bytes (Base64 of 32 random bytes)");
        }
        return new SecretKeySpec(raw, "AES");
    }

    @PostConstruct
    void warnIfDisabled() {
        if (!isEnabled()) {
            log.warn("Document uploads are disabled: set app.uploads.encryption-key in secrets.yml");
        }
    }

    public boolean isEnabled() {
        return key != null;
    }

    public byte[] encrypt(byte[] plain) {
        requireKey();
        try {
            byte[] iv = new byte[IV_BYTES];
            RANDOM.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            byte[] sealed = cipher.doFinal(plain);
            return ByteBuffer.allocate(1 + IV_BYTES + sealed.length).put(VERSION).put(iv).put(sealed).array();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Could not encrypt the document", e);
        }
    }

    public byte[] decrypt(byte[] stored) {
        requireKey();
        if (stored == null || stored.length < 1 + IV_BYTES + TAG_BITS / 8 || stored[0] != VERSION) {
            throw new IllegalStateException("The stored document is not in the expected encrypted format");
        }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, stored, 1, IV_BYTES));
            return cipher.doFinal(stored, 1 + IV_BYTES, stored.length - 1 - IV_BYTES);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("The document could not be decrypted (wrong key or modified data)", e);
        }
    }

    private void requireKey() {
        if (!isEnabled()) throw new IllegalStateException("app.uploads.encryption-key is not configured");
    }
}
