import { FlightSegment, Itinerary, TimelinePreferences } from "../types";

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

export const getLastArrivalTripHour = (segments: FlightSegment[]) => {
  if (segments.length === 0) {
    return 0;
  }

  return segments.reduce(
    (latestArrival, segment) => Math.max(latestArrival, segment.departureTripHour + segment.duration),
    0
  );
};

export const getTimelinePreferences = (itinerary: Itinerary): TimelinePreferences => {
  const postArrivalHours = itinerary.timelinePreferences?.postArrivalHours ?? DEFAULT_TIMELINE_PREFERENCES.postArrivalHours;

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

  if (!origin || !destination || itinerary.segments.length === 0) {
    return DEFAULT_TIMELINE_PREFERENCES.postArrivalHours;
  }

  const lastArrivalTripHour = getLastArrivalTripHour(itinerary.segments);
  const arrivalLocalHour = normalizeHour(itinerary.startHourLocal + lastArrivalTripHour + destination.offset - origin.offset);
  const timezoneShift = Math.abs(destination.offset - origin.offset);
  const baseHours = timezoneShift >= LONG_HAUL_OFFSET_THRESHOLD ? 8 : 6;
  const bedtime = itinerary.sleepPreferences.targetBedtime;
  const wakeTime = itinerary.sleepPreferences.targetWakeTime;
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
  if (itinerary.segments.length === 0) {
    return {
      lastArrivalTripHour: 0,
      maxTripHour: TIMELINE_MIN_HOURS,
      postArrivalHours: 0
    };
  }

  const preferences = getTimelinePreferences(itinerary);
  const lastArrivalTripHour = getLastArrivalTripHour(itinerary.segments);
  const postArrivalHours = preferences.postArrivalMode === "custom"
    ? preferences.postArrivalHours
    : getAdaptivePostArrivalHours(itinerary);

  return {
    lastArrivalTripHour,
    maxTripHour: Math.ceil(Math.max(TIMELINE_MIN_HOURS, lastArrivalTripHour + postArrivalHours)),
    postArrivalHours
  };
};
