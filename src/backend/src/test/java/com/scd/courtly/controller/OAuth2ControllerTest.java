package com.scd.courtly.controller;

import com.scd.courtly.support.IntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("OAuth2 social login API  /api/auth/oauth2")
class OAuth2ControllerTest extends IntegrationTest {

    private static final String CALLBACK = "http://localhost:5501/src/frontend/oauth-callback.html";

    @Test
    @DisplayName("GET /providers lists configured providers (public)")
    void providers() throws Exception {
        mockMvc.perform(get("/api/auth/oauth2/providers"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.providers", containsInAnyOrder("google", "github")));
    }

    @Test
    @DisplayName("GET /authorize/github redirects into Spring Security, which redirects to GitHub")
    void authorizeGithub() throws Exception {
        MvcResult start = mockMvc.perform(get("/api/auth/oauth2/authorize/github")
                .param("redirect_uri", CALLBACK).param("role", "player"))
            .andExpect(status().isFound())
            .andExpect(redirectedUrl("/oauth2/authorization/github"))
            .andReturn();

        MockHttpSession session = (MockHttpSession) start.getRequest().getSession(false);
        assertThat(session).isNotNull();
        assertThat(session.getAttribute("oauth2.frontendRedirect")).isEqualTo(CALLBACK);
        assertThat(session.getAttribute("oauth2.requestedRole")).isEqualTo("PLAYER");

        mockMvc.perform(get("/oauth2/authorization/github").session(session))
            .andExpect(status().isFound())
            .andExpect(header().string("Location", startsWith("https://github.com/login/oauth/authorize")));
    }

    @Test
    @DisplayName("GET /authorize/google redirects to Google's consent screen")
    void authorizeGoogle() throws Exception {
        MvcResult start = mockMvc.perform(get("/api/auth/oauth2/authorize/google").param("redirect_uri", CALLBACK))
            .andExpect(status().isFound()).andReturn();

        mockMvc.perform(get("/oauth2/authorization/google").session((MockHttpSession) start.getRequest().getSession(false)))
            .andExpect(header().string("Location", startsWith("https://accounts.google.com/o/oauth2/v2/auth")));
    }

    @Test
    @DisplayName("redirect_uri on a foreign origin → 400")
    void foreignRedirect() throws Exception {
        mockMvc.perform(get("/api/auth/oauth2/authorize/github").param("redirect_uri", "https://evil.example/cb"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("redirect_uri is not on an allowed origin"));
    }

    @Test
    @DisplayName("unknown provider → 404")
    void unknownProvider() throws Exception {
        mockMvc.perform(get("/api/auth/oauth2/authorize/facebook").param("redirect_uri", CALLBACK))
            .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("provider callback with an error is sent back to the frontend")
    void providerErrorGoesToFrontend() throws Exception {
        MvcResult start = mockMvc.perform(get("/api/auth/oauth2/authorize/github").param("redirect_uri", CALLBACK))
            .andReturn();
        MockHttpSession session = (MockHttpSession) start.getRequest().getSession(false);
        String location = mockMvc.perform(get("/oauth2/authorization/github").session(session))
            .andReturn().getResponse().getHeader("Location");
        String state = java.net.URLDecoder.decode(location.replaceAll(".*[?&]state=([^&]+).*", "$1"),
            java.nio.charset.StandardCharsets.UTF_8);

        mockMvc.perform(get("/login/oauth2/code/github").session(session)
                .param("error", "access_denied").param("state", state))
            .andExpect(status().isFound())
            .andExpect(redirectedUrl(CALLBACK + "#error=access_denied"));
    }
}
