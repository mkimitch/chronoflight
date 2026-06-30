import type { FlightSegment, Itinerary, LocationConfig } from "../types";
import { resolveSegmentDurationHours, resolveSegmentDurationMinutes } from "./durationFormat";

export const UNKNOWN_AIRPORT_LABEL = "Airport unavailable";
export const UNKNOWN_LOCATION_LABEL = "Location unavailable";
export const UNKNOWN_TIMEZONE_LABEL = "Timezone unavailable";
export const UNKNOWN_COORDINATES_LABEL = "Coordinates unavailable";

export const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};

export const getSafeNumber = (value: unknown, fallback = 0) => {
  return isFiniteNumber(value) ? value : fallback;
};

export const getSafeTripHour = (value: unknown, fallback = 0) => {
  return Math.max(0, getSafeNumber(value, fallback));
};

export const getLocationName = (location: LocationConfig | null | undefined) => {
  const name = location?.name?.trim();
  return name || UNKNOWN_LOCATION_LABEL;
};

export const getAirportCode = (location: LocationConfig | null | undefined) => {
  const code = location?.code?.trim() || location?.iataCode?.trim() || location?.icaoCode?.trim();
  return code ? code.toUpperCase() : UNKNOWN_AIRPORT_LABEL;
};

export const getLocationLabel = (location: LocationConfig | null | undefined) => {
  return `${getLocationName(location)} (${getAirportCode(location)})`;
};

export const getTimezoneName = (location: LocationConfig | null | undefined) => {
  const timezone = location?.timezoneIana?.trim() || location?.timezoneLabel?.trim();
  return timezone || UNKNOWN_TIMEZONE_LABEL;
};

export const formatUtcOffset = (offset: unknown) => {
  if (!isFiniteNumber(offset)) {
    return "UTC offset unavailable";
  }

  const sign = offset >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offset);
  const hours = Math.floor(absoluteOffset);
  const minutes = Math.round((absoluteOffset - hours) * 60);
  const minuteLabel = minutes > 0 ? `:${String(minutes).padStart(2, "0")}` : "";

  return `UTC${sign}${hours}${minuteLabel}`;
};

export const formatLocationTimezone = (location: LocationConfig | null | undefined) => {
  return `${getTimezoneName(location)} ${formatUtcOffset(location?.offset)}`;
};

export const getLocationOffset = (location: LocationConfig | null | undefined) => {
  return getSafeNumber(location?.offset, 0);
};

export const getLocationCoordinates = (location: LocationConfig | null | undefined) => {
  const latitude = location?.coordinates?.latitude ?? location?.latitude;
  const longitude = location?.coordinates?.longitude ?? location?.longitude;

  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) {
    return null;
  }

  return { latitude, longitude };
};

export const formatCoordinatesLabel = (location: LocationConfig | null | undefined) => {
  const coordinates = getLocationCoordinates(location);

  if (!coordinates) {
    return UNKNOWN_COORDINATES_LABEL;
  }

  return `${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`;
};

export const getSegmentDepartureTripHour = (segment: FlightSegment | null | undefined) => {
  return getSafeTripHour(segment?.departureTripHour);
};

export const getSegmentDurationHours = (segment: FlightSegment | null | undefined) => {
  return resolveSegmentDurationHours(segment);
};

export const getSegmentArrivalTripHour = (segment: FlightSegment) => {
  return getSegmentDepartureTripHour(segment) + getSegmentDurationHours(segment);
};

export const isSegmentTimingUsable = (segment: FlightSegment | null | undefined) => {
  return isFiniteNumber(segment?.departureTripHour) && resolveSegmentDurationMinutes(segment) > 0;
};

export const getRenderableSegments = (itinerary: Itinerary) => {
  const locationIds = new Set(itinerary.locations.map((location) => location.id));

  return itinerary.segments.filter((segment) => {
    return isSegmentTimingUsable(segment)
      && locationIds.has(segment.fromLocationId)
      && locationIds.has(segment.toLocationId);
  });
};

export const getSortedUsableSegments = (segments: FlightSegment[]) => {
  return segments
    .filter(isSegmentTimingUsable)
    .sort((a, b) => getSegmentDepartureTripHour(a) - getSegmentDepartureTripHour(b));
};

export const getItineraryIssue = (itinerary: Itinerary | null | undefined) => {
  if (!itinerary) {
    return "Select an itinerary to view the timeline.";
  }

  if (itinerary.locations.length === 0) {
    return "Add at least one airport to build the timeline.";
  }

  if (itinerary.locations.length === 1) {
    return "Add a destination airport to compare timezones.";
  }

  if (itinerary.segments.length === 0) {
    return "Add a flight segment to draw the route.";
  }

  if (getRenderableSegments(itinerary).length === 0) {
    return "Flight segments need valid route airports and duration.";
  }

  return null;
};
