package com.scd.courtly.security.oauth2;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Loads the user from the provider's user-info endpoint and normalises the
 * Google / GitHub attribute formats into an {@link OAuth2UserProfile}, which is
 * stored in the principal under {@link #PROFILE_ATTRIBUTE}.
 */
@Service
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    public static final String PROFILE_ATTRIBUTE = "courtlyProfile";
    private static final String GITHUB_EMAILS_URL = "https://api.github.com/user/emails";

    private final RestClient restClient = RestClient.create();

    @Override
    public OAuth2User loadUser(OAuth2UserRequest request) throws OAuth2AuthenticationException {
        OAuth2User user = super.loadUser(request);
        String registrationId = request.getClientRegistration().getRegistrationId();

        OAuth2UserProfile profile = switch (registrationId) {
            case "google" -> googleProfile(user.getAttributes());
            case "github" -> githubProfile(user.getAttributes(), request.getAccessToken().getTokenValue());
            default -> throw error("unsupported_provider", "Unsupported OAuth2 provider: " + registrationId);
        };
        if (profile.email() == null || profile.email().isBlank()) {
            throw error("email_not_available", "The provider did not share an email address");
        }

        Map<String, Object> attributes = new HashMap<>(user.getAttributes());
        attributes.put(PROFILE_ATTRIBUTE, profile);
        String nameKey = request.getClientRegistration().getProviderDetails()
            .getUserInfoEndpoint().getUserNameAttributeName();
        return new DefaultOAuth2User(List.of(new SimpleGrantedAuthority("ROLE_USER")), attributes, nameKey);
    }

    private OAuth2UserProfile googleProfile(Map<String, Object> a) {
        return new OAuth2UserProfile(
            "GOOGLE",
            String.valueOf(a.get("sub")),
            (String) a.get("email"),
            Boolean.TRUE.equals(a.get("email_verified")),
            (String) a.getOrDefault("name", a.get("email")));
    }

    private OAuth2UserProfile githubProfile(Map<String, Object> a, String accessToken) {
        String name = (String) a.get("name");
        if (name == null || name.isBlank()) name = (String) a.get("login");

        // The public profile email may be hidden or unverified, so ask GitHub for
        // the account's primary verified address (needs the "user:email" scope).
        String email = null;
        boolean verified = false;
        try {
            List<Map<String, Object>> emails = restClient.get()
                .uri(GITHUB_EMAILS_URL)
                .header("Authorization", "Bearer " + accessToken)
                .header("Accept", "application/vnd.github+json")
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});
            if (emails != null) {
                for (Map<String, Object> e : emails) {
                    if (Boolean.TRUE.equals(e.get("primary")) && Boolean.TRUE.equals(e.get("verified"))) {
                        email = (String) e.get("email");
                        verified = true;
                        break;
                    }
                }
            }
        } catch (RestClientException ex) {
            // Fall back to the public profile email below (treated as unverified).
        }
        if (email == null) email = (String) a.get("email");

        return new OAuth2UserProfile("GITHUB", String.valueOf(a.get("id")), email, verified, name);
    }

    private static OAuth2AuthenticationException error(String code, String message) {
        return new OAuth2AuthenticationException(new OAuth2Error(code, message, null), message);
    }
}
