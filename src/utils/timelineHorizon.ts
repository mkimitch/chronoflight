import type { FlightSegment, Itinerary, TimelinePreferences } from "../types";
import {
  getLocationOffset,
  getRenderableSegments,
  getSafeNumber,
  getSegmentArrivalTripHour as getSafeSegmentArrivalTripHour,
  getSegmentDepartureTripHour,
  getSegmentDurationHours,
  getSortedUsableSegments,
  isSegmentTimingUsable
} from "./itineraryDisplay";

export const TIMELINE_MIN_HOURS = 24;
export const TIMELINE_POST_ARRIVAL_HOUR_MIN = 0;
export const TIMELINE_POST_ARRIVAL_HOUR_MAX = 18;

export const DEFAULT_TIMELINE_PREFERENCES: TimelinePreferences = {
  postArrivalMode: "adaptive",
  postArrivalHours: 6
};

const ADAPTIVE_POST_ARRIVAL_HOUR_MIN = 4;
const ADAPTIVE_POST_ARRIVAL_HOUR_MAX = 10;
const LONG_HAUL_OFFSET_THRESHOLD = 6;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeHour = (hour: number) => ((hour % 24) + 24) % 24;

const hoursUntil = (fromHour: number, toHour: number) => normalizeHour(toHour - fromHour);

const isHourInWindow = (hour: number, startHour: number, endHour: number) => {
  if (startHour === endHour) {
    return false;
  }

  if (startHour < endHour) {
    return hour >= startHour && hour < endHour;
  }

  return hour >= startHour || hour < endHour;
};

export const getSegmentArrivalTripHour = (segment: FlightSegment) => getSafeSegmentArrivalTripHour(segment);

export const getTotalFlightDurationHours = (segments: FlightSegment[]) => {
  return segments.reduce((totalDuration, segment) => totalDuration + getSegmentDurationHours(segment), 0);
};

export const getLayoverDurationHours = (arrivingSegment: FlightSegment, departingSegment: FlightSegment) => {
  return Math.max(0, getSegmentDepartureTripHour(departingSegment) - getSegmentArrivalTripHour(arrivingSegment));
};

export const getNetTimezoneShiftHours = (itinerary: Itinerary) => {
  const origin = itinerary.locations[0];
  const destination = itinerary.locations[itinerary.locations.length - 1];

  if (!origin || !destination) {
    return 0;
  }

  return getLocationOffset(destination) - getLocationOffset(origin);
};

export const getLastArrivalTripHour = (segments: FlightSegment[]) => {
  const usableSegments = segments.filter(isSegmentTimingUsable);

  if (usableSegments.length === 0) {
    return 0;
  }

  return usableSegments.reduce(
    (latestArrival, segment) => Math.max(latestArrival, getSegmentArrivalTripHour(segment)),
    0
  );
};

export const getTimelinePreferences = (itinerary: Itinerary): TimelinePreferences => {
  const postArrivalHours = getSafeNumber(
    itinerary.timelinePreferences?.postArrivalHours,
    DEFAULT_TIMELINE_PREFERENCES.postArrivalHours
  );

  return {
    postArrivalMode: itinerary.timelinePreferences?.postArrivalMode ?? DEFAULT_TIMELINE_PREFERENCES.postArrivalMode,
    postArrivalHours: clamp(
      Math.round(postArrivalHours),
      TIMELINE_POST_ARRIVAL_HOUR_MIN,
      TIMELINE_POST_ARRIVAL_HOUR_MAX
    )
  };
};

export const getAdaptivePostArrivalHours = (itinerary: Itinerary) => {
  const origin = itinerary.locations[0];
  const destination = itinerary.locations[itinerary.locations.length - 1];
  const sortedSegments = getSortedUsableSegments(getRenderableSegments(itinerary));

  if (!origin || !destination || sortedSegments.length === 0) {
    return DEFAULT_TIMELINE_PREFERENCES.postArrivalHours;
  }

  const lastArrivalTripHour = getLastArrivalTripHour(sortedSegments);
  const arrivalLocalHour = normalizeHour(
    getSafeNumber(itinerary.startHourLocal) + lastArrivalTripHour + getNetTimezoneShiftHours(itinerary)
  );
  const timezoneShift = Math.abs(getNetTimezoneShiftHours(itinerary));
  const baseHours = timezoneShift >= LONG_HAUL_OFFSET_THRESHOLD ? 8 : 6;
  const bedtime = getSafeNumber(itinerary.sleepPreferences.targetBedtime, 22);
  const wakeTime = getSafeNumber(itinerary.sleepPreferences.targetWakeTime, 6);
  const hoursToWakeCue = isHourInWindow(arrivalLocalHour, bedtime, wakeTime)
    ? hoursUntil(arrivalLocalHour, wakeTime) + 2
    : 0;
  const hoursToBedCue = hoursUntil(arrivalLocalHour, bedtime);
  const nearBedtimeCue = hoursToBedCue <= 4 ? hoursToBedCue + 2 : 0;

  return clamp(
    Math.ceil(Math.max(baseHours, hoursToWakeCue, nearBedtimeCue)),
    ADAPTIVE_POST_ARRIVAL_HOUR_MIN,
    ADAPTIVE_POST_ARRIVAL_HOUR_MAX
  );
};

export const getTimelineHorizon = (itinerary: Itinerary) => {
  const sortedSegments = getSortedUsableSegments(getRenderableSegments(itinerary));

  if (sortedSegments.length === 0) {
    return {
      lastArrivalTripHour: 0,
      maxTripHour: TIMELINE_MIN_HOURS,
      postArrivalHours: 0
    };
  }

  const preferences = getTimelinePreferences(itinerary);
  const lastArrivalTripHour = getLastArrivalTripHour(sortedSegments);
  const postArrivalHours = preferences.postArrivalMode === "custom"
    ? preferences.postArrivalHours
    : getAdaptivePostArrivalHours(itinerary);

  return {
    lastArrivalTripHour,
    maxTripHour: Math.ceil(Math.max(TIMELINE_MIN_HOURS, lastArrivalTripHour + postArrivalHours)),
    postArrivalHours
  };
};