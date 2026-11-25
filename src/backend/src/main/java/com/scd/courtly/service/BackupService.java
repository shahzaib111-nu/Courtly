package com.scd.courtly.service;

import com.scd.courtly.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * Automated database backups (NFR 3.3): a full backup at least every 7 days.
 *
 * <p>The whole H2 database is exported with {@code SCRIPT TO ... COMPRESSION ZIP} into
 * {@code app.backup.dir} (a {@code .zip}, or an AES-encrypted {@code .enc} when a password is set).
 * Point that folder at a cloud-synced folder (Google Drive,
 * OneDrive, Dropbox) to keep the copies off the machine. With {@code app.backup.password}
 * set, backups are AES-encrypted. Old backups beyond {@code app.backup.keep} are deleted.
 * Restore with {@code scripts/restore-backup.sh} (see README).
 *
 * <p>An hourly check makes a backup whenever the newest one is older than the interval, so a
 * backup still happens if the server was off at the scheduled time.
 */
@Slf4j
@Service
public class BackupService {

    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");
    private static final String PREFIX = "courtly-backup-";

    private final JdbcTemplate jdbc;
    private final boolean enabled;
    private final Path dir;
    private final int intervalDays;
    private final int keep;
    private final String password;

    public record BackupFile(String fileName, long sizeBytes, LocalDateTime createdAt) {}

    public record BackupStatus(boolean enabled, String directory, int intervalDays, int keep,
                               boolean encrypted, LocalDateTime lastBackupAt, LocalDateTime nextDueAt,
                               List<BackupFile> backups) {}

    public BackupService(JdbcTemplate jdbc,
                         @Value("${app.backup.enabled:true}") boolean enabled,
                         @Value("${app.backup.dir:backups}") String dir,
                         @Value("${app.backup.interval-days:7}") int intervalDays,
                         @Value("${app.backup.keep:8}") int keep,
                         @Value("${app.backup.password:}") String password) {
        this.jdbc = jdbc;
        this.enabled = enabled;
        this.dir = Paths.get(dir).toAbsolutePath().normalize();
        this.intervalDays = Math.max(1, intervalDays);
        this.keep = Math.max(1, keep);
        this.password = password == null ? "" : password;
    }

    /** Hourly: back up if the newest backup is older than the interval (or there is none). */
    @Scheduled(cron = "${app.backup.check-cron:0 7 * * * *}")
    public void backupIfDue() {
        if (!enabled) return;
        LocalDateTime last = latest().map(BackupFile::createdAt).orElse(null);
        if (last == null || !last.plusDays(intervalDays).isAfter(LocalDateTime.now())) {
            try {
                runBackup();
            } catch (RuntimeException e) {
                log.error("Scheduled database backup failed: {}", e.getMessage());
            }
        }
    }

    /** Makes a backup now and removes the oldest ones beyond the retention limit. */
    public synchronized BackupFile runBackup() {
        try {
            Files.createDirectories(dir);
        } catch (IOException e) {
            throw new BusinessException("Cannot create the backup folder " + dir, HttpStatus.INTERNAL_SERVER_ERROR);
        }
        // Plain backups are ordinary .zip files; encrypted ones (H2 cannot encrypt ZIP) are DEFLATE + AES.
        boolean encrypt = !password.isBlank();
        Path file = dir.resolve(PREFIX + LocalDateTime.now().format(STAMP) + (encrypt ? ".enc" : ".zip"));
        Instant started = Instant.now();
        String sql = "SCRIPT TO '" + quote(file.toString()) + "'"
            + (encrypt ? " COMPRESSION DEFLATE CIPHER AES PASSWORD '" + quote(password) + "'" : " COMPRESSION ZIP");
        jdbc.execute(sql);
        BackupFile result = describe(file);
        log.info("Database backup written: {} ({} KB, {} ms)", file.getFileName(),
            result.sizeBytes() / 1024, Duration.between(started, Instant.now()).toMillis());
        prune();
        return result;
    }

    public BackupStatus status() {
        List<BackupFile> files = list();
        LocalDateTime last = files.isEmpty() ? null : files.get(0).createdAt();
        return new BackupStatus(enabled, dir.toString(), intervalDays, keep, !password.isBlank(), last,
            last == null ? LocalDateTime.now() : last.plusDays(intervalDays), files);
    }

    /** Backups, newest first. */
    public List<BackupFile> list() {
        if (!Files.isDirectory(dir)) return List.of();
        try (Stream<Path> s = Files.list(dir)) {
            return s.filter(p -> p.getFileName().toString().startsWith(PREFIX)
                    && (p.toString().endsWith(".zip") || p.toString().endsWith(".enc")))
                .map(this::describe)
                .sorted(Comparator.comparing(BackupFile::createdAt).reversed())
                .toList();
        } catch (IOException e) {
            return List.of();
        }
    }

    private Optional<BackupFile> latest() {
        return list().stream().findFirst();
    }

    private void prune() {
        List<BackupFile> files = list();
        for (BackupFile old : files.subList(Math.min(keep, files.size()), files.size())) {
            try {
                Files.deleteIfExists(dir.resolve(old.fileName()));
                log.info("Old backup removed: {}", old.fileName());
            } catch (IOException e) {
                log.warn("Could not remove old backup {}: {}", old.fileName(), e.getMessage());
            }
        }
    }

    private BackupFile describe(Path p) {
        try {
            return new BackupFile(p.getFileName().toString(), Files.size(p),
                LocalDateTime.ofInstant(Files.getLastModifiedTime(p).toInstant(), ZoneId.systemDefault()));
        } catch (IOException e) {
            return new BackupFile(p.getFileName().toString(), 0, LocalDateTime.MIN);
        }
    }

    private static String quote(String s) {
        return s.replace("'", "''");
    }
}
