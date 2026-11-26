package com.scd.courtly.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * A Pakistani mobile number: 11 digits starting with 03 (e.g. 0300-1234567). Also accepts the
 * international forms +92 300 1234567 / 0092..., with spaces or dashes. Store it with
 * {@link PhoneNumbers#normalize(String)}. {@code null} is left to {@code @NotBlank}.
 */
@Documented
@Constraint(validatedBy = PakistaniPhoneValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface PakistaniPhone {
    String message() default "Enter a Pakistani mobile number: 11 digits starting with 03, e.g. 0300-1234567";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
