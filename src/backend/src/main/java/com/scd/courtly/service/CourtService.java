package com.scd.courtly.service;

import com.scd.courtly.model.Court;
import com.scd.courtly.repository.CourtRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class CourtService {

    private final CourtRepository courtRepository;

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
        return courtRepository.save(court);
    }

    public Optional<Court> updateCourt(String id, Court updated) {
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

    public boolean deleteCourt(String id) {
        if (!courtRepository.existsById(id)) return false;
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
