package com.scd.courtly.security.oauth2;

import com.scd.courtly.dto.response.LoginResponse;
import com.scd.courtly.service.OAuth2AccountService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Runs after the provider has authenticated the user: signs them in to
 * Courtly (via {@link OAuth2AccountService}) and redirects back to the
 * frontend callback page.
 *
 * Results travel in the URL fragment (#...), which browsers never send to a
 * server, so the JWT does not end up in server logs or Referer headers.
 */
@Component
@RequiredArgsConstructor
public class OAuth2LoginSuccessHandler implements AuthenticationSuccessHandler {

    private final OAuth2AccountService accountService;
    private final OAuth2RedirectStore redirectStore;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        String redirectUri = redirectStore.redirectUri(request);
        String requestedRole = redirectStore.requestedRole(request);
        redirectStore.clear(request);

        if (redirectUri == null) {
            response.sendError(HttpServletResponse.SC_BAD_REQUEST,
                "OAuth2 login must be started from /api/auth/oauth2/authorize/{provider}");
            return;
        }

        OAuth2User principal = (OAuth2User) authentication.getPrincipal();
        OAuth2UserProfile profile = principal.getAttribute(CustomOAuth2UserService.PROFILE_ATTRIBUTE);
        LoginResponse result = accountService.signIn(profile, requestedRole);

        Map<String, String> fragment = new LinkedHashMap<>();
        if (result.success()) {
            fragment.put("token", result.token());
            fragment.put("expiresIn", String.valueOf(result.expiresIn()));
            fragment.put("role", result.role());
            fragment.put("playerID", result.playerID());
            fragment.put("name", result.name());
            fragment.put("email", profile.email());
            fragment.put("accountStatus", result.accountStatus());
            fragment.put("provider", profile.provider());
        } else {
            fragment.put("error", result.message());
        }
        response.sendRedirect(redirectUri + "#" + encode(fragment));
    }

    static String encode(Map<String, String> params) {
        return params.entrySet().stream()
            .filter(e -> e.getValue() != null)
            .map(e -> e.getKey() + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
            .collect(Collectors.joining("&"));
    }
}
