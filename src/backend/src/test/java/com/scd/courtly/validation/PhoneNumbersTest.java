package com.scd.courtly.validation;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("unit")
@DisplayName("Pakistani mobile numbers")
class PhoneNumbersTest {

    @ParameterizedTest(name = "\"{0}\" is valid")
    @ValueSource(strings = {"03001234567", "0300-1234567", "0300 1234567", "+923001234567", "+92 300 1234567",
                            "+92-300-1234567", "00923001234567", "923001234567", "(0300) 1234567"})
    void valid(String phone) {
        assertThat(PhoneNumbers.normalize(phone)).isEqualTo("0300-1234567");
    }

    @ParameterizedTest(name = "\"{0}\" is rejected")
    @ValueSource(strings = {"0300123456", "030012345678", "04235761234", "3001234567", "+1 202 555 0199",
                            "0300-12a4567", "+92 300 123456", "", "  ", "0300_1234567"})
    void invalid(String phone) {
        assertThat(PhoneNumbers.normalize(phone)).isNull();
    }
}
