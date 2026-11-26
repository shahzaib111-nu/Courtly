package com.scd.courtly.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class ValidDateOfBirthValidator implements ConstraintValidator<ValidDateOfBirth, String> {
    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isBlank()) return true;   // @NotBlank reports missing values
        int age = Rules.age(value);
        return age >= Rules.MIN_PLAYER_AGE && age <= Rules.MAX_AGE;
    }
}
