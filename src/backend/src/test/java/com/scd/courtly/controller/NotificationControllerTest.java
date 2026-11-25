package com.scd.courtly.controller;

import com.scd.courtly.model.Notification;
import com.scd.courtly.model.Player;
import com.scd.courtly.repository.NotificationRepository;
import com.scd.courtly.support.IntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("Notifications API  /api/notifications")
class NotificationControllerTest extends IntegrationTest {

    @Autowired NotificationRepository notificationRepository;

    private Player player;
    private String token;
    private Notification first;

    @BeforeEach
    void twoUnreadNotifications() {
        player = newPlayer();
        token = tokenFor(player);
        first = save("First");
        save("Second");
    }

    private Notification save(String title) {
        Notification n = new Notification();
        n.setUserId(player.getUserID());
        n.setType("BOOKING_MADE");
        n.setTitle(title);
        n.setMessage(title + " message");
        return notificationRepository.saveAndFlush(n);
    }

    private void expectUnread(int count) throws Exception {
        mockMvc.perform(get("/api/notifications/unread-count").param("userId", player.getUserID())
                .header("Authorization", token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.count").value(count));
    }

    @Test
    @DisplayName("GET / lists the user's notifications")
    void list() throws Exception {
        mockMvc.perform(get("/api/notifications").param("userId", player.getUserID()).header("Authorization", token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(2)));
        expectUnread(2);
    }

    @Test
    @DisplayName("PUT /{id}/read marks one notification as read")
    void markOne() throws Exception {
        mockMvc.perform(put("/api/notifications/{id}/read", first.getNotificationID()).header("Authorization", token))
            .andExpect(status().isOk());
        expectUnread(1);
    }

    @Test
    @DisplayName("PUT /read-all marks everything as read")
    void markAll() throws Exception {
        mockMvc.perform(put("/api/notifications/read-all").param("userId", player.getUserID()).header("Authorization", token))
            .andExpect(status().isOk());
        expectUnread(0);
    }

    @Test
    @DisplayName("DELETE /{id} and DELETE /all remove notifications")
    void remove() throws Exception {
        mockMvc.perform(delete("/api/notifications/{id}", first.getNotificationID()).header("Authorization", token))
            .andExpect(status().isOk());
        assertThat(notificationRepository.findByUserIdOrderByCreatedAtDesc(player.getUserID())).hasSize(1);

        mockMvc.perform(delete("/api/notifications/all").param("userId", player.getUserID()).header("Authorization", token))
            .andExpect(status().isOk());
        assertThat(notificationRepository.findByUserIdOrderByCreatedAtDesc(player.getUserID())).isEmpty();
    }

    @Test
    @DisplayName("requires a token → 401")
    void anonymous() throws Exception {
        mockMvc.perform(get("/api/notifications").param("userId", player.getUserID()))
            .andExpect(status().isUnauthorized());
    }

}
