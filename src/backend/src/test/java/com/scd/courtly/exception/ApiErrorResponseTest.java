package com.scd.courtly.exception;

import com.scd.courtly.support.IntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Every error uses the same JSON shape: timestamp, status, error, message, path. */
@DisplayName("API error responses (GlobalExceptionHandler)")
class ApiErrorResponseTest extends IntegrationTest {

    @Test
    @DisplayName("business errors use the standard error body")
    void standardBody() throws Exception {
        mockMvc.perform(post("/api/auth/login").param("email", "ghost@test.local").param("pass", "Whatever1"))
            .andExpect(status().isUnauthorized())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.timestamp").exists())
            .andExpect(jsonPath("$.status").value(401))
            .andExpect(jsonPath("$.error").value("Unauthorized"))
            .andExpect(jsonPath("$.message").exists())
            .andExpect(jsonPath("$.path").value("/api/auth/login"));
    }

    @Test
    @DisplayName("malformed JSON → 400")
    void malformedJson() throws Exception {
        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content("{not json"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    @DisplayName("wrong HTTP method → 405")
    void wrongMethod() throws Exception {
        mockMvc.perform(put("/api/auth/login"))
            .andExpect(status().isMethodNotAllowed());
    }

    @Test
    @DisplayName("unknown endpoint → 404")
    void unknownEndpoint() throws Exception {
        mockMvc.perform(get("/api/does-not-exist").header("Authorization", playerToken()))
            .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("error responses never leak stack traces")
    void noStackTrace() throws Exception {
        mockMvc.perform(get("/api/bookings/price").param("courtID", "NOPE").param("timeSlot", "x").param("date", "y"))
            .andExpect(content().string(not(containsString("at com.scd"))))
            .andExpect(content().string(not(containsString("Exception"))));
    }
}
