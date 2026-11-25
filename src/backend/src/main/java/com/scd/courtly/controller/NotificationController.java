package com.scd.courtly.controller;

import com.scd.courtly.model.Notification;
import com.scd.courtly.exception.NotFoundException;
import com.scd.courtly.repository.NotificationRepository;
import com.scd.courtly.security.AccessGuard;
import com.scd.courtly.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.scd.courtly.dto.response.UnreadCountResponse;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final NotificationRepository notificationRepository;
    private final AccessGuard guard;

    @GetMapping
    public ResponseEntity<List<Notification>> getNotifications(@RequestParam String userId) {
        guard.requireSelfOrAdmin(userId);
        return ResponseEntity.ok(notificationService.getForUser(userId));
    }

    /** FR-43: e-mail delivery log with SENT / QUEUED / FAILED counts (admin only). */
    @GetMapping("/delivery-log")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> deliveryLog(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "100") int limit) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("counts", notificationService.getDeliveryCounts());
        body.put("entries", notificationService.getDeliveryLog(status, limit));
        return ResponseEntity.ok(body);
    }

    @GetMapping("/unread-count")
    public ResponseEntity<UnreadCountResponse> getUnreadCount(@RequestParam String userId) {
        guard.requireSelfOrAdmin(userId);
        return ResponseEntity.ok(new UnreadCountResponse(notificationService.getUnreadCount(userId)));
    }

    @PutMapping("/{id}/read")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> markRead(@PathVariable String id) {
        requireOwner(id);
        notificationService.markRead(id);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/read-all")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> markAllRead(@RequestParam String userId) {
        guard.requireSelfOrAdmin(userId);
        notificationService.markAllRead(userId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        requireOwner(id);
        notificationService.deleteNotification(id);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/all")
    public ResponseEntity<?> deleteAll(@RequestParam String userId) {
        guard.requireSelfOrAdmin(userId);
        notificationService.deleteAllForUser(userId);
        return ResponseEntity.ok().build();
    }

    private void requireOwner(String notificationId) {
        Notification n = notificationRepository.findById(notificationId)
            .orElseThrow(() -> new NotFoundException("Notification not found"));
        guard.requireSelfOrAdmin(n.getUserId());
    }
}
