package com.scd.courtly.service;

import com.scd.courtly.model.Booking;
import com.scd.courtly.model.FacilityRating;
import com.scd.courtly.repository.BookingRepository;
import com.scd.courtly.repository.FacilityRatingRepository;
import com.scd.courtly.support.Fixtures;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.AdditionalAnswers.returnsFirstArg;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@Tag("unit")
@DisplayName("FacilityRatingService")
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FacilityRatingServiceTest {

    @Mock FacilityRatingRepository ratingRepository;
    @Mock BookingRepository bookingRepository;
    @Mock NotificationService notificationService;
    @InjectMocks FacilityRatingService service;

    private Booking booking;

    @BeforeEach
    void setUp() {
        booking = Fixtures.booking("B1", "P1", "C1", "2026-01-10", "10:00-11:00", "COMPLETED");
        when(bookingRepository.findById("B1")).thenReturn(Optional.of(booking));
        when(ratingRepository.save(any())).thenAnswer(returnsFirstArg());
    }

    @Nested
    @DisplayName("Submitting a rating")
    class Submit {

        @Test
        @DisplayName("saves rating details copied from the booking")
        void success() {
            FacilityRating r = service.submitRating("B1", "P1", 4, "  Great court  ");

            assertThat(r.getCourtID()).isEqualTo("C1");
            assertThat(r.getRatingScore()).isEqualTo(4);
            assertThat(r.getFeedbackText()).isEqualTo("Great court");
            verifyNoInteractions(notificationService);
        }

        @Test
        @DisplayName("blank feedback is stored as null")
        void blankFeedback() {
            assertThat(service.submitRating("B1", "P1", 5, "   ").getFeedbackText()).isNull();
        }

        @ParameterizedTest(name = "score {0} alerts the admin")
        @ValueSource(ints = {1, 2})
        void lowRatingNotifiesAdmin(int score) {
            service.submitRating("B1", "P1", score, null);
            verify(notificationService).create(eq(NotificationService.ADMIN_USER_ID), eq("LOW_RATING"), anyString(), anyString());
        }

        @ParameterizedTest(name = "score {0} is rejected")
        @ValueSource(ints = {0, 6})
        void scoreOutOfRange(int score) {
            assertThatThrownBy(() -> service.submitRating("B1", "P1", score, null))
                .hasMessage("Rating must be between 1 and 5");
        }

        @Test
        @DisplayName("players can only rate their own bookings")
        void notOwner() {
            assertThatThrownBy(() -> service.submitRating("B1", "someone-else", 4, null))
                .hasMessage("You can only rate your own bookings");
        }

        @Test
        @DisplayName("cancelled bookings cannot be rated")
        void cancelled() {
            booking.setStatus("CANCELLED");
            assertThatThrownBy(() -> service.submitRating("B1", "P1", 4, null))
                .hasMessage("Cannot rate a cancelled booking");
        }

        @Test
        @DisplayName("a booking can only be rated once")
        void duplicate() {
            when(ratingRepository.existsByBookingID("B1")).thenReturn(true);
            assertThatThrownBy(() -> service.submitRating("B1", "P1", 4, null))
                .hasMessageContaining("already rated");
        }

        @Test
        @DisplayName("future bookings cannot be rated yet")
        void futureBooking() {
            booking.setBookingDate(LocalDate.now().plusDays(3).toString());
            assertThatThrownBy(() -> service.submitRating("B1", "P1", 4, null))
                .hasMessageContaining("before your booking date");
        }

        @Test
        @DisplayName("unknown booking fails")
        void unknownBooking() {
            assertThatThrownBy(() -> service.submitRating("nope", "P1", 4, null))
                .hasMessage("Booking not found");
        }
    }

    @Nested
    @DisplayName("Average rating")
    class Average {

        @Test
        @DisplayName("is rounded to one decimal place")
        void rounded() {
            when(ratingRepository.findAverageScoreByCourtID("C1")).thenReturn(3.6666);
            assertThat(service.getAverageRating("C1")).isEqualTo(3.7);
        }

        @Test
        @DisplayName("is 0 when the court has no ratings")
        void noRatings() {
            when(ratingRepository.findAverageScoreByCourtID("C1")).thenReturn(null);
            assertThat(service.getAverageRating("C1")).isZero();
        }
    }
}
