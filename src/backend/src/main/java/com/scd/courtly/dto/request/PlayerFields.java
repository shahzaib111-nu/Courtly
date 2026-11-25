package com.scd.courtly.dto.request;

/** Validation rules shared by registration and profile update. */
public final class PlayerFields {

    private PlayerFields() {}

    /** 3-30 letters, digits, dots or underscores. No '@', so it can never look like an e-mail. */
    public static final String USERNAME_REGEX = "[A-Za-z0-9._]{3,30}";
    public static final String USERNAME_MESSAGE = "Username must be 3-30 letters, numbers, dots or underscores";

    /** Player categories (FR-9). */
    public static final String CATEGORY_REGEX = "(?i)REGULAR|STUDENT|SENIOR|FAMILY|GROUP";
    public static final String CATEGORY_MESSAGE = "Category must be Regular, Student, Senior, Family or Group";
}
