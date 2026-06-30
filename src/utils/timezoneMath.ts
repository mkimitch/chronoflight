import type { Itinerary, LocationConfig, FlightSegment } from "../types";
import {
  getLocationCoordinates,
  getLocationOffset,
  getRenderableSegments,
  getSafeNumber,
  getSafeTripHour,
  getSegmentArrivalTripHour,
  getSegmentDepartureTripHour,
  getSegmentDurationHours,
  getSortedUsableSegments
} from "./itineraryDisplay";
import {
  formatLocalTime,
  getLocalTimelineDateTime,
  getOffsetDayName
} from "./itineraryTime";
import {
  getTimePeriodForLocationDateTime,
  TimelineTimePeriod,
  TimelineTimePeriodSource
} from "./solarPeriods";

export interface HourStatus {
  tripHour: number;
  localHour: number; // 0-23
  localMinute: number;
  localMinuteOfDay: number;
  localDate: string;
  formattedDate: string;
  formattedTime: string; // e.g. "8 AM", "6:58 PM"
  dayOffset: number; // e.g. 0 for same day, 1 for next day, etc.
  dayName: string; // e.g. "Monday"
  timePeriod: TimelineTimePeriod;
  timePeriodSource: TimelineTimePeriodSource;
  daylightLabel: string;
}

export interface TravelerStatus {
  type: "origin" | "layover" | "flight" | "destination";
  currentLocation: LocationConfig | null;
  flightSegment: FlightSegment | null;
  tripHour: number;
}

const FALLBACK_HOUR_STATUS: HourStatus = {
  tripHour: 0,
  localHour: 0,
  localMinute: 0,
  localMinuteOfDay: 0,
  localDate: "",
  formattedDate: "Date unavailable",
  formattedTime: "Time unavailable",
  dayOffset: 0,
  dayName: "Day unavailable",
  timePeriod: "night",
  timePeriodSource: "fallback",
  daylightLabel: "Solar data unavailable; using fallback daylight cycle."
};

// Convert 24-hour number to AM/PM string
export function formatLocalHour(hour: number): string {
  return formatLocalTime(hour, 0);
}

export { getOffsetDayName };

// Calculate the status of a specific location at a specific trip hour
export function getHourStatusForLocation(
  itinerary: Itinerary,
  location: LocationConfig | null | undefined,
  tripHour: number
): HourStatus {
  const origin = itinerary.locations[0];
  if (!origin || !location) {
    return {
      ...FALLBACK_HOUR_STATUS,
      tripHour: getSafeTripHour(tripHour)
    };
  }

  const safeTripHour = getSafeTripHour(tripHour);
  const localDateTime = getLocalTimelineDateTime(itinerary, location, safeTripHour);
  const period = getTimePeriodForLocationDateTime(
    location,
    localDateTime.date,
    localDateTime.minuteOfDay
  );

  return {
    tripHour: safeTripHour,
    localHour: localDateTime.hour,
    localMinute: localDateTime.minute,
    localMinuteOfDay: localDateTime.minuteOfDay,
    localDate: localDateTime.date,
    formattedDate: localDateTime.formattedDate,
    formattedTime: localDateTime.formattedTime,
    dayOffset: localDateTime.dayOffset,
    dayName: localDateTime.weekday,
    timePeriod: period.timePeriod,
    timePeriodSource: period.source,
    daylightLabel: period.window.message
  };
}

// Determine where the traveler physically is at a given trip hour
export function getTravelerStatusAtHour(
  itinerary: Itinerary,
  tripHour: number
): TravelerStatus {
  const { locations } = itinerary;
  const safeTripHour = getSafeTripHour(tripHour);
  const sortedSegments = getRenderableSegments(itinerary)
    .sort((a, b) => getSegmentDepartureTripHour(a) - getSegmentDepartureTripHour(b));

  if (sortedSegments.length === 0) {
    return {
      type: "origin",
      currentLocation: locations[0] || null,
      flightSegment: null,
      tripHour: safeTripHour,
    };
  }

  // Check if traveler is in any flight
  for (const flight of sortedSegments) {
    const flightDepartureHour = getSegmentDepartureTripHour(flight);
    const flightArrivalHour = getSegmentArrivalTripHour(flight);
    if (safeTripHour >= flightDepartureHour && safeTripHour < flightArrivalHour) {
      return {
        type: "flight",
        currentLocation: null,
        flightSegment: flight,
        tripHour: safeTripHour,
      };
    }
  }

  // Determine if before the first flight
  if (safeTripHour < getSegmentDepartureTripHour(sortedSegments[0])) {
    return {
      type: "origin",
      currentLocation: locations.find(l => l.id === sortedSegments[0].fromLocationId) || locations[0] || null,
      flightSegment: null,
      tripHour: safeTripHour,
    };
  }

  // Determine if after the last flight
  const lastFlight = sortedSegments[sortedSegments.length - 1];
  const lastFlightArrival = getSegmentArrivalTripHour(lastFlight);
  if (safeTripHour >= lastFlightArrival) {
    return {
      type: "destination",
      currentLocation: locations.find(l => l.id === lastFlight.toLocationId) || locations[locations.length - 1] || null,
      flightSegment: null,
      tripHour: safeTripHour,
    };
  }

  // Otherwise, must be in a layover between flights
  for (let i = 0; i < sortedSegments.length - 1; i++) {
    const flightA = sortedSegments[i];
    const flightB = sortedSegments[i + 1];
    const arrivalA = getSegmentArrivalTripHour(flightA);

    if (safeTripHour >= arrivalA && safeTripHour < getSegmentDepartureTripHour(flightB)) {
      // In a layover at the arrival airport of Flight A / departure of Flight B
      return {
        type: "layover",
        currentLocation: locations.find(l => l.id === flightA.toLocationId) || null,
        flightSegment: null,
        tripHour: safeTripHour,
      };
    }
  }

  // Fallback
  return {
    type: "origin",
    currentLocation: locations[0] || null,
    flightSegment: null,
    tripHour: safeTripHour,
  };
}

