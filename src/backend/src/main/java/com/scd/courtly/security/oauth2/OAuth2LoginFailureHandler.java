package com.scd.courtly.security.oauth2;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Map;

/** Sends provider errors (user cancelled, no email, bad state, ...) back to the frontend callback page. */
@Component
@RequiredArgsConstructor
public class OAuth2LoginFailureHandler implements AuthenticationFailureHandler {

    private final OAuth2RedirectStore redirectStore;

    @Override
    public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response,
                                        AuthenticationException exception) throws IOException {
        String redirectUri = redirectStore.redirectUri(request);
        redirectStore.clear(request);

        String code = exception instanceof OAuth2AuthenticationException oauth
            ? oauth.getError().getErrorCode() : "authentication_failed";

        if (redirectUri == null) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "OAuth2 login failed: " + code);
            return;
        }
        response.sendRedirect(redirectUri + "#" + OAuth2LoginSuccessHandler.encode(Map.of("error", code)));
    }
}
