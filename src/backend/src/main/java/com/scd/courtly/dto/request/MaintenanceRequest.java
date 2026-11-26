package com.scd.courtly.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record MaintenanceRequest(
    @NotBlank @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(:\\d{2})?",
        message = "Use date and time, e.g. 2026-12-01T09:00") String maintenanceFrom,
    @Pattern(regexp = "^$|\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(:\\d{2})?",
        message = "Use date and time, e.g. 2026-12-01T18:00") String maintenanceTo
) {}
