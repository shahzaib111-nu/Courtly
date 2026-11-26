package com.scd.courtly.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** A date of birth as YYYY-MM-DD, in the past, giving an age between 5 and 100. */
@Documented
@Constraint(validatedBy = ValidDateOfBirthValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidDateOfBirth {
    String message() default "Enter a valid date of birth (age 5-100)";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
