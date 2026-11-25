package com.scd.courtly.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scd.courtly.exception.BusinessException;
import com.scd.courtly.model.SystemReport;
import com.scd.courtly.repository.SystemReportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Keeps a history of generated and exported reports (SYSTEM_REPORT). */
@Service
@RequiredArgsConstructor
public class ReportHistoryService {

    private final SystemReportRepository repository;
    private final ObjectMapper objectMapper;

    public SystemReport record(String adminId, String reportType, Map<String, ?> filters, String exportFormat) {
        String type = reportType == null ? "" : reportType.trim().toUpperCase(Locale.ROOT);
        String format = exportFormat == null ? "" : exportFormat.trim().toUpperCase(Locale.ROOT);
        if (!SystemReport.TYPES.contains(type)) throw new BusinessException("Unknown report type: " + reportType);
        if (!SystemReport.FORMATS.contains(format)) throw new BusinessException("Unknown export format: " + exportFormat);

        Map<String, Object> clean = new LinkedHashMap<>();
        if (filters != null) {
            filters.forEach((k, v) -> {
                if (v != null && !String.valueOf(v).isBlank()) clean.put(k, String.valueOf(v));
            });
        }
        SystemReport r = new SystemReport();
        r.setAdminId(adminId);
        r.setReportType(type);
        r.setExportFormat(format);
        try {
            String json = objectMapper.writeValueAsString(clean);
            r.setFilters(json.length() > 1000 ? json.substring(0, 1000) : json);
        } catch (JsonProcessingException e) {
            r.setFilters("{}");
        }
        return repository.save(r);
    }

    public List<SystemReport> recent(int limit) {
        return repository.findAllByOrderByGeneratedAtDesc(PageRequest.of(0, Math.max(1, Math.min(limit, 200))));
    }
}
