package com.scd.courtly.service;

import com.scd.courtly.model.Notification;
import com.scd.courtly.repository.NotificationRepository;
import com.scd.courtly.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    public static final String ADMIN_USER_ID = "ADMIN";

    private final NotificationRepository notificationRepository;
    private final UserRepository         userRepository;
    private final EmailService           emailService;

    public Notification create(String userId, String type, String title, String message) {
        Notification n = new Notification();
        n.setUserId(userId);
        n.setType(type);
        n.setTitle(title);
        n.setMessage(message);
        n.setRead(false);
        Notification saved = notificationRepository.save(n);

        // Send email — admin has no DB row so handle separately
        if (ADMIN_USER_ID.equals(userId)) {
            emailService.sendNotificationEmail("admin.playfair@gmail.com", type, title, message);
        } else {
            userRepository.findById(userId).ifPresent(user -> {
                String email = user.getEmail();
                if (email != null && !email.isBlank()
                        && !email.equalsIgnoreCase("your-gmail@gmail.com")) {
                    emailService.sendNotificationEmail(email, type, title, message);
                }
            });
        }

        return saved;
    }

    public List<Notification> getForUser(String userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public long getUnreadCount(String userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    public void markRead(String notificationId) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            n.setRead(true);
            notificationRepository.save(n);
        });
    }

    public void markAllRead(String userId) {
        List<Notification> unread = notificationRepository.findByUserIdAndIsReadFalse(userId);
        unread.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(unread);
    }

    public void deleteNotification(String notificationId) {
        notificationRepository.deleteById(notificationId);
    }

    public void deleteAllForUser(String userId) {
        notificationRepository.deleteAll(
            notificationRepository.findByUserIdOrderByCreatedAtDesc(userId)
        );
    }
}
