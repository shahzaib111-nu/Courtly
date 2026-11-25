package com.scd.courtly.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**") // Applies to all your controllers (/api/auth, /api/bookings, etc.)
                .allowedOriginPatterns("*") // Allows your VS Code Live Server or raw HTML file to connect
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS") // Allows all action types
                .allowedHeaders("*")
                .allowCredentials(true);
    }
}