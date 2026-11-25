package com.scd.courtly.service;

import com.scd.courtly.support.IntegrationTest;
import com.scd.courtly.support.TestData;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** NFR 3.3 / 3.3.1: backups are made and can really be restored. */
@DisplayName("Database backups (NFR 3.3)")
class BackupServiceTest extends IntegrationTest {

    @Autowired JdbcTemplate jdbc;
    @TempDir Path tempDir;

    private BackupService service(String password, int keep) {
        return new BackupService(jdbc, true, tempDir.toString(), 7, keep, password);
    }

    @AfterEach
    void cleanUp() throws Exception {
        try (var s = Files.list(tempDir)) { s.forEach(p -> p.toFile().delete()); }
    }

    /** Loads a backup into a brand-new in-memory database and counts its players. */
    private long restoredPlayerCount(Path backup, String password) throws SQLException {
        String url = "jdbc:h2:mem:restore-" + UUID.randomUUID();
        try (Connection c = DriverManager.getConnection(url, "sa", ""); Statement st = c.createStatement()) {
            st.execute("RUNSCRIPT FROM '" + backup + "'"
                + (password == null ? " COMPRESSION ZIP" : " COMPRESSION DEFLATE CIPHER AES PASSWORD '" + password + "'"));
            try (ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM player")) {
                rs.next();
                return rs.getLong(1);
            }
        }
    }

    @Test
    @DisplayName("a backup restores into an empty database with all the data")
    void backupAndRestore() throws Exception {
        long players = jdbc.queryForObject("SELECT COUNT(*) FROM player", Long.class);
        BackupService.BackupFile file = service("", 8).runBackup();

        Path zip = tempDir.resolve(file.fileName());
        assertThat(zip).exists();
        assertThat(file.sizeBytes()).isPositive();
        assertThat(restoredPlayerCount(zip, null)).isEqualTo(players);
    }

    @Test
    @DisplayName("with a backup password the file is encrypted and needs the password to restore")
    void encryptedBackup() throws Exception {
        BackupService.BackupFile file = service("Backup-Pass-1", 8).runBackup();
        Path zip = tempDir.resolve(file.fileName());

        assertThat(file.fileName()).endsWith(".enc");
        assertThat(restoredPlayerCount(zip, "Backup-Pass-1")).isPositive();
        assertThatThrownBy(() -> restoredPlayerCount(zip, "Wrong-Pass-2")).isInstanceOf(SQLException.class);
        assertThat(new String(Files.readAllBytes(zip), java.nio.charset.StandardCharsets.ISO_8859_1))
            .doesNotContain(TestData.PLAYER_EMAIL);
    }

    @Test
    @DisplayName("only the newest backups are kept")
    void retention() throws Exception {
        BackupService svc = service("", 2);
        for (int i = 0; i < 3; i++) {
            svc.runBackup();
            Thread.sleep(1100);   // file names have one-second resolution
        }
        assertThat(svc.list()).hasSize(2);
    }

    @Test
    @DisplayName("the scheduled check backs up when none exists yet, then waits for the interval")
    void backupIfDue() {
        BackupService svc = service("", 8);
        svc.backupIfDue();
        assertThat(svc.list()).hasSize(1);
        svc.backupIfDue();                       // newest is less than 7 days old
        assertThat(svc.list()).hasSize(1);
        assertThat(svc.status().nextDueAt()).isAfter(java.time.LocalDateTime.now().plusDays(6));
    }

    @Test
    @DisplayName("admins can see the backup status and start one; others cannot")
    void adminEndpoints() throws Exception {
        mockMvc.perform(get("/api/admin/backups").header("Authorization", adminToken()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.intervalDays").value(7))
            .andExpect(jsonPath("$.backups").isArray());
        mockMvc.perform(post("/api/admin/backups").header("Authorization", adminToken()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.fileName", org.hamcrest.Matchers.startsWith("courtly-backup-")));
        mockMvc.perform(post("/api/admin/backups").header("Authorization", managerToken()))
            .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/backups").header("Authorization", playerToken()))
            .andExpect(status().isForbidden());
    }
}
