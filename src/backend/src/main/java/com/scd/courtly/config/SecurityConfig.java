package com.scd.courtly.config;

import com.scd.courtly.security.JwtAuthenticationFilter;
import com.scd.courtly.security.oauth2.CustomOAuth2UserService;
import com.scd.courtly.security.oauth2.OAuth2LoginFailureHandler;
import com.scd.courtly.security.oauth2.OAuth2LoginSuccessHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Instant;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final CustomOAuth2UserService oAuth2UserService;
    private final OAuth2LoginSuccessHandler oAuth2SuccessHandler;
    private final OAuth2LoginFailureHandler oAuth2FailureHandler;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> {})
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(org.springframework.http.HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/api/auth/register", "/api/auth/login",
                    "/api/auth/forgot-password", "/api/auth/verify-otp",
                    "/api/auth/reset-password-otp",
                    "/api/auth/oauth2/**", "/oauth2/**", "/login/oauth2/**",
                    "/h2-console/**", "/actuator/health").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.GET,
                    "/api/courts", "/api/courts/**", "/api/bookings/availability",
                    "/api/bookings/court/**", "/api/bookings/price", "/api/ratings/average/**", "/api/ratings/all",
                    "/api/facilities", "/api/facilities/*").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/manager/**").hasAnyRole("ADMIN", "MANAGER")
                .requestMatchers("/api/**").authenticated()
                .anyRequest().permitAll())
            // Google / GitHub login. The HTTP session is only used to hold the OAuth2
            // "state" during the provider round trip; API calls stay stateless (JWT).
            .oauth2Login(oauth -> oauth
                .userInfoEndpoint(userInfo -> userInfo.userService(oAuth2UserService))
                .successHandler(oAuth2SuccessHandler)
                .failureHandler(oAuth2FailureHandler))
            .headers(headers -> headers.frameOptions(frame -> frame.sameOrigin()))
            .exceptionHandling(exceptions -> exceptions
                .authenticationEntryPoint((request, response, exception) -> writeSecurityError(response, request.getRequestURI(), HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized", "Authentication is required or the token is invalid"))
                .accessDeniedHandler((request, response, exception) -> writeSecurityError(response, request.getRequestURI(), HttpServletResponse.SC_FORBIDDEN, "Forbidden", "You do not have permission to perform this action")))
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    private void writeSecurityError(HttpServletResponse response, String path, int status,
                                    String error, String message) throws java.io.IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        java.util.Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", status);
        body.put("error", error);
        body.put("message", message);
        body.put("path", path);
        new ObjectMapper().writeValue(response.getOutputStream(), body);
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }
}
