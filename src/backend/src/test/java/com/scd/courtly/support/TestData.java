package com.scd.courtly.support;

import java.time.DayOfWeek;
import java.time.LocalDate;

/**
 * Identifiers of the demo data seeded by {@code src/main/resources/data.sql}.
 * Integration tests rely on these rows instead of hard-coding them everywhere.
 */
public final class TestData {

    private TestData() {}

    public static final String DEMO_PASSWORD = "Demo1234";

    // Admin (not stored in the database, see UserService / CustomUserDetailsService)
    public static final String ADMIN_EMAIL    = "admin.playfair@gmail.com";
    public static final String ADMIN_PASSWORD = "Admin123";

    // Arena managers
    public static final String MANAGER_1_ID    = "MGR001";
    public static final String MANAGER_1_EMAIL = "imran.tariq@demo.com";
    public static final String MANAGER_2_ID    = "MGR002";

    // Players
    public static final String PLAYER_ID       = "PLR001";   // Hamza Raza, no discount
    public static final String PLAYER_EMAIL    = "hamza.raza@demo.com";
    public static final String PLAYER_2_ID     = "PLR002";   // Zainab Akhtar, no discount
    public static final String PLAYER_2_EMAIL  = "zainab.akhtar@demo.com";
    public static final String STUDENT_ID      = "PLR003";   // Bilal Chaudhry, 20 % student discount

    // Courts (managed by MGR001 / MGR002)
    public static final String TENNIS_COURT_1  = "CRT-TEN-1"; // 07:00-22:00, 1200 PKR/h, peak 17-21 x1.5, MGR001
    public static final String TENNIS_COURT_2  = "CRT-TEN-2"; // MGR002
    public static final int    SEEDED_COURTS   = 16;
    public static final int    SPORT_TYPES     = 8;

    /** A weekday at least {@code daysAhead} days in the future (avoids weekend surcharges). */
    public static LocalDate futureWeekday(int daysAhead) {
        LocalDate d = LocalDate.now().plusDays(daysAhead);
        while (d.getDayOfWeek() == DayOfWeek.SATURDAY || d.getDayOfWeek() == DayOfWeek.SUNDAY) {
            d = d.plusDays(1);
        }
        return d;
    }

    /** The next Saturday at least {@code daysAhead} days in the future. */
    public static LocalDate futureSaturday(int daysAhead) {
        LocalDate d = LocalDate.now().plusDays(daysAhead);
        while (d.getDayOfWeek() != DayOfWeek.SATURDAY) d = d.plusDays(1);
        return d;
    }
}
