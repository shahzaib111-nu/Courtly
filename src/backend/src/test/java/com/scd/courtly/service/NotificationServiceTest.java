package com.scd.courtly.service;

import com.scd.courtly.model.Notification;
import com.scd.courtly.model.NotificationDelivery;
import com.scd.courtly.model.Player;
import com.scd.courtly.repository.NotificationDeliveryRepository;
import com.scd.courtly.repository.NotificationRepository;
import com.scd.courtly.repository.UserRepository;
import com.scd.courtly.security.AdminAccount;
import com.scd.courtly.support.Fixtures;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.AdditionalAnswers.returnsFirstArg;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@Tag("unit")
@DisplayName("NotificationService")
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class NotificationServiceTest {

    @Mock NotificationRepository notificationRepository;
    @Mock UserRepository userRepository;
    @Mock EmailService emailService;
    @Mock NotificationDeliveryRepository deliveryRepository;
    @Spy AdminAccount adminAccount = new AdminAccount("admin.playfair@gmail.com", "Admin123");
    @InjectMocks NotificationService service;

    @BeforeEach
    void setUp() {
        when(notificationRepository.save(any())).thenAnswer(returnsFirstArg());
        when(deliveryRepository.save(any())).thenAnswer(returnsFirstArg());
    }

    private NotificationDelivery lastDelivery() {
        ArgumentCaptor<NotificationDelivery> captor = ArgumentCaptor.forClass(NotificationDelivery.class);
        verify(deliveryRepository, atLeastOnce()).save(captor.capture());
        return captor.getValue();
    }

    @Nested
    @DisplayName("Creating a notification")
    class Create {

        @Test
        @DisplayName("stores an unread notification")
        void storesUnread() {
            Notification n = service.create("U1", "BOOKING_MADE", "Title", "Body");
            assertThat(n.getUserId()).isEqualTo("U1");
            assertThat(n.isRead()).isFalse();
        }

        @Test
        @DisplayName("admin notifications are e-mailed to the admin address")
        void emailsAdmin() {
            service.create(NotificationService.ADMIN_USER_ID, "LOW_RATING", "T", "M");
            verify(emailService).sendNotificationEmail("admin.playfair@gmail.com", "LOW_RATING", "T", "M");
        }

        @Test
        @DisplayName("user notifications are e-mailed to the user")
        void emailsUser() {
            when(userRepository.findById("U1")).thenReturn(Optional.of(Fixtures.player("U1", "u1@example.com")));
            service.create("U1", "BOOKING_MADE", "T", "M");
            verify(emailService).sendNotificationEmail("u1@example.com", "BOOKING_MADE", "T", "M");
        }

        @Test
        @DisplayName("no e-mail for unknown users or placeholder addresses")
        void skipsEmail() {
            when(userRepository.findById("U2")).thenReturn(Optional.of(Fixtures.player("U2", "your-gmail@gmail.com")));
            service.create("U2", "T", "T", "M");
            service.create("unknown", "T", "T", "M");
            verifyNoInteractions(emailService);
        }
    }

    @Nested
    @DisplayName("FR-43: delivery log and retry queue")
    class Delivery {

        @Test
        @DisplayName("a delivered e-mail is logged as SENT")
        void loggedAsSent() {
            when(userRepository.findById("U1")).thenReturn(Optional.of(Fixtures.player("U1", "u1@example.com")));
            when(emailService.sendNotificationEmail(any(), any(), any(), any())).thenReturn(true);

            service.create("U1", "BOOKING_MADE", "T", "M");

            NotificationDelivery d = lastDelivery();
            assertThat(d.getStatus()).isEqualTo(NotificationDelivery.SENT);
            assertThat(d.getAttempts()).isEqualTo(1);
            assertThat(d.getRecipientEmail()).isEqualTo("u1@example.com");
            assertThat(d.getDeliveredAt()).isNotNull();
        }

        @Test
        @DisplayName("invalid recipient details queue the e-mail for a later retry")
        void invalidRecipientQueued() {
            when(userRepository.findById("U2")).thenReturn(Optional.of(Fixtures.player("U2", "not-an-email")));

            service.create("U2", "BOOKING_MADE", "T", "M");

            NotificationDelivery d = lastDelivery();
            assertThat(d.getStatus()).isEqualTo(NotificationDelivery.QUEUED);
            assertThat(d.getLastError()).contains("no valid e-mail");
            assertThat(d.getNextAttemptAt()).isAfter(LocalDateTime.now());
            verifyNoInteractions(emailService);
        }

        @Test
        @DisplayName("a failed send is queued; the retry succeeds once the address is fixed")
        void retrySucceeds() {
            Player p = Fixtures.player("U3", "bad-address");
            when(userRepository.findById("U3")).thenReturn(Optional.of(p));
            service.create("U3", "BOOKING_MADE", "T", "M");
            NotificationDelivery queued = lastDelivery();
            assertThat(queued.getStatus()).isEqualTo(NotificationDelivery.QUEUED);

            p.setEmail("fixed@example.com");                     // the user corrects their details
            queued.setNextAttemptAt(LocalDateTime.now().minusSeconds(1));
            when(deliveryRepository.findByStatusAndNextAttemptAtLessThanEqual(eq(NotificationDelivery.QUEUED), any()))
                .thenReturn(List.of(queued));
            when(emailService.sendNotificationEmail(eq("fixed@example.com"), any(), any(), any())).thenReturn(true);

            assertThat(service.retryQueuedDeliveries()).isEqualTo(1);
            assertThat(queued.getStatus()).isEqualTo(NotificationDelivery.SENT);
            assertThat(queued.getAttempts()).isEqualTo(2);
        }

        @Test
        @DisplayName("after the last attempt the delivery is marked FAILED and no longer retried")
        void givesUp() {
            NotificationDelivery d = new NotificationDelivery();
            d.setUserId("U4");
            d.setType("T"); d.setTitle("T"); d.setMessage("M");
            d.setStatus(NotificationDelivery.QUEUED);
            d.setAttempts(NotificationService.MAX_DELIVERY_ATTEMPTS - 1);
            when(userRepository.findById("U4")).thenReturn(Optional.of(Fixtures.player("U4", "u4@example.com")));
            when(emailService.sendNotificationEmail(any(), any(), any(), any())).thenReturn(false);
            when(deliveryRepository.findByStatusAndNextAttemptAtLessThanEqual(eq(NotificationDelivery.QUEUED), any()))
                .thenReturn(List.of(d));

            assertThat(service.retryQueuedDeliveries()).isZero();
            assertThat(d.getStatus()).isEqualTo(NotificationDelivery.FAILED);
            assertThat(d.getNextAttemptAt()).isNull();
        }
    }

    @Nested
    @DisplayName("Reading notifications")
    class Read {

        @Test
        @DisplayName("markRead flags a single notification")
        void markRead() {
            Notification n = new Notification();
            when(notificationRepository.findById("N1")).thenReturn(Optional.of(n));
            service.markRead("N1");
            assertThat(n.isRead()).isTrue();
            verify(notificationRepository).save(n);
        }

        @Test
        @DisplayName("markAllRead flags every unread notification of the user")
        void markAllRead() {
            Notification a = new Notification();
            Notification b = new Notification();
            when(notificationRepository.findByUserIdAndIsReadFalse("U1")).thenReturn(List.of(a, b));
            service.markAllRead("U1");
            assertThat(List.of(a, b)).allMatch(Notification::isRead);
        }

        @Test
        @DisplayName("unread count comes from the repository")
        void unreadCount() {
            when(notificationRepository.countByUserIdAndIsReadFalse("U1")).thenReturn(3L);
            assertThat(service.getUnreadCount("U1")).isEqualTo(3);
        }
    }
}
