package com.scd.courtly.controller;

import com.scd.courtly.model.Booking;
import com.scd.courtly.model.Player;
import com.scd.courtly.support.IntegrationTest;
import com.scd.courtly.support.TestData;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("Bookings API  /api/bookings")
class BookingControllerTest extends IntegrationTest {

    private final String date = TestData.futureWeekday(10).toString();

    private ResultActions book(String token, String playerID, String timeSlot) throws Exception {
        return mockMvc.perform(post("/api/bookings").header("Authorization", token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(json(Map.of("playerID", playerID, "courtID", TestData.TENNIS_COURT_1,
                "bookingDate", date, "timeSlot", timeSlot))));
    }

    @Nested
    @DisplayName("Searching (public)")
    class Searching {

        @Test
        @DisplayName("GET /availability returns free slots for a sport and date")
        void availability() throws Exception {
            mockMvc.perform(get("/api/bookings/availability").param("date", date).param("type", "TENNIS"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(30)))   // 2 tennis courts x 15 slots
                .andExpect(jsonPath("$[*].available", everyItem(is(true))));
        }

        @Test
        @DisplayName("GET /court/{id} shows booked slots as unavailable")
        void courtSlots() throws Exception {
            saveBooking(newPlayer().getUserID(), TestData.TENNIS_COURT_1, date, "10:00-11:00", "CONFIRMED");

            mockMvc.perform(get("/api/bookings/court/{id}", TestData.TENNIS_COURT_1).param("date", date))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(15)))
                .andExpect(jsonPath("$[?(@.timeSlot == '10:00-11:00')].available").value(contains(false)));
        }

        @Test
        @DisplayName("GET /price applies the peak multiplier (1200 x 1.5)")
        void price() throws Exception {
            mockMvc.perform(get("/api/bookings/price").param("courtID", TestData.TENNIS_COURT_1)
                    .param("timeSlot", "18:00-19:00").param("date", date))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isPeak").value(true))
                .andExpect(jsonPath("$.price").value(1800.0));
        }

        @Test
        @DisplayName("GET /price for an unknown court → 400")
        void priceUnknownCourt() throws Exception {
            mockMvc.perform(get("/api/bookings/price").param("courtID", "NOPE")
                    .param("timeSlot", "18:00-19:00").param("date", date))
                .andExpect(status().isBadRequest());
        }
    }

    @Nested
    @DisplayName("POST / (create booking)")
    class Create {

        @Test
        @DisplayName("creates a PENDING booking at the correct price")
        void success() throws Exception {
            Player p = newPlayer();
            book(tokenFor(p), p.getUserID(), "10:00-11:00")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bookingID").isNotEmpty())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.totalCost").value(1200.0))
                .andExpect(jsonPath("$.courtName").value("Gulberg Tennis Court"));
        }

        @Test
        @DisplayName("the same slot cannot be booked twice")
        void doubleBooking() throws Exception {
            Player first = newPlayer();
            Player second = newPlayer();
            book(tokenFor(first), first.getUserID(), "10:00-11:00").andExpect(status().isOk());

            book(tokenFor(second), second.getUserID(), "10:00-11:00")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("already booked")));
        }

        @Test
        @DisplayName("a player may hold at most 2 active bookings")
        void maxTwoActive() throws Exception {
            Player p = newPlayer();
            book(tokenFor(p), p.getUserID(), "08:00-09:00").andExpect(status().isOk());
            book(tokenFor(p), p.getUserID(), "10:00-11:00").andExpect(status().isOk());

            book(tokenFor(p), p.getUserID(), "12:00-13:00")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("2 active bookings")));
        }

        @Test
        @DisplayName("past dates are rejected")
        void pastDate() throws Exception {
            Player p = newPlayer();
            mockMvc.perform(post("/api/bookings").header("Authorization", tokenFor(p))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json(Map.of("playerID", p.getUserID(), "courtID", TestData.TENNIS_COURT_1,
                        "bookingDate", "2020-01-01", "timeSlot", "10:00-11:00"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Cannot book a slot on a past date."));
        }

        @Test
        @DisplayName("missing fields → 400 with field errors")
        void validation() throws Exception {
            mockMvc.perform(post("/api/bookings").header("Authorization", playerToken())
                    .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("playerID", "x"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.courtID").exists())
                .andExpect(jsonPath("$.fieldErrors.timeSlot").exists());
        }

        @Test
        @DisplayName("without a token → 401")
        void anonymous() throws Exception {
            mockMvc.perform(post("/api/bookings").contentType(MediaType.APPLICATION_JSON)
                    .content(json(Map.of("playerID", "x", "courtID", "y", "bookingDate", date, "timeSlot", "10:00-11:00"))))
                .andExpect(status().isUnauthorized());
        }
    }

    @Nested
    @DisplayName("Booking lifecycle")
    class Lifecycle {

        @Test
        @DisplayName("GET /player/{id} lists the player's bookings")
        void history() throws Exception {
            Player p = newPlayer();
            Booking b = saveBooking(p.getUserID(), TestData.TENNIS_COURT_1, date, "10:00-11:00", "PENDING");

            mockMvc.perform(get("/api/bookings/player/{id}", p.getUserID()).header("Authorization", tokenFor(p)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].bookingID", contains(b.getBookingID())));
        }

        @Test
        @DisplayName("PUT /{id}/confirm: manager confirms a PENDING booking")
        void confirm() throws Exception {
            Booking b = saveBooking(newPlayer().getUserID(), TestData.TENNIS_COURT_1, date, "10:00-11:00", "PENDING");

            mockMvc.perform(put("/api/bookings/{id}/confirm", b.getBookingID()).header("Authorization", managerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONFIRMED"))
                .andExpect(jsonPath("$.confirmedAt").isNotEmpty());
        }

        @Test
        @DisplayName("PUT /{id}/confirm: players cannot confirm → 403")
        void confirmAsPlayer() throws Exception {
            Booking b = saveBooking(newPlayer().getUserID(), TestData.TENNIS_COURT_1, date, "10:00-11:00", "PENDING");
            mockMvc.perform(put("/api/bookings/{id}/confirm", b.getBookingID()).header("Authorization", playerToken()))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("PUT /{id}/cancel cancels the booking")
        void cancel() throws Exception {
            Player p = newPlayer();
            Booking b = saveBooking(p.getUserID(), TestData.TENNIS_COURT_1, date, "10:00-11:00", "CONFIRMED");

            mockMvc.perform(put("/api/bookings/{id}/cancel", b.getBookingID()).header("Authorization", tokenFor(p)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
        }

        @Test
        @DisplayName("PUT /{id}/cancel on a completed booking → 400")
        void cancelCompleted() throws Exception {
            Player p = newPlayer();
            Booking b = saveBooking(p.getUserID(), TestData.TENNIS_COURT_1, "2026-01-05", "10:00-11:00", "COMPLETED");

            mockMvc.perform(put("/api/bookings/{id}/cancel", b.getBookingID()).header("Authorization", tokenFor(p)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Cannot cancel a completed booking"));
        }
    }
}
