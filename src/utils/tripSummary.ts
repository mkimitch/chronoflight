import type { Itinerary } from "../types";
import { getRenderableSegments, getSegmentDepartureTripHour } from "./itineraryDisplay";
import { calculateDaylightSummary } from "./timezoneMath";
import {
  getLastArrivalTripHour,
  getLayoverDurationHours,
  getNetTimezoneShiftHours,
  getTotalFlightDurationHours
} from "./timelineHorizon";

export interface TripSummaryMetrics {
  daylightHours: number;
  elapsedHours: number;
  flightHours: number;
  groundHours: number;
  layoverCount: number;
  netTimezoneShiftHours: number;
  nightHours: number;
}

export const getTripSummaryMetrics = (itinerary: Itinerary): TripSummaryMetrics => {
  const sortedSegments = getRenderableSegments(itinerary)
    .sort((a, b) => getSegmentDepartureTripHour(a) - getSegmentDepartureTripHour(b));

  if (sortedSegments.length === 0) {
    return {
      daylightHours: 0,
      elapsedHours: 0,
      flightHours: 0,
      groundHours: 0,
      layoverCount: 0,
      netTimezoneShiftHours: getNetTimezoneShiftHours(itinerary),
      nightHours: 0
    };
  }

  const elapsedHours = getLastArrivalTripHour(sortedSegments);
  const flightHours = getTotalFlightDurationHours(sortedSegments);
  const layoverCount = Math.max(0, sortedSegments.length - 1);
  const layoverHours = sortedSegments.reduce((totalLayoverHours, segment, index) => {
    const nextSegment = sortedSegments[index + 1];
    return nextSegment
      ? totalLayoverHours + getLayoverDurationHours(segment, nextSegment)
      : totalLayoverHours;
  }, 0);
  const preDepartureGroundHours = Math.max(0, getSegmentDepartureTripHour(sortedSegments[0]));
  const groundHours = Math.max(0, preDepartureGroundHours + layoverHours);
  const daylightSummary = calculateDaylightSummary(itinerary, elapsedHours);

  return {
    daylightHours: daylightSummary.daylightHours,
    elapsedHours,
    flightHours,
    groundHours,
    layoverCount,
    netTimezoneShiftHours: getNetTimezoneShiftHours(itinerary),
    nightHours: daylightSummary.nightHours
  };
};
