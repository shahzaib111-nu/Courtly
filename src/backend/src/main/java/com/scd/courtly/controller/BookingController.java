package com.scd.courtly.controller;

import com.scd.courtly.model.Booking;
import com.scd.courtly.exception.ForbiddenException;
import com.scd.courtly.exception.NotFoundException;
import com.scd.courtly.repository.BookingRepository;
import com.scd.courtly.security.AccessGuard;
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
    private final BookingRepository bookingRepository;
    private final AccessGuard guard;

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
        guard.requireSelfOrAdmin(request.playerID());   // players can only book for themselves
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
        guard.requireSelfOrAdmin(playerID);
        return bookingService.getPlayerBookings(playerID);
    }

    /** PENDING → CONFIRMED (manual confirmation, e.g. cash at the venue). Players pay via /api/payments. */
    @PutMapping("/{id}/confirm")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<?> confirmBooking(@PathVariable String id) {
        guard.requireCourtManagerOrAdmin(booking(id).getCourtID());
        return ResponseEntity.ok(bookingService.confirmBooking(id));
    }

    /** Any non-COMPLETED → CANCELLED */
    @PutMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('USER','ADMIN','MANAGER')")
    public ResponseEntity<?> cancelBooking(@PathVariable String id) {
        Booking b = booking(id);
        AccessGuard.Caller caller = guard.caller();
        boolean allowed = caller.admin()
            || caller.userId().equals(b.getPlayerID())
            || (caller.manager() && guard.managesCourt(caller, b.getCourtID()));
        if (!allowed) throw new ForbiddenException("You can only cancel your own bookings.");
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

    private Booking booking(String id) {
        return bookingRepository.findById(id).orElseThrow(() -> new NotFoundException("Booking not found"));
    }
}
