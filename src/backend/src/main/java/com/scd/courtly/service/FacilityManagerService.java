package com.scd.courtly.service;

import com.scd.courtly.model.Booking;
import com.scd.courtly.model.Court;
import com.scd.courtly.model.Player;
import com.scd.courtly.repository.BookingRepository;
import com.scd.courtly.repository.CourtRepository;
import com.scd.courtly.repository.PlayerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FacilityManagerService {

    private final CourtRepository courtRepository;
    private final BookingRepository bookingRepository;
    private final PlayerRepository playerRepository;

    public List<Map<String, Object>> getUpcomingBookings(String managerID) {
        List<String> courtIDs = courtIDs(managerID);
        if (courtIDs.isEmpty()) return List.of();

        List<Booking> bookings = bookingRepository.findByCourtIDInAndStatusInAndBookingDateGreaterThanEqualOrderByBookingDateAsc(
                courtIDs, List.of("PENDING", "CONFIRMED"), LocalDate.now().toString());
        return buildRows(bookings);
    }

    public List<Map<String, Object>> getCompletedBookings(String managerID) {
        List<String> courtIDs = courtIDs(managerID);
        if (courtIDs.isEmpty()) return List.of();

        return buildRows(bookingRepository.findByCourtIDInAndStatusOrderByBookingDateDesc(courtIDs, "COMPLETED"));
    }

    public List<Map<String, Object>> getScheduledMaintenances(String managerID) {
        return courtRepository.findAll().stream()
                .filter(c -> managerID.equals(c.getManagerId()) && c.getMaintenanceFrom() != null)
                .map(c -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("courtID", c.getCourtID());
                    row.put("courtName", c.getName());
                    row.put("sportType", c.getSportType());
                    row.put("status", c.getStatus());
                    row.put("maintenanceFrom", c.getMaintenanceFrom().toString());
                    row.put("maintenanceTo", c.getMaintenanceTo() != null ? c.getMaintenanceTo().toString() : null);
                    return row;
                }).collect(Collectors.toList());
    }

    public boolean cancelMaintenance(String courtID) {
        Optional<Court> opt = courtRepository.findById(courtID);
        if (opt.isEmpty()) return false;

        Court court = opt.get();
        court.setMaintenanceFrom(null);
        court.setMaintenanceTo(null);
        if ("MAINTENANCE".equals(court.getStatus())) court.setStatus("AVAILABLE");
        courtRepository.save(court);
        return true;
    }

    public Court scheduleMaintenance(String courtID, LocalDateTime from, LocalDateTime to) {
        Court court = courtRepository.findById(courtID).orElseThrow();
        court.setMaintenanceFrom(from);
        court.setMaintenanceTo(to);
        return courtRepository.save(court);
    }

    private List<String> courtIDs(String managerID) {
        return courtRepository.findAll().stream()
                .filter(c -> managerID.equals(c.getManagerId()))
                .map(Court::getCourtID)
                .collect(Collectors.toList());
    }

    private List<Map<String, Object>> buildRows(List<Booking> bookings) {
        return bookings.stream().map(b -> {
            Player player = playerRepository.findById(b.getPlayerID()).orElse(null);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("bookingID", b.getBookingID());
            row.put("courtName", b.getCourtName() != null ? b.getCourtName() : "");
            row.put("sportType", b.getSportType() != null ? b.getSportType() : "");
            row.put("playerName", player != null && player.getName() != null ? player.getName() : "Unknown");
            row.put("playerEmail", player != null && player.getEmail() != null ? player.getEmail() : "—");
            row.put("bookingDate", b.getBookingDate() != null ? b.getBookingDate() : "");
            row.put("timeSlot", b.getTimeSlot() != null ? b.getTimeSlot() : "");
            row.put("totalCost", b.getTotalCost());
            row.put("status", b.getStatus());
            return row;
        }).collect(Collectors.toList());
    }
}
