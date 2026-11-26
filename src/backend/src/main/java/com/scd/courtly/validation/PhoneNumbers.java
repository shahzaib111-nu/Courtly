package com.scd.courtly.validation;

/** Pakistani mobile numbers. */
public final class PhoneNumbers {

    private PhoneNumbers() {}

    /**
     * Returns the number as {@code 03XX-XXXXXXX}, or null when it is not a Pakistani mobile number.
     * Accepts 03001234567, 0300-1234567, +92 300 1234567, 0092 300 1234567 and 92 300 1234567.
     */
    public static String normalize(String phone) {
        if (phone == null) return null;
        String raw = phone.trim();
        if (!raw.matches("[+\\d\\s()-]{10,20}")) return null;      // only digits and separators
        String digits = raw.replaceAll("[\\s()-]", "");
        if (digits.startsWith("+92")) digits = "0" + digits.substring(3);
        else if (digits.startsWith("0092")) digits = "0" + digits.substring(4);
        else if (digits.startsWith("92") && digits.length() == 12) digits = "0" + digits.substring(2);
        if (!digits.matches("03\\d{9}")) return null;                // 11 digits, mobile prefix 03
        return digits.substring(0, 4) + "-" + digits.substring(4);
    }
}
