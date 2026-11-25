package com.scd.courtly.service;

import com.scd.courtly.model.Booking;
import com.scd.courtly.model.MatchResult;
import com.scd.courtly.model.Player;
import com.scd.courtly.repository.BookingRepository;
import com.scd.courtly.repository.MatchResultRepository;
import com.scd.courtly.repository.PlayerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@Tag("unit")
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MatchResultServiceTest {

    @Mock private MatchResultRepository matchResultRepository;
    @Mock private BookingRepository     bookingRepository;
    @Mock private PlayerRepository      playerRepository;

    @InjectMocks private MatchResultService service;

    private static final String PLAYER_ID  = "player-001";
    private static final String BOOKING_ID = "booking-001";
    private static final String PAST_DATE  = "2026-01-10";          // safely in the past
    private static final String TODAY      = LocalDate.now().toString();

    // ── helpers ──────────────────────────────────────────────────────────────

    private Booking confirmedPastBooking() {
        Booking b = new Booking();
        b.setBookingID(BOOKING_ID);
        b.setPlayerID(PLAYER_ID);
        b.setCourtID("court-001");
        b.setCourtName("Main Tennis Court");
        b.setSportType("TENNIS");
        b.setBookingDate(PAST_DATE);
        b.setTimeSlot("10:00-11:00");
        b.setStatus("CONFIRMED");
        return b;
    }

    private Player playerWithPoints(int points) {
        Player p = new Player();
        p.setName("Ali Hassan");
        p.setRankPoints(points);
        return p;
    }

    private MatchResult savedResult(String result, int points) {
        MatchResult mr = new MatchResult();
        mr.setMatchID("match-001");
        mr.setBookingID(BOOKING_ID);
        mr.setPlayerID(PLAYER_ID);
        mr.setPlayerName("Ali Hassan");
        mr.setResult(result);
        mr.setPointsEarned(points);
        return mr;
    }

    @BeforeEach
    void defaultStubs() {
        // Most tests: no prior result submitted
        when(matchResultRepository.existsByBookingID(BOOKING_ID)).thenReturn(false);
        // Player lookup for name
        when(playerRepository.findById(PLAYER_ID)).thenReturn(Optional.of(playerWithPoints(0)));
        // Save returns whatever is passed in
        when(matchResultRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(playerRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    // ── TC-1  WIN → 3 points saved and returned ──────────────────────────────
    @Test
    void submitResult_win_awards3Points() {
        when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(confirmedPastBooking()));

        MatchResult result = service.submitResult(BOOKING_ID, PLAYER_ID, "Opponent", 6, 3, "WIN");

        assertThat(result.getResult()).isEqualTo("WIN");
        assertThat(result.getPointsEarned()).isEqualTo(3);
    }

    // ── TC-2  DRAW → 1 point ─────────────────────────────────────────────────
    @Test
    void submitResult_draw_awards1Point() {
        when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(confirmedPastBooking()));

        MatchResult result = service.submitResult(BOOKING_ID, PLAYER_ID, "Opponent", 4, 4, "DRAW");

        assertThat(result.getResult()).isEqualTo("DRAW");
        assertThat(result.getPointsEarned()).isEqualTo(1);
    }

    // ── TC-3  LOSS → 0 points ────────────────────────────────────────────────
    @Test
    void submitResult_loss_awards0Points() {
        when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(confirmedPastBooking()));

        MatchResult result = service.submitResult(BOOKING_ID, PLAYER_ID, "Opponent", 2, 6, "LOSS");

        assertThat(result.getResult()).isEqualTo("LOSS");
        assertThat(result.getPointsEarned()).isEqualTo(0);
    }

    // ── TC-4  Player.rankPoints is incremented by pointsEarned ───────────────
    @Test
    void submitResult_win_updatesPlayerRankPoints() {
        when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(confirmedPastBooking()));
        Player player = playerWithPoints(5);
        when(playerRepository.findById(PLAYER_ID)).thenReturn(Optional.of(player));

        service.submitResult(BOOKING_ID, PLAYER_ID, "Opponent", 6, 2, "WIN");

        ArgumentCaptor<Player> captor = ArgumentCaptor.forClass(Player.class);
        verify(playerRepository).save(captor.capture());
        assertThat(captor.getValue().getRankPoints()).isEqualTo(8);  // 5 existing + 3
    }

    // ── TC-5  result is case-insensitive ─────────────────────────────────────
    @Test
    void submitResult_lowercaseResult_isNormalized() {
        when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(confirmedPastBooking()));

        MatchResult result = service.submitResult(BOOKING_ID, PLAYER_ID, "Opponent", 3, 1, "win");

        assertThat(result.getResult()).isEqualTo("WIN");
    }

    // ── TC-6  booking not found ───────────────────────────────────────────────
    @Test
    void submitResult_bookingNotFound_throwsException() {
        when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
            service.submitResult(BOOKING_ID, PLAYER_ID, "Opponent", 1, 0, "WIN"))
            .isInstanceOf(RuntimeException.class)
            .hasMessageContaining("Booking not found");
    }

    // ── TC-7  wrong player cannot submit another player's result ─────────────
    @Test
    void submitResult_wrongPlayer_throwsException() {
        when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(confirmedPastBooking()));

        assertThatThrownBy(() ->
            service.submitResult(BOOKING_ID, "different-player", "Opponent", 1, 0, "WIN"))
            .isInstanceOf(RuntimeException.class)
            .hasMessageContaining("own bookings");
    }

    // ── TC-8  cancelled booking cannot have a result submitted ───────────────
    @Test
    void submitResult_cancelledBooking_throwsException() {
        Booking b = confirmedPastBooking();
        b.setStatus("CANCELLED");
        when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(b));

        assertThatThrownBy(() ->
            service.submitResult(BOOKING_ID, PLAYER_ID, "Opponent", 1, 0, "WIN"))
            .isInstanceOf(RuntimeException.class)
            .hasMessageContaining("cancelled");
    }

    // ── TC-9  duplicate submission is rejected ───────────────────────────────
    @Test
    void submitResult_duplicate_throwsException() {
        when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(confirmedPastBooking()));
        when(matchResultRepository.existsByBookingID(BOOKING_ID)).thenReturn(true);

        assertThatThrownBy(() ->
            service.submitResult(BOOKING_ID, PLAYER_ID, "Opponent", 1, 0, "WIN"))
            .isInstanceOf(RuntimeException.class)
            .hasMessageContaining("already been submitted");
    }

    // ── TC-10  future booking date is rejected ───────────────────────────────
    @Test
    void submitResult_futureDate_throwsException() {
        Booking b = confirmedPastBooking();
        b.setBookingDate(LocalDate.now().plusDays(3).toString());
        when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(b));

        assertThatThrownBy(() ->
            service.submitResult(BOOKING_ID, PLAYER_ID, "Opponent", 1, 0, "WIN"))
            .isInstanceOf(RuntimeException.class)
            .hasMessageContaining("before the match date");
    }

    // ── TC-11  today's booking but slot has NOT ended yet is rejected ─────────
    @Test
    void submitResult_todaySlotNotEnded_throwsException() {
        // Slot ends 23:59 — will always be in the future during a normal test run
        Booking b = confirmedPastBooking();
        b.setBookingDate(TODAY);
        b.setTimeSlot("00:00-23:59");
        when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(b));

        assertThatThrownBy(() ->
            service.submitResult(BOOKING_ID, PLAYER_ID, "Opponent", 1, 0, "WIN"))
            .isInstanceOf(RuntimeException.class)
            .hasMessageContaining("before the slot has ended");
    }

    // ── TC-12  today's booking whose slot HAS ended ───────────────────────────
    @Test
    void submitResult_todaySlotAlreadyEnded_succeeds() {
        // Slot ended at 00:01 — always in the past during a normal test run
        Booking b = confirmedPastBooking();
        b.setBookingDate(TODAY);
        b.setTimeSlot("00:00-00:01");
        when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(b));

        MatchResult result = service.submitResult(BOOKING_ID, PLAYER_ID, "Opponent", 1, 0, "WIN");

        assertThat(result.getResult()).isEqualTo("WIN");
    }

    // ── TC-13  invalid result string throws exception ────────────────────────
    @Test
    void submitResult_invalidResultString_throwsException() {
        when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(confirmedPastBooking()));

        assertThatThrownBy(() ->
            service.submitResult(BOOKING_ID, PLAYER_ID, "Opponent", 1, 0, "FORFEIT"))
            .isInstanceOf(RuntimeException.class)
            .hasMessageContaining("WIN, LOSS, or DRAW");
    }

    // ── TC-14  saved entity has correct field values ──────────────────────────
    @Test
    void submitResult_savedEntity_hasCorrectFields() {
        Booking b = confirmedPastBooking();
        when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(b));
        when(playerRepository.findById(PLAYER_ID)).thenReturn(Optional.of(playerWithPoints(0)));

        service.submitResult(BOOKING_ID, PLAYER_ID, "John", 7, 5, "WIN");

        ArgumentCaptor<MatchResult> captor = ArgumentCaptor.forClass(MatchResult.class);
        verify(matchResultRepository).save(captor.capture());
        MatchResult saved = captor.getValue();

        assertThat(saved.getBookingID()).isEqualTo(BOOKING_ID);
        assertThat(saved.getPlayerID()).isEqualTo(PLAYER_ID);
        assertThat(saved.getOpponentName()).isEqualTo("John");
        assertThat(saved.getPlayerScore()).isEqualTo(7);
        assertThat(saved.getOpponentScore()).isEqualTo(5);
        assertThat(saved.getCourtName()).isEqualTo("Main Tennis Court");
        assertThat(saved.getSportType()).isEqualTo("TENNIS");
        assertThat(saved.getBookingDate()).isEqualTo(PAST_DATE);
    }

    // ── TC-15  LOSS gives 0 points → rankPoints unchanged ────────────────────
    @Test
    void submitResult_loss_rankPointsUnchanged() {
        when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(confirmedPastBooking()));
        Player player = playerWithPoints(10);
        when(playerRepository.findById(PLAYER_ID)).thenReturn(Optional.of(player));

        service.submitResult(BOOKING_ID, PLAYER_ID, "Opponent", 1, 5, "LOSS");

        ArgumentCaptor<Player> captor = ArgumentCaptor.forClass(Player.class);
        verify(playerRepository).save(captor.capture());
        assertThat(captor.getValue().getRankPoints()).isEqualTo(10); // 10 + 0
    }

    // ── TC-16  getPlayerHistory delegates to repository ───────────────────────
    @Test
    void getPlayerHistory_returnsRepositoryResults() {
        List<MatchResult> expected = List.of(savedResult("WIN", 3));
        when(matchResultRepository.findByPlayerIDOrderBySubmittedAtDesc(PLAYER_ID)).thenReturn(expected);

        List<MatchResult> actual = service.getPlayerHistory(PLAYER_ID);

        assertThat(actual).isEqualTo(expected);
    }

    // ── TC-17  isResultSubmitted reflects repository state ───────────────────
    @Test
    void isResultSubmitted_true_whenRepositoryReturnsTrue() {
        when(matchResultRepository.existsByBookingID(BOOKING_ID)).thenReturn(true);
        assertThat(service.isResultSubmitted(BOOKING_ID)).isTrue();
    }

    @Test
    void isResultSubmitted_false_whenRepositoryReturnsFalse() {
        when(matchResultRepository.existsByBookingID(BOOKING_ID)).thenReturn(false);
        assertThat(service.isResultSubmitted(BOOKING_ID)).isFalse();
    }
}
