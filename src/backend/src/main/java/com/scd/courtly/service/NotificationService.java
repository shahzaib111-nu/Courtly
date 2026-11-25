package com.scd.courtly.service;

import com.scd.courtly.model.Notification;
import com.scd.courtly.model.NotificationDelivery;
import com.scd.courtly.repository.NotificationDeliveryRepository;
import com.scd.courtly.repository.NotificationRepository;
import com.scd.courtly.repository.UserRepository;
import com.scd.courtly.security.AdminAccount;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import org.springframework.data.domain.PageRequest;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    public static final String ADMIN_USER_ID = "ADMIN";

    /** FR-43: a failed e-mail is tried this many times in total ... */
    public static final int MAX_DELIVERY_ATTEMPTS = 5;
    /** ... waiting this many minutes times the attempt number between tries. */
    public static final int RETRY_DELAY_MINUTES = 5;

    private final NotificationRepository notificationRepository;
    private final UserRepository         userRepository;
    private final EmailService           emailService;
    private final AdminAccount           adminAccount;
    private final NotificationDeliveryRepository deliveryRepository;

    public Notification create(String userId, String type, String title, String message) {
        Notification n = new Notification();
        n.setUserId(userId);
        n.setType(type);
        n.setTitle(title);
        n.setMessage(message);
        n.setRead(false);
        Notification saved = notificationRepository.save(n);

        // FR-43: log the e-mail and try to send it now; a failure is queued for retry.
        NotificationDelivery d = new NotificationDelivery();
        d.setNotificationID(saved.getNotificationID());
        d.setUserId(userId);
        d.setType(type);
        d.setTitle(title);
        d.setMessage(message);
        d.setStatus(NotificationDelivery.QUEUED);
        attemptDelivery(d);

        return saved;
    }

    /**
     * Retries queued e-mails whose next attempt is due. The recipient address is looked
     * up again each time, so fixing an invalid e-mail address lets the retry succeed.
     *
     * @return how many were delivered
     */
    public int retryQueuedDeliveries() {
        int delivered = 0;
        for (NotificationDelivery d : deliveryRepository.findByStatusAndNextAttemptAtLessThanEqual(
                NotificationDelivery.QUEUED, LocalDateTime.now())) {
            if (NotificationDelivery.SENT.equals(attemptDelivery(d).getStatus())) delivered++;
        }
        return delivered;
    }

    /** Most recent delivery log entries, optionally only one status (admin view). */
    public List<NotificationDelivery> getDeliveryLog(String status, int limit) {
        var page = PageRequest.of(0, Math.max(1, Math.min(limit, 500)));
        return status == null || status.isBlank()
            ? deliveryRepository.findAllByOrderByCreatedAtDesc(page)
            : deliveryRepository.findByStatusOrderByCreatedAtDesc(status.toUpperCase(), page);
    }

    public Map<String, Long> getDeliveryCounts() {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (String s : List.of(NotificationDelivery.SENT, NotificationDelivery.QUEUED, NotificationDelivery.FAILED)) {
            counts.put(s, deliveryRepository.countByStatus(s));
        }
        return counts;
    }

    private NotificationDelivery attemptDelivery(NotificationDelivery d) {
        LocalDateTime now = LocalDateTime.now();
        d.setAttempts(d.getAttempts() + 1);
        d.setLastAttemptAt(now);

        String email = recipientEmail(d.getUserId());
        d.setRecipientEmail(email);
        String error = null;
        if (email == null) {
            error = "Recipient has no valid e-mail address";
        } else if (!emailService.sendNotificationEmail(email, d.getType(), d.getTitle(), d.getMessage())) {
            error = "E-mail could not be delivered to " + email;
        }

        if (error == null) {
            d.setStatus(NotificationDelivery.SENT);
            d.setDeliveredAt(now);
            d.setNextAttemptAt(null);
            d.setLastError(null);
            log.info("Notification [{}] e-mailed to user {} (attempt {})", d.getType(), d.getUserId(), d.getAttempts());
        } else if (d.getAttempts() >= MAX_DELIVERY_ATTEMPTS) {
            d.setStatus(NotificationDelivery.FAILED);
            d.setNextAttemptAt(null);
            d.setLastError(error);
            log.warn("Notification [{}] for user {} failed after {} attempts: {}",
                d.getType(), d.getUserId(), d.getAttempts(), error);
        } else {
            d.setStatus(NotificationDelivery.QUEUED);
            d.setNextAttemptAt(now.plusMinutes(RETRY_DELAY_MINUTES * (long) d.getAttempts()));
            d.setLastError(error);
            log.info("Notification [{}] for user {} queued for retry ({}): {}",
                d.getType(), d.getUserId(), d.getAttempts(), error);
        }
        return deliveryRepository.save(d);
    }

    /** The address to e-mail, or null when the recipient details are missing or invalid. */
    private String recipientEmail(String userId) {
        String email = ADMIN_USER_ID.equals(userId)
            ? adminAccount.email()
            : userRepository.findById(userId).map(u -> u.getEmail()).orElse(null);
        if (email == null || email.isBlank() || email.equalsIgnoreCase("your-gmail@gmail.com")
                || !email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            return null;
        }
        return email.trim();
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
