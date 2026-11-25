package com.scd.courtly.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Date;
import java.util.UUID;

@Data
@NoArgsConstructor
@Entity
public class VerificationDoc {

    @Id
    private String docID;

    private String fileURL;
    private Date uploadDate;
    private String status;
    private String docType;
    private String rejectionReason;
    private Date reviewedAt;
    private String reviewedBy;      // the admin who approved or rejected it

    @ManyToOne
    @JoinColumn(name = "player_id")
    private Player player;

    @PrePersist
    public void generateId() {
        if (this.docID == null) {
            this.docID = "DOC-" + UUID.randomUUID().toString().substring(0, 8);
        }
        if (this.uploadDate == null) {
            this.uploadDate = new Date();
        }
    }
}