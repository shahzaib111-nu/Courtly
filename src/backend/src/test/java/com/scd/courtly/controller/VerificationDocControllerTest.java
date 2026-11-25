package com.scd.courtly.controller;

import com.scd.courtly.model.Player;
import com.scd.courtly.repository.VerificationDocRepository;
import com.scd.courtly.support.IntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.ResultActions;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("Discount documents API  /api/docs")
class VerificationDocControllerTest extends IntegrationTest {

    @Autowired VerificationDocRepository docRepository;

    private Player player;
    private final List<String> uploadedFiles = new ArrayList<>();

    @BeforeEach
    void setUp() {
        player = newPlayer();
    }

    /** Uploads write real files to uploads/verification/; remove the ones this test created. */
    @AfterEach
    void deleteUploadedFiles() throws Exception {
        for (String f : uploadedFiles) Files.deleteIfExists(Path.of(f));
    }

    private ResultActions upload(String filename, byte[] content, String email) throws Exception {
        ResultActions result = mockMvc.perform(multipart("/api/docs/upload")
            .file(new MockMultipartFile("file", filename, "application/octet-stream", content))
            .param("docType", "STUDENT_ID").param("playerEmail", email)
            .header("Authorization", tokenFor(player)));
        docRepository.findByPlayer_UserID(player.getUserID()).forEach(d -> uploadedFiles.add(d.getFileURL()));
        return result;
    }

    @Test
    @DisplayName("POST /upload stores a PENDING document that can be viewed")
    void uploadAndView() throws Exception {
        String body = upload("student-id.pdf", "%PDF-1.4 test".getBytes(), player.getEmail())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("PENDING"))
            .andExpect(jsonPath("$.docID", startsWith("DOC-")))
            .andReturn().getResponse().getContentAsString();
        String docID = objectMapper.readTree(body).get("docID").asText();

        mockMvc.perform(get("/api/docs/status").param("playerEmail", player.getEmail()).header("Authorization", tokenFor(player)))
            .andExpect(jsonPath("$[*].docID", contains(docID)));

        mockMvc.perform(get("/api/docs/view/{id}", docID).header("Authorization", adminToken()))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/pdf"));
    }

    @Test
    @DisplayName("POST /upload rejects file types other than JPG/PNG/PDF")
    void badExtension() throws Exception {
        upload("virus.exe", new byte[]{1, 2, 3}, player.getEmail())
            .andExpect(status().isBadRequest())
            .andExpect(content().string(containsString("Invalid file type")));
    }

    @Test
    @DisplayName("POST /upload for an unknown player → 400")
    void unknownPlayer() throws Exception {
        upload("id.png", new byte[]{1}, "ghost@test.local")
            .andExpect(status().isBadRequest())
            .andExpect(content().string(containsString("No player account")));
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
