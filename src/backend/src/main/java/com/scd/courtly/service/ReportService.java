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
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final BookingRepository bookingRepository;
    private final CourtRepository courtRepository;
    private final PlayerRepository playerRepository;

    public Map<String, Object> buildReport(String type, String startDate, String endDate, String courtType) {
        LocalDate start = parseDate(startDate);
        LocalDate end = parseDate(endDate);

        if (start == null || end == null) {
            end = LocalDate.now();
            start = end.minusDays(7);
        }
        if (end.isBefore(start)) {
            LocalDate temp = start;
            start = end;
            end = temp;
        }

        return switch (type.toUpperCase()) {
            case "COURT_UTILIZATION" -> courtUtilizationReport(start, end, courtType);
            case "REVENUE_SUMMARY" -> revenueSummaryReport(start, end);
            case "USER_DEMOGRAPHICS" -> userDemographicsReport(start, end);
            default -> Map.of(
                    "type", type,
                    "generatedAt", LocalDate.now().toString(),
                    "message", "Unknown report type: " + type
            );
        };
    }

    private Map<String, Object> courtUtilizationReport(LocalDate start, LocalDate end, String courtType) {
        List<Court> courts = courtRepository.findAll();
        if (courtType != null && !courtType.isBlank()) {
            courts = courts.stream()
                    .filter(c -> courtType.equalsIgnoreCase(c.getSportType()))
                    .collect(Collectors.toList());
        }
        List<Booking> bookings = getBookings(start, end).stream()
                .filter(b -> !"CANCELLED".equalsIgnoreCase(b.getStatus()))
                .filter(b -> {
                    if (courtType == null || courtType.isBlank()) return true;
                    return courtType.equalsIgnoreCase(b.getSportType());
                })
                .collect(Collectors.toList());

        long days = ChronoUnit.DAYS.between(start, end) + 1;
        long totalSlots = courts.stream()
                .mapToLong(c -> safeSlotsPerDay(c) * days)
                .sum();

        long bookedSlots = bookings.size();
        double totalBookedHours = bookings.stream()
                .mapToDouble(b -> calculateSlotHours(b.getTimeSlot()))
                .sum();
        double utilization = totalSlots > 0 ? Math.round((bookedSlots / (double) totalSlots) * 1000.0) / 10.0 : 0.0;

        LocalDateTime now = LocalDateTime.now();
        long pastBookings = bookings.stream().filter(b -> {
            try {
                String endStr = b.getTimeSlot().split("-")[1].trim();
                LocalDateTime slotEnd = LocalDate.parse(b.getBookingDate()).atTime(LocalTime.parse(endStr));
                return slotEnd.isBefore(now);
            } catch (Exception e) { return false; }
        }).count();
        long upcomingBookings = bookedSlots - pastBookings;

        Map<String, Long> courtSlotMap = courts.stream()
                .collect(Collectors.toMap(
                        c -> c.getName() != null ? c.getName() : "",
                        c -> safeSlotsPerDay(c) * days,
                        Long::sum));

        List<Map<String, Object>> topCourts = bookings.stream()
                .collect(Collectors.groupingBy(Booking::getCourtName, Collectors.counting()))
                .entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue(Comparator.reverseOrder()))
                .limit(5)
                .map(entry -> {
                    long perCourtSlots = courtSlotMap.getOrDefault(entry.getKey(), 0L);
                    double pct = perCourtSlots > 0
                            ? Math.round((entry.getValue() / (double) perCourtSlots) * 1000.0) / 10.0
                            : 0.0;
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("courtName", entry.getKey());
                    item.put("bookedSlots", entry.getValue());
                    item.put("utilizationPercent", pct);
                    return item;
                })
                .collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("type", "COURT_UTILIZATION");
        result.put("generatedAt", LocalDate.now().toString());
        result.put("startDate", start.toString());
        result.put("endDate", end.toString());
        result.put("courtType", courtType != null ? courtType : "ALL");
        result.put("totalCourts", courts.size());
        result.put("totalBookings", bookedSlots);
        result.put("pastBookings", pastBookings);
        result.put("upcomingBookings", upcomingBookings);
        result.put("totalBookedHours", Math.round(totalBookedHours * 100.0) / 100.0);
        result.put("averageUtilization", utilization);
        result.put("topCourts", topCourts);
        return result;
    }

    private Map<String, Object> revenueSummaryReport(LocalDate start, LocalDate end) {
        List<Booking> bookings = getBookings(start, end).stream()
                .filter(b -> List.of("CONFIRMED", "COMPLETED").contains(b.getStatus()))
                .collect(Collectors.toList());

        double totalRevenue  = bookings.stream().mapToDouble(Booking::getTotalCost).sum();
        // Base revenue: what would have been charged at hourly rate × hours with no multipliers or discounts
        double baseRevenue   = bookings.stream()
                .mapToDouble(b -> b.getBaseRate() * calculateSlotHours(b.getTimeSlot()))
                .sum();
        // Peak+Weekend extra: surcharges above base (can be negative when discounts exceed surcharges)
        double peakWeekendExtra = totalRevenue - baseRevenue + bookings.stream()
                .mapToDouble(Booking::getDiscountApplied).sum();
        double discountRevenue = bookings.stream().mapToDouble(Booking::getDiscountApplied).sum();
        long bookingCount = bookings.size();
        double averageRevenue = bookingCount > 0 ? Math.round((totalRevenue / bookingCount) * 100.0) / 100.0 : 0.0;

        Map<String, Double> revenueBySport = bookings.stream()
                .collect(Collectors.groupingBy(
                        booking -> Optional.ofNullable(booking.getSportType()).orElse("UNKNOWN"),
                        Collectors.summingDouble(Booking::getTotalCost)
                ));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("type", "REVENUE_SUMMARY");
        result.put("generatedAt", LocalDate.now().toString());
        result.put("startDate", start.toString());
        result.put("endDate", end.toString());
        result.put("totalRevenue",    Math.round(totalRevenue    * 100.0) / 100.0);
        result.put("baseRevenue",     Math.round(baseRevenue     * 100.0) / 100.0);
        result.put("peakWeekendExtra", Math.round(peakWeekendExtra * 100.0) / 100.0);
        result.put("discountRevenue", Math.round(discountRevenue  * 100.0) / 100.0);
        result.put("bookingCount",    bookingCount);
        result.put("averageRevenue",  averageRevenue);
        result.put("revenueBySport",  revenueBySport);
        return result;
    }

    private Map<String, Object> userDemographicsReport(LocalDate start, LocalDate end) {
        List<Player> allInRange = playerRepository.findAll().stream()
                .filter(p -> p.getCreatedAt() == null
                        || (!p.getCreatedAt().toLocalDate().isBefore(start)
                         && !p.getCreatedAt().toLocalDate().isAfter(end)))
                .collect(Collectors.toList());

        long totalManagers = allInRange.stream()
                .filter(p -> "MANAGER".equals(p.getRole()))
                .count();

        // Exclude managers from player-only metrics
        List<Player> regularPlayers = allInRange.stream()
                .filter(p -> !"MANAGER".equals(p.getRole()))
                .collect(Collectors.toList());

        Map<String, Long> tierCounts = regularPlayers.stream()
                .collect(Collectors.groupingBy(
                        p -> Optional.ofNullable(p.getDiscountTier()).filter(s -> !s.isBlank()).orElse("NONE"),
                        Collectors.counting()
                ));

        Map<String, Long> ageGroupCounts = regularPlayers.stream()
                .map(this::determineAgeGroup)
                .collect(Collectors.groupingBy(group -> group, Collectors.counting()));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("type", "USER_DEMOGRAPHICS");
        result.put("generatedAt", LocalDate.now().toString());
        result.put("startDate", start.toString());
        result.put("endDate", end.toString());
        result.put("totalPlayers", regularPlayers.size());
        result.put("totalManagers", totalManagers);
        result.put("discountTierCounts", tierCounts);
        result.put("ageGroupCounts", ageGroupCounts);
        return result;
    }

    private List<Booking> getBookings(LocalDate start, LocalDate end) {
        return bookingRepository.findAll().stream()
                .filter(booking -> {
                    try {
                        LocalDate bookingDate = LocalDate.parse(booking.getBookingDate());
                        return !bookingDate.isBefore(start) && !bookingDate.isAfter(end);
                    } catch (Exception ignored) {
                        return false;
                    }
                })
                .collect(Collectors.toList());
    }

    private LocalDate parseDate(String date) {
        if (date == null || date.isBlank()) return null;
        try {
            return LocalDate.parse(date);
        } catch (Exception e) {
            return null;
        }
    }

    private int safeSlotsPerDay(Court court) {
        int open  = parseTime(court.getOpenTime(), 480);
        int close = parseTime(court.getCloseTime(), 1320);
        int dur   = court.getSlotDurationMinutes() > 0 ? court.getSlotDurationMinutes() : 60;
        if (close <= open) close += 24 * 60; // midnight-wrap (e.g. 08:00 – 01:00 next day)
        return dur > 0 ? Math.max(0, (close - open) / dur) : 0;
    }

    private int parseTime(String value, int fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            String[] parts = value.split(":");
            return Integer.parseInt(parts[0].trim()) * 60 + Integer.parseInt(parts[1].trim());
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private String determineAgeGroup(Player player) {
        if (player == null || player.getDateOfBirth() == null || player.getDateOfBirth().isBlank()) {
            return "Unknown";
        }
        try {
            LocalDate dob = LocalDate.parse(player.getDateOfBirth());
            int age = (int) ChronoUnit.YEARS.between(dob, LocalDate.now());
            if (age < 18) return "Under 18";
            if (age < 26) return "18-25";
            if (age < 41) return "26-40";
            if (age < 61) return "41-60";
            return "60+";
        } catch (Exception ignored) {
            return "Unknown";
        }
    }

    private double calculateSlotHours(String timeSlot) {
        if (timeSlot == null || timeSlot.isBlank()) return 1.0; // default 1 hour
        try {
            String[] parts = timeSlot.split("-");
            if (parts.length != 2) return 1.0;
            int startMinutes = parseTime(parts[0].trim() + ":00", 0);
            int endMinutes = parseTime(parts[1].trim() + ":00", 0);
            if (endMinutes <= startMinutes) return 1.0;
            return (endMinutes - startMinutes) / 60.0;
        } catch (Exception ignored) {
            return 1.0;
        }
    }
}
