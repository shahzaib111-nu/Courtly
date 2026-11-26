package com.scd.courtly.service;

import com.scd.courtly.model.Court;
import com.scd.courtly.exception.BusinessException;
import com.scd.courtly.exception.ConflictException;
import com.scd.courtly.validation.Rules;
import com.scd.courtly.repository.BookingRepository;
import com.scd.courtly.repository.CourtRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class CourtService {

    private final CourtRepository courtRepository;
    private final BookingRepository bookingRepository;

    public List<Court> getAllCourts() {
        return courtRepository.findAll();
    }

    public Optional<Court> getCourtById(String id) {
        return courtRepository.findById(id);
    }

    public List<Court> getCourtsBySport(String sportType) {
        return courtRepository.findBySportType(sportType.toUpperCase());
    }

    public List<Court> getAvailableCourts() {
        return courtRepository.findByStatus("AVAILABLE");
    }

    public Court createCourt(Court court) {
        validate(court);
        return courtRepository.save(court);
    }

    /**
     * FR-35: checks court information before it is saved and fills in defaults for optional
     * fields. Throws {@link BusinessException} (400) with a message the manager can act on.
     */
    public static void validate(Court c) {
        String name = c.getName() == null ? "" : c.getName().trim();
        if (name.length() < 2 || name.length() > 100 || !name.matches("^(?=.*\\p{L})[\\p{L}\\d .,'&()#/-]+$"))
            throw new BusinessException("Court name: 2-100 characters with at least one letter.");
        c.setName(name);

        String sport = c.getSportType() == null ? "" : c.getSportType().trim().toUpperCase();
        if (!Rules.SPORTS.contains(sport))
            throw new BusinessException("Sport must be one of: Tennis, Cricket, Football, Basketball, Futsal, Badminton, Squash, Volleyball.");
        c.setSportType(sport);

        if (c.getHourlyRate() < 100 || c.getHourlyRate() > 100_000)
            throw new BusinessException("Hourly rate must be between PKR 100 and PKR 100,000.");

        if (c.getCapacity() <= 0) c.setCapacity(Court.defaultCapacity(sport));
        if (c.getCapacity() > 100)
            throw new BusinessException("Capacity must be between 1 and 100 players.");

        if (isBlank(c.getOpenTime()))  c.setOpenTime("08:00");
        if (isBlank(c.getCloseTime())) c.setCloseTime("22:00");
        if (!c.getOpenTime().matches(Rules.TIME) || !c.getCloseTime().matches(Rules.TIME))
            throw new BusinessException("Opening and closing times must use HH:mm (24-hour).");
        if (c.getOpenTime().equals(c.getCloseTime()))
            throw new BusinessException("Opening and closing times cannot be the same.");

        if (c.getSlotDurationMinutes() <= 0) c.setSlotDurationMinutes(60);
        if (c.getSlotDurationMinutes() < 30 || c.getSlotDurationMinutes() > 240 || c.getSlotDurationMinutes() % 15 != 0)
            throw new BusinessException("Slot length must be 30-240 minutes, in steps of 15.");
        int open = minutes(c.getOpenTime()), close = minutes(c.getCloseTime());
        int day = close > open ? close - open : close + 24 * 60 - open;
        if (day < c.getSlotDurationMinutes())
            throw new BusinessException("The opening hours are shorter than one slot.");

        if (isBlank(c.getStatus())) c.setStatus("AVAILABLE");
        c.setStatus(c.getStatus().trim().toUpperCase());
        if (!Rules.COURT_STATUSES.contains(c.getStatus()))
            throw new BusinessException("Status must be AVAILABLE, MAINTENANCE or CLOSED.");

        boolean hasPeakStart = !isBlank(c.getPeakStartTime()), hasPeakEnd = !isBlank(c.getPeakEndTime());
        if (hasPeakStart != hasPeakEnd)
            throw new BusinessException("Enter both the peak start and peak end time, or neither.");
        if (hasPeakStart) {
            if (!c.getPeakStartTime().matches(Rules.TIME) || !c.getPeakEndTime().matches(Rules.TIME))
                throw new BusinessException("Peak times must use HH:mm (24-hour).");
            if (minutes(c.getPeakEndTime()) <= minutes(c.getPeakStartTime()))
                throw new BusinessException("Peak end time must be after the peak start time.");
        } else {
            c.setPeakStartTime(null);
            c.setPeakEndTime(null);
        }

        if (c.getPeakMultiplier() <= 0) c.setPeakMultiplier(1.0);
        if (c.getWeekendMultiplier() <= 0) c.setWeekendMultiplier(1.0);
        if (c.getPeakMultiplier() < 1.0 || c.getPeakMultiplier() > 3.0
                || c.getWeekendMultiplier() < 1.0 || c.getWeekendMultiplier() > 3.0)
            throw new BusinessException("Peak and weekend multipliers must be between 1.0 and 3.0.");

        if (c.getDescription() != null) {
            String d = c.getDescription().trim();
            if (d.length() > 500) throw new BusinessException("Description can be at most 500 characters.");
            c.setDescription(d.isEmpty() ? null : d);
        }
    }

    private static boolean isBlank(String v) {
        return v == null || v.isBlank();
    }

    private static int minutes(String hhmm) {
        String[] p = hhmm.split(":");
        return Integer.parseInt(p[0]) * 60 + Integer.parseInt(p[1]);
    }

    public Optional<Court> updateCourt(String id, Court updated) {
        if (courtRepository.existsById(id)) validate(updated);
        return courtRepository.findById(id).map(existing -> {
            existing.setName(updated.getName());
            existing.setSportType(updated.getSportType());
            existing.setHourlyRate(updated.getHourlyRate());
            existing.setCapacity(updated.getCapacity());
            existing.setOpenTime(updated.getOpenTime());
            existing.setCloseTime(updated.getCloseTime());
            existing.setSlotDurationMinutes(updated.getSlotDurationMinutes());
            existing.setStatus(updated.getStatus());
            existing.setPeakStartTime(updated.getPeakStartTime());
            existing.setPeakEndTime(updated.getPeakEndTime());
            existing.setPeakMultiplier(updated.getPeakMultiplier() > 0 ? updated.getPeakMultiplier() : 1.0);
            existing.setWeekendMultiplier(updated.getWeekendMultiplier() > 0 ? updated.getWeekendMultiplier() : 1.0);
            existing.setDescription(updated.getDescription());
            return courtRepository.save(existing);
        });
    }

    /**
     * FR-34: a court with active future bookings (pending payment or confirmed, today or later)
     * cannot be removed; the manager must cancel those bookings or wait until they are over.
     */
    public boolean deleteCourt(String id) {
        if (!courtRepository.existsById(id)) return false;
        long upcoming = bookingRepository.countByCourtIDAndStatusInAndBookingDateGreaterThanEqual(
                id, List.of("PENDING", "CONFIRMED"), java.time.LocalDate.now().toString());
        if (upcoming > 0) {
            throw new ConflictException("This court cannot be removed because it has " + upcoming
                + " upcoming booking" + (upcoming == 1 ? "" : "s")
                + ". Cancel them first, or mark the court as under maintenance instead.");
        }
        courtRepository.deleteById(id);
        return true;
    }

    /**
     * Generates time slots between openTime and closeTime using slotDurationMinutes.
     * Each slot is a map: { startTime, endTime, display }
     */
    public List<Map<String, String>> generateTimeSlots(Court court) {
        List<Map<String, String>> slots = new ArrayList<>();
        if (court.getOpenTime() == null || court.getCloseTime() == null) return slots;

        int openMins  = parseTime(court.getOpenTime());
        int closeMins = parseTime(court.getCloseTime());
        if (closeMins <= openMins) closeMins += 24 * 60; // handle past-midnight close times
        int duration  = court.getSlotDurationMinutes() > 0 ? court.getSlotDurationMinutes() : 60;

        for (int t = openMins; t + duration <= closeMins; t += duration) {
            String start = formatTime(t % (24 * 60));
            String end   = formatTime((t + duration) % (24 * 60));
            Map<String, String> slot = new LinkedHashMap<>();
            slot.put("startTime", start);
            slot.put("endTime",   end);
            slot.put("display",   start + " – " + end);
            slots.add(slot);
        }
        return slots;
    }

    private int parseTime(String hhmm) {
        String[] parts = hhmm.split(":");
        return Integer.parseInt(parts[0]) * 60 + Integer.parseInt(parts[1]);
    }

    private String formatTime(int totalMinutes) {
        return String.format("%02d:%02d", totalMinutes / 60, totalMinutes % 60);
    }
}
