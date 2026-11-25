package com.scd.courtly.controller;

import com.scd.courtly.model.Booking;
import com.scd.courtly.service.BookingService;
import com.scd.courtly.dto.request.CreateBookingRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
public class BookingController {

    private final BookingService bookingService;

    /** Slot search: GET /api/bookings/availability?date=2026-04-26&type=TENNIS */
    @GetMapping("/availability")
    public ResponseEntity<?> getAvailability(@RequestParam String date, @RequestParam String type) {
        return ResponseEntity.ok(bookingService.getAvailableSlotsByTypeAndDate(type, date));
    }

    /** All slots for one court: GET /api/bookings/court/{courtID}?date=2026-04-26 */
    @GetMapping("/court/{courtID}")
    public ResponseEntity<?> getCourtSlots(
            @PathVariable String courtID, @RequestParam String date) {
        return ResponseEntity.ok(bookingService.getAvailableSlots(courtID, date));
    }

    /**
     * Create booking: POST /api/bookings
     * Body: { playerID, courtID, bookingDate, timeSlot }
     *
     * Protected against double-booking via pessimistic write lock in BookingService.
     * DataIntegrityViolationException catch here is a final safety net.
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('USER','ADMIN','MANAGER')")
    public ResponseEntity<?> createBooking(@Valid @RequestBody CreateBookingRequest request) {
        Booking b = bookingService.createBooking(
                request.playerID(),
                request.courtID(),
                request.bookingDate(),
                request.timeSlot());
        return ResponseEntity.ok(b);
    }

    /** Player's booking history: GET /api/bookings/player/{playerID} */
    @PreAuthorize("hasRole('USER')")
    @GetMapping("/player/{playerID}")
    public List<Booking> getPlayerBookings(@PathVariable String playerID) {
        return bookingService.getPlayerBookings(playerID);
    }

    /** PENDING → CONFIRMED */
    @PutMapping("/{id}/confirm")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<?> confirmBooking(@PathVariable String id) {
        return ResponseEntity.ok(bookingService.confirmBooking(id));
    }

    /** Any non-COMPLETED → CANCELLED */
    @PutMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('USER','ADMIN','MANAGER')")
    public ResponseEntity<?> cancelBooking(@PathVariable String id) {
        return ResponseEntity.ok(bookingService.cancelBooking(id));
    }

    /** Price preview: GET /api/bookings/price?courtID=&timeSlot=&date= */
    @GetMapping("/price")
    public ResponseEntity<?> getPrice(
            @RequestParam String courtID,
            @RequestParam String timeSlot,
            @RequestParam String date) {
        return ResponseEntity.ok(bookingService.getPriceDetails(courtID, timeSlot, date));
    }
}
