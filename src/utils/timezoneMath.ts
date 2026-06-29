import { Itinerary, LocationConfig, FlightSegment } from "../types";

export interface HourStatus {
  tripHour: number;
  localHour: number; // 0-23
  formattedTime: string; // e.g. "08 AM", "12 PM"
  dayOffset: number; // e.g. 0 for same day, 1 for next day, etc.
  dayName: string; // e.g. "Monday"
  timePeriod: "day" | "twilight" | "night";
}

export interface TravelerStatus {
  type: "origin" | "layover" | "flight" | "destination";
  currentLocation: LocationConfig | null;
  flightSegment: FlightSegment | null;
  tripHour: number;
}

// Convert 24-hour number to AM/PM string
export function formatLocalHour(hour: number): string {
  const h = hour % 24;
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h > 12 ? `${h - 12} PM` : `${h} AM`;
}

// Get the name of the day offset by a number of days
const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function getOffsetDayName(startDay: string, dayOffset: number): string {
  const startIndex = DAYS_OF_WEEK.indexOf(startDay);
  if (startIndex === -1) return startDay;
  const targetIndex = (startIndex + dayOffset + 7000) % 7;
  return DAYS_OF_WEEK[targetIndex];
}

// Calculate the status of a specific location at a specific trip hour
export function getHourStatusForLocation(
  itinerary: Itinerary,
  location: LocationConfig,
  tripHour: number
): HourStatus {
  const origin = itinerary.locations[0];
  const offsetDiff = location.offset - origin.offset;
  
  // Total hours from the origin start hour
  const totalHours = itinerary.startHourLocal + tripHour + offsetDiff;
  
  // Float representation of the hour in 24h cycle
  let localHour = totalHours % 24;
  if (localHour < 0) {
    localHour += 24;
  }
  
  const dayOffset = Math.floor(totalHours / 24);
  const dayName = getOffsetDayName(itinerary.startDayName, dayOffset);
  
  // Classify time period
  let timePeriod: "day" | "twilight" | "night" = "day";
  if (localHour >= 6 && localHour < 18) {
    timePeriod = "day"; // 6 AM - 6 PM
  } else if (localHour >= 18 && localHour < 21) {
    timePeriod = "twilight"; // 6 PM - 9 PM
  } else {
    timePeriod = "night"; // 9 PM - 6 AM
  }
  
  return {
    tripHour,
    localHour: Math.floor(localHour),
    formattedTime: formatLocalHour(Math.floor(localHour)),
    dayOffset,
    dayName,
    timePeriod,
  };
}

// Determine where the traveler physically is at a given trip hour
export function getTravelerStatusAtHour(
  itinerary: Itinerary,
  tripHour: number
): TravelerStatus {
  const { locations, segments } = itinerary;
  
  // Sort flights chronologically
  const sortedSegments = [...segments].sort((a, b) => a.departureTripHour - b.departureTripHour);
  
  if (sortedSegments.length === 0) {
    return {
      type: "origin",
      currentLocation: locations[0] || null,
      flightSegment: null,
      tripHour,
    };
  }
  
  // Check if traveler is in any flight
  for (const flight of sortedSegments) {
    const flightArrivalHour = flight.departureTripHour + flight.duration;
    if (tripHour >= flight.departureTripHour && tripHour < flightArrivalHour) {
      return {
        type: "flight",
        currentLocation: null,
        flightSegment: flight,
        tripHour,
      };
    }
  }
  
  // Determine if before the first flight
  if (tripHour < sortedSegments[0].departureTripHour) {
    return {
      type: "origin",
      currentLocation: locations.find(l => l.id === sortedSegments[0].fromLocationId) || locations[0],
      flightSegment: null,
      tripHour,
    };
  }
  
  // Determine if after the last flight
  const lastFlight = sortedSegments[sortedSegments.length - 1];
  const lastFlightArrival = lastFlight.departureTripHour + lastFlight.duration;
  if (tripHour >= lastFlightArrival) {
    return {
      type: "destination",
      currentLocation: locations.find(l => l.id === lastFlight.toLocationId) || locations[locations.length - 1],
      flightSegment: null,
      tripHour,
    };
  }
  
  // Otherwise, must be in a layover between flights
  for (let i = 0; i < sortedSegments.length - 1; i++) {
    const flightA = sortedSegments[i];
    const flightB = sortedSegments[i + 1];
    const arrivalA = flightA.departureTripHour + flightA.duration;
    
    if (tripHour >= arrivalA && tripHour < flightB.departureTripHour) {
      // In a layover at the arrival airport of Flight A / departure of Flight B
      return {
        type: "layover",
        currentLocation: locations.find(l => l.id === flightA.toLocationId) || null,
        flightSegment: null,
        tripHour,
      };
    }
  }
  
  // Fallback
  return {
    type: "origin",
    currentLocation: locations[0],
    flightSegment: null,
    tripHour,
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
  const { locations, segments } = itinerary;
  if (locations.length < 2) return false;
  
  const origin = locations[0];
  const destination = locations[locations.length - 1];
  
  const sortedSegments = [...segments].sort((a, b) => a.departureTripHour - b.departureTripHour);
  if (sortedSegments.length === 0) return false;
  
  // Transition hour: let's say we start adjusting to destination sleep halfway through the entire trip
  const firstDeparture = sortedSegments[0].departureTripHour;
  const lastArrival = sortedSegments[sortedSegments.length - 1].departureTripHour + sortedSegments[sortedSegments.length - 1].duration;
  const transitionHour = firstDeparture + (lastArrival - firstDeparture) / 2;
  
  if (tripHour < transitionHour) {
    // Sync with origin sleep schedule
    const status = getHourStatusForLocation(itinerary, origin, tripHour);
    return status.localHour >= 22 || status.localHour < 6;
  } else {
    // Sync with destination sleep schedule
    const status = getHourStatusForLocation(itinerary, destination, tripHour);
    return status.localHour >= 22 || status.localHour < 6;
  }
}

// Get the total daylight hours experienced during the trip
export function calculateDaylightSummary(itinerary: Itinerary, maxHour: number) {
  let daylightHours = 0;
  let twilightHours = 0;
  let nightHours = 0;
  
  for (let t = 0; t <= maxHour; t++) {
    const status = getTravelerStatusAtHour(itinerary, t);
    let activeLocation = status.currentLocation;
    
    // If in flight, we estimate timezone based on interpolation between origin and destination offsets
    if (status.type === "flight" && status.flightSegment) {
      const flight = status.flightSegment;
      const fromLoc = itinerary.locations.find(l => l.id === flight.fromLocationId)!;
      const toLoc = itinerary.locations.find(l => l.id === flight.toLocationId)!;
      const progress = (t - flight.departureTripHour) / flight.duration;
      const interpolatedOffset = fromLoc.offset + progress * (toLoc.offset - fromLoc.offset);
      
      const pseudoLoc: LocationConfig = {
        id: "interpolated",
        name: "In Flight",
        code: "FLT",
        timezoneLabel: "FLT",
        offset: interpolatedOffset
      };
      activeLocation = pseudoLoc;
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
