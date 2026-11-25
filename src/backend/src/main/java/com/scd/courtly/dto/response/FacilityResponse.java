package com.scd.courtly.dto.response;

/** A facility with live figures for listing and the manager's page. */
public record FacilityResponse(
    String facilityID,
    String name,
    String location,
    String openingTime,
    String closingTime,
    String managerId,
    String managerName,
    String operatingStatus,   // OPEN or CLOSED right now
    long courtCount,
    Double averageRating,     // null when there are no ratings
    long ratingCount
) {}
