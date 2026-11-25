package com.scd.courtly.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * The encrypted bytes of an uploaded verification document (NFR 2.2.1). Kept apart from
 * {@link VerificationDoc} so listing requests never loads file contents.
 */
@Data
@NoArgsConstructor
@Entity
@Table(name = "verification_doc_contents")
public class VerificationDocContent {

    @Id
    private String docID;

    @Lob
    @Column(nullable = false, length = 6 * 1024 * 1024)
    private byte[] encryptedData;   // AES-256-GCM, see DocumentCipher

    @Column(nullable = false)
    private String contentType;     // application/pdf, image/png or image/jpeg

    private long originalSize;
}