// Calculate the recommended sleep window based on destination timezone
export function isRecommendedSleepHour(
  itinerary: Itinerary,
  tripHour: number
): boolean {
  // Simple Jetlag Sleep Protocol:
  // After boarding the final leg (or starting from halfway through the layover),
  // try to align sleep hours with the destination's natural sleep cycle (10 PM to 6 AM).
  // Before that, align with the origin's natural sleep cycle.
  const { locations } = itinerary;
  if (locations.length < 2) return false;

  const origin = locations[0];
  const destination = locations[locations.length - 1];
  const sortedSegments = getSortedUsableSegments(itinerary.segments);
  if (sortedSegments.length === 0) return false;

  // Transition hour: let's say we start adjusting to destination sleep halfway through the entire trip
  const firstDeparture = getSegmentDepartureTripHour(sortedSegments[0]);
  const lastArrival = getSegmentArrivalTripHour(sortedSegments[sortedSegments.length - 1]);
  const transitionHour = firstDeparture + (lastArrival - firstDeparture) / 2;

  if (getSafeTripHour(tripHour) < transitionHour) {
    // Sync with origin sleep schedule
    const status = getHourStatusForLocation(itinerary, origin, tripHour);
    return status.localHour >= 22 || status.localHour < 6;
  } else {
    // Sync with destination sleep schedule
    const status = getHourStatusForLocation(itinerary, destination, tripHour);
    return status.localHour >= 22 || status.localHour < 6;
  }
}

const getInFlightLocationEstimate = (
  itinerary: Itinerary,
  flight: FlightSegment,
  tripHour: number
): LocationConfig | null => {
  const fromLoc = itinerary.locations.find(l => l.id === flight.fromLocationId);
  const toLoc = itinerary.locations.find(l => l.id === flight.toLocationId);
  const duration = getSegmentDurationHours(flight);

  if (!fromLoc || !toLoc || duration <= 0) {
    return null;
  }

  const progress = Math.min(1, Math.max(0, (tripHour - getSegmentDepartureTripHour(flight)) / duration));
  const interpolatedOffset = getLocationOffset(fromLoc) + progress * (getLocationOffset(toLoc) - getLocationOffset(fromLoc));
  const fromCoordinates = getLocationCoordinates(fromLoc);
  const toCoordinates = getLocationCoordinates(toLoc);
  const coordinates = fromCoordinates && toCoordinates
    ? {
      latitude: fromCoordinates.latitude + progress * (toCoordinates.latitude - fromCoordinates.latitude),
      longitude: fromCoordinates.longitude + progress * (toCoordinates.longitude - fromCoordinates.longitude)
    }
    : undefined;

  return {
    id: "interpolated-flight",
    name: "In Flight",
    code: "FLT",
    coordinates,
    timezoneLabel: "Flight estimate",
    offset: interpolatedOffset
  };
};

// Get the total daylight hours experienced during the trip
export function calculateDaylightSummary(itinerary: Itinerary, maxHour: number) {
  let daylightHours = 0;
  let twilightHours = 0;
  let nightHours = 0;
  const safeMaxHour = Math.max(0, Math.floor(getSafeNumber(maxHour)));

  for (let t = 0; t <= safeMaxHour; t++) {
    const status = getTravelerStatusAtHour(itinerary, t);
    let activeLocation = status.currentLocation;

    if (status.type === "flight" && status.flightSegment) {
      activeLocation = getInFlightLocationEstimate(itinerary, status.flightSegment, t);
    }

    if (activeLocation) {
      const hourStatus = getHourStatusForLocation(itinerary, activeLocation, t);
      if (hourStatus.timePeriod === "day") {
        daylightHours++;
      } else if (hourStatus.timePeriod === "twilight") {
        twilightHours++;
      } else {
        nightHours++;
      }
    }
  }

  return { daylightHours, twilightHours, nightHours };
}
