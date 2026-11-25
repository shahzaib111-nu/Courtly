package com.scd.courtly.service;

import com.scd.courtly.model.Notification;
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
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

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
    @Spy AdminAccount adminAccount = new AdminAccount("admin.playfair@gmail.com", "Admin123");
    @InjectMocks NotificationService service;

    @BeforeEach
    void setUp() {
        when(notificationRepository.save(any())).thenAnswer(returnsFirstArg());
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
