package com.scd.courtly.validation;

import java.time.LocalDate;
import java.time.Period;
import java.time.format.DateTimeParseException;
import java.util.Set;

/**
 * Input rules shared by the API (and mirrored in the browser, see app.js "Validation rules").
 * Kept in one place so registration, profile update and admin screens agree.
 */
public final class Rules {

    private Rules() {}

    /** Person names: letters (any language), spaces, dots, apostrophes and hyphens; at least one letter. */
    public static final String NAME = "^(?=.*\\p{L})[\\p{L} .'-]{2,100}$";
    public static final String NAME_MESSAGE = "Use 2-100 letters; spaces, dots, apostrophes and hyphens are allowed";

    /** E-mail with a real domain ending (rejects "user@localhost"). */
    public static final String EMAIL = "^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\\.[A-Za-z0-9-]+)*\\.[A-Za-z]{2,}$";
    public static final String EMAIL_MESSAGE = "Enter a valid e-mail address, e.g. name@example.com";

    /** University e-mail: the domain must contain an academic label such as .edu or .edu.pk / .ac. */
    public static final String UNIVERSITY_EMAIL = "^[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\\.)*(edu|ac)(\\.[A-Za-z]{2,})*$";
    public static final String UNIVERSITY_EMAIL_MESSAGE = "Use your university e-mail (for example name@lhr.nu.edu.pk)";

    /** Student ID: letters, digits and hyphens, e.g. 22L-1234. */
    public static final String STUDENT_ID = "^[A-Za-z0-9-]{3,30}$";
    public static final String STUDENT_ID_MESSAGE = "Student ID: 3-30 letters, numbers or hyphens (e.g. 22L-1234)";

    /** Clock time "HH:mm", 24-hour. */
    public static final String TIME = "^([01]\\d|2[0-3]):[0-5]\\d$";

    public static final Set<String> SPORTS = Set.of(
        "TENNIS", "CRICKET", "FOOTBALL", "BASKETBALL", "FUTSAL", "BADMINTON", "SQUASH", "VOLLEYBALL");
    public static final Set<String> COURT_STATUSES = Set.of("AVAILABLE", "MAINTENANCE", "CLOSED");
    public static final Set<String> DOC_TYPES = Set.of("STUDENT_ID", "SENIOR_CARD", "FAMILY_CARD");

    public static final int MIN_PLAYER_AGE = 5;
    public static final int MIN_MANAGER_AGE = 18;
    public static final int MAX_AGE = 100;

    /** Age in whole years for an ISO date of birth, or -1 when it is not a valid past date. */
    public static int age(String dateOfBirth) {
        if (dateOfBirth == null) return -1;
        try {
            LocalDate dob = LocalDate.parse(dateOfBirth.trim());
            if (!dob.isBefore(LocalDate.now())) return -1;
            return Period.between(dob, LocalDate.now()).getYears();
        } catch (DateTimeParseException e) {
            return -1;
        }
    }
}
