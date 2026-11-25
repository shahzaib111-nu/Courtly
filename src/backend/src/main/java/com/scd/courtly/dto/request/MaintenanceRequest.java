package com.scd.courtly.dto.request;

import jakarta.validation.constraints.NotBlank;

public record MaintenanceRequest(
    @NotBlank String maintenanceFrom,
    String maintenanceTo
) {}
