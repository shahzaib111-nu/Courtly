package com.scd.courtly.controller;

import com.scd.courtly.model.Player;
import com.scd.courtly.model.VerificationDocContent;
import com.scd.courtly.repository.VerificationDocContentRepository;
import com.scd.courtly.repository.VerificationDocRepository;
import com.scd.courtly.service.DocumentStorageService;
import com.scd.courtly.support.IntegrationTest;
import com.scd.courtly.support.TestData;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.ResultActions;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("Discount documents API  /api/docs")
class VerificationDocControllerTest extends IntegrationTest {

    @Autowired VerificationDocRepository docRepository;

    @Autowired VerificationDocContentRepository contentRepository;

    private static final byte[] PDF = "%PDF-1.4 student card".getBytes();
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3};

    private Player player;

    @BeforeEach
    void setUp() {
        player = newPlayer();
    }

    private ResultActions upload(String filename, byte[] content, String email) throws Exception {
        ResultActions result = mockMvc.perform(multipart("/api/docs/upload")
            .file(new MockMultipartFile("file", filename, "application/octet-stream", content))
            .param("docType", "STUDENT_ID").param("playerEmail", email)
            .header("Authorization", tokenFor(player)));
        return result;
    }

    @Test
    @DisplayName("POST /upload stores a PENDING document that can be viewed")
    void uploadAndView() throws Exception {
        String body = upload("student-id.pdf", PDF, player.getEmail())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("PENDING"))
            .andExpect(jsonPath("$.docID", startsWith("DOC-")))
            .andReturn().getResponse().getContentAsString();
        String docID = objectMapper.readTree(body).get("docID").asText();

        mockMvc.perform(get("/api/docs/status").param("playerEmail", player.getEmail()).header("Authorization", tokenFor(player)))
            .andExpect(jsonPath("$[*].docID", contains(docID)));

        mockMvc.perform(get("/api/docs/view/{id}", docID).header("Authorization", adminToken()))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/pdf"))
            .andExpect(content().bytes(PDF));
    }

    @Test
    @DisplayName("NFR 2.2.1: the document is stored encrypted in the database, not as a readable file")
    void storedEncrypted() throws Exception {
        String body = upload("card.png", PNG, player.getEmail())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.fileURL").value(DocumentStorageService.ENCRYPTED_DB))
            .andReturn().getResponse().getContentAsString();
        String docID = objectMapper.readTree(body).get("docID").asText();

        VerificationDocContent stored = contentRepository.findById(docID).orElseThrow();
        assertThat(stored.getContentType()).isEqualTo("image/png");
        assertThat(stored.getOriginalSize()).isEqualTo(PNG.length);
        assertThat(stored.getEncryptedData()).isNotEqualTo(PNG);
        assertThat(new String(stored.getEncryptedData(), java.nio.charset.StandardCharsets.ISO_8859_1))
            .doesNotContain("PNG");                                   // the plaintext is not visible
        assertThat(stored.getEncryptedData().length).isEqualTo(1 + 12 + PNG.length + 16); // version, IV, tag
    }

    @Test
    @DisplayName("NFR 2.2.2: a file whose content is not really a JPG/PNG/PDF is rejected")
    void fakeExtension() throws Exception {
        upload("notes.pdf", "just some text".getBytes(), player.getEmail())
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message", containsString("not a valid JPG, PNG or PDF")));
        assertThat(docRepository.findByPlayer_UserID(player.getUserID())).isEmpty();
    }

    @Test
    @DisplayName("POST /upload rejects file types other than JPG/PNG/PDF")
    void badExtension() throws Exception {
        upload("virus.exe", new byte[]{1, 2, 3}, player.getEmail())
            .andExpect(status().isBadRequest())
            .andExpect(content().string(containsString("Invalid file type")));
    }

    @Test
    @DisplayName("POST /upload to someone else's account → 403")
    void otherAccount() throws Exception {
        upload("id.png", PNG, TestData.PLAYER_EMAIL)
            .andExpect(status().isForbidden());
        upload("id.png", PNG, "ghost@test.local")
            .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /upload without a token → 401")
    void anonymous() throws Exception {
        mockMvc.perform(multipart("/api/docs/upload")
                .file(new MockMultipartFile("file", "id.png", "image/png", new byte[]{1}))
                .param("docType", "STUDENT_ID").param("playerEmail", player.getEmail()))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /view/{id} for an unknown document → 404")
    void viewUnknown() throws Exception {
        mockMvc.perform(get("/api/docs/view/{id}", "DOC-NOPE").header("Authorization", adminToken()))
            .andExpect(status().isNotFound());
    }
}
