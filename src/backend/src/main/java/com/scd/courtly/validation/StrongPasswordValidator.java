package com.scd.courtly.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class StrongPasswordValidator implements ConstraintValidator<StrongPassword, String> {

    public static final int MIN_LENGTH = 8;
    public static final int MAX_LENGTH = 100;

    public static boolean isStrong(String password) {
        if (password == null || password.length() < MIN_LENGTH || password.length() > MAX_LENGTH) return false;
        boolean letter = false, digit = false;
        for (char c : password.toCharArray()) {
            if (Character.isLetter(c)) letter = true;
            else if (Character.isDigit(c)) digit = true;
        }
        return letter && digit;
    }

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        return value == null || isStrong(value);
    }
}
