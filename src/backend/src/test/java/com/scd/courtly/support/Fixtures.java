package com.scd.courtly.support;

import com.scd.courtly.model.Booking;
import com.scd.courtly.model.Court;
import com.scd.courtly.model.Player;

/** Small builders for model objects used by unit tests and integration tests. */
public final class Fixtures {

    private Fixtures() {}

    /** Court open 08:00-22:00, 60-minute slots, 1000 PKR/h, peak 17:00-21:00 x1.5, weekend x1.25. */
    public static Court court(String id) {
        Court c = new Court();
        c.setCourtID(id);
        c.setName("Test Court " + id);
        c.setSportType("TENNIS");
        c.setHourlyRate(1000);
        c.setCapacity(4);
        c.setOpenTime("08:00");
        c.setCloseTime("22:00");
        c.setSlotDurationMinutes(60);
        c.setStatus("AVAILABLE");
        c.setManagerId("MGR-TEST");
        c.setPeakStartTime("17:00");
        c.setPeakEndTime("21:00");
        c.setPeakMultiplier(1.5);
        c.setWeekendMultiplier(1.25);
        return c;
    }

    public static Booking booking(String id, String playerID, String courtID,
                                  String date, String timeSlot, String status) {
        Booking b = new Booking();
        b.setBookingID(id);
        b.setPlayerID(playerID);
        b.setCourtID(courtID);
        b.setCourtName("Test Court " + courtID);
        b.setSportType("TENNIS");
        b.setBookingDate(date);
        b.setTimeSlot(timeSlot);
        b.setBaseRate(1000);
        b.setTotalCost(1000);
        b.setStatus(status);
        return b;
    }

    public static Player player(String id, String email) {
        Player p = new Player();
        p.setUserID(id);
        p.setName("Player " + id);
        p.setEmail(email);
        p.setRole("PLAYER");
        p.setAccountStatus("Active");
        p.setDiscountTier("NONE");
        return p;
    }
}
