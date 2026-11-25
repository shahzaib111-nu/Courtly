package com.scd.courtly.security.oauth2;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("unit")
@DisplayName("OAuth2RedirectStore")
class OAuth2RedirectStoreTest {

    private final OAuth2RedirectStore store =
        new OAuth2RedirectStore("http://localhost:5501, http://127.0.0.1:5500/");

    @ParameterizedTest(name = "allows {0}")
    @ValueSource(strings = {
        "http://localhost:5501/src/frontend/oauth-callback.html",
        "http://LOCALHOST:5501/oauth-callback.html",
        "http://127.0.0.1:5500/x"})
    void allowsConfiguredOrigins(String uri) {
        assertThat(store.isAllowed(uri)).isTrue();
    }

    @ParameterizedTest(name = "rejects {0}")
    @ValueSource(strings = {
        "https://evil.example/steal",
        "http://localhost:9999/oauth-callback.html",   // other port
        "https://localhost:5501/oauth-callback.html",  // other scheme
        "http://localhost:5501.evil.example/",          // look-alike host
        "/relative/path",
        "javascript:alert(1)",
        "not a uri"})
    void rejectsEverythingElse(String uri) {
        assertThat(store.isAllowed(uri)).isFalse();
    }

    @Test
    @DisplayName("remembers redirect and role for one round trip, then forgets them")
    void saveAndClear() {
        MockHttpServletRequest request = new MockHttpServletRequest();

        store.save(request, "http://localhost:5501/cb", "MANAGER");
        assertThat(store.redirectUri(request)).isEqualTo("http://localhost:5501/cb");
        assertThat(store.requestedRole(request)).isEqualTo("MANAGER");

        store.clear(request);
        assertThat(store.redirectUri(request)).isNull();
        assertThat(store.requestedRole(request)).isNull();
    }
}
