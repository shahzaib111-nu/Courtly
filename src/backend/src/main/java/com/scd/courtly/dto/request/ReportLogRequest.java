package com.scd.courtly.dto.request;

import jakarta.validation.constraints.NotBlank;

import java.util.Map;

/** Records a report the browser generated or exported (e.g. a PDF made with jsPDF). */
public record ReportLogRequest(
    @NotBlank String reportType,
    Map<String, String> filters,
    @NotBlank String exportFormat
) {}
