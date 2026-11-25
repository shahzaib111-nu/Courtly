package com.scd.courtly.controller;

import com.scd.courtly.config.OAuth2ClientConfig.ConfiguredClientRegistrations;
import com.scd.courtly.exception.BusinessException;
import com.scd.courtly.exception.NotFoundException;
import com.scd.courtly.security.oauth2.OAuth2RedirectStore;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.List;
import java.util.Map;

/**
 * Entry points for Google / GitHub sign-in.
 *
 * Flow:
 *  1. Frontend calls GET /api/auth/oauth2/providers to decide which buttons to show.
 *  2. Button navigates to GET /api/auth/oauth2/authorize/{provider}?redirect_uri=...&role=...
 *  3. Spring Security redirects to the provider, which calls back /login/oauth2/code/{provider}.
 *  4. OAuth2LoginSuccessHandler issues a JWT and redirects to redirect_uri#token=...
 */
@RestController
@RequestMapping("/api/auth/oauth2")
@RequiredArgsConstructor
public class OAuth2Controller {

    private final ConfiguredClientRegistrations registrations;
    private final OAuth2RedirectStore redirectStore;

    @GetMapping("/providers")
    public ResponseEntity<Map<String, List<String>>> providers() {
        return ResponseEntity.ok(Map.of("providers", registrations.providerIds()));
    }

    @GetMapping("/authorize/{provider}")
    public void authorize(@PathVariable String provider,
                          @RequestParam("redirect_uri") String redirectUri,
                          @RequestParam(required = false) String role,
                          HttpServletRequest request,
                          HttpServletResponse response) throws IOException {
        String id = provider.toLowerCase();
        if (registrations.findByRegistrationId(id) == null) {
            throw new NotFoundException("OAuth2 provider '" + provider + "' is not configured");
        }
        if (!redirectStore.isAllowed(redirectUri)) {
            throw new BusinessException("redirect_uri is not on an allowed origin");
        }
        redirectStore.save(request, redirectUri, role == null ? null : role.toUpperCase());
        response.sendRedirect(request.getContextPath() + "/oauth2/authorization/" + id);
    }
}
