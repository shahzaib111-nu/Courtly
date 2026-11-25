package com.scd.courtly.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Registers the Google and GitHub OAuth2 clients.
 *
 * A provider is only registered when its client id and secret are configured,
 * so the backend still starts (with social login disabled) on machines that
 * have no OAuth credentials.
 */
@Configuration
public class OAuth2ClientConfig {

    @Bean
    public ConfiguredClientRegistrations clientRegistrationRepository(Environment env) {
        // secrets.yml (app.oauth2.*) wins; environment variables are the fallback.
        String googleId     = firstSet(env, "app.oauth2.google.client-id",     "GOOGLE_CLIENT_ID");
        String googleSecret = firstSet(env, "app.oauth2.google.client-secret", "GOOGLE_CLIENT_SECRET");
        String githubId     = firstSet(env, "app.oauth2.github.client-id",     "GITHUB_CLIENT_ID");
        String githubSecret = firstSet(env, "app.oauth2.github.client-secret", "GITHUB_CLIENT_SECRET");

        Map<String, ClientRegistration> registrations = new LinkedHashMap<>();

        if (isSet(googleId) && isSet(googleSecret)) {
            // "openid" is left out on purpose so Google goes through the same
            // OAuth2 user-info flow as GitHub (CustomOAuth2UserService).
            registrations.put("google", CommonOAuth2Provider.GOOGLE.getBuilder("google")
                .clientId(googleId.trim())
                .clientSecret(googleSecret.trim())
                .scope("profile", "email")
                .build());
        }
        if (isSet(githubId) && isSet(githubSecret)) {
            registrations.put("github", CommonOAuth2Provider.GITHUB.getBuilder("github")
                .clientId(githubId.trim())
                .clientSecret(githubSecret.trim())
                .scope("read:user", "user:email")
                .build());
        }
        return new ConfiguredClientRegistrations(Collections.unmodifiableMap(registrations));
    }

    private static String firstSet(Environment env, String... keys) {
        for (String key : keys) {
            String value = env.getProperty(key);
            if (isSet(value)) return value;
        }
        return null;
    }

    private static boolean isSet(String value) {
        return value != null && !value.isBlank();
    }

    /** Lookup by registration id; unlike InMemoryClientRegistrationRepository it may be empty. */
    public record ConfiguredClientRegistrations(Map<String, ClientRegistration> registrations)
            implements ClientRegistrationRepository {

        @Override
        public ClientRegistration findByRegistrationId(String registrationId) {
            return registrationId == null ? null : registrations.get(registrationId.toLowerCase());
        }

        public List<String> providerIds() {
            return List.copyOf(registrations.keySet());
        }
    }
}
