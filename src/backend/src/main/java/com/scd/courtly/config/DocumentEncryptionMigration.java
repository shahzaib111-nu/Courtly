package com.scd.courtly.config;

import com.scd.courtly.service.DocumentStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/** At startup, encrypts verification documents that are still plain files on disk (NFR 2.2.1). */
@Component
@RequiredArgsConstructor
public class DocumentEncryptionMigration {

    private final DocumentStorageService storage;

    @EventListener(ApplicationReadyEvent.class)
    public void encryptLegacyUploads() {
        storage.migrateLegacyFiles();
    }
}
