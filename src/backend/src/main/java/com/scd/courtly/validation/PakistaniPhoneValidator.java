package com.scd.courtly.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class PakistaniPhoneValidator implements ConstraintValidator<PakistaniPhone, String> {
    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        return value == null || value.isBlank() || PhoneNumbers.normalize(value) != null;
    }
}
