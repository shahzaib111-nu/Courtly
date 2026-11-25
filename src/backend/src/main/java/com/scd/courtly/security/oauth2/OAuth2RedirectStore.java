package com.scd.courtly.security.oauth2;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Remembers, for the length of one OAuth2 round trip, where the frontend wants
 * the result sent and which role the user picked on the login page.
 *
 * Only redirect targets on an allow-listed origin are accepted, so the backend
 * cannot be used to send a freshly issued JWT to an attacker's site.
 */
@Component
public class OAuth2RedirectStore {

    private static final String REDIRECT_ATTR = "oauth2.frontendRedirect";
    private static final String ROLE_ATTR = "oauth2.requestedRole";

    private final List<String> allowedOrigins;

    public OAuth2RedirectStore(
            @Value("${app.oauth2.allowed-redirect-origins:http://localhost:5500,http://127.0.0.1:5500,http://localhost:5501,http://127.0.0.1:5501}") String origins) {
        this.allowedOrigins = Arrays.stream(origins.split(","))
            .map(String::trim).filter(s -> !s.isEmpty())
            .map(s -> s.replaceAll("/+$", "").toLowerCase(Locale.ROOT))
            .toList();
    }

    public boolean isAllowed(String redirectUri) {
        try {
            URI uri = URI.create(redirectUri);
            if (uri.getScheme() == null || uri.getHost() == null) return false;
            String origin = uri.getScheme() + "://" + uri.getHost() + (uri.getPort() == -1 ? "" : ":" + uri.getPort());
            return allowedOrigins.contains(origin.toLowerCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    public void save(HttpServletRequest request, String redirectUri, String role) {
        HttpSession session = request.getSession(true);
        session.setAttribute(REDIRECT_ATTR, redirectUri);
        session.setAttribute(ROLE_ATTR, role);
    }

    public String redirectUri(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        return session == null ? null : (String) session.getAttribute(REDIRECT_ATTR);
    }

    public String requestedRole(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        return session == null ? null : (String) session.getAttribute(ROLE_ATTR);
    }

    /** The session only exists for the OAuth2 handshake; drop it once the result is delivered. */
    public void clear(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) session.invalidate();
    }
}
