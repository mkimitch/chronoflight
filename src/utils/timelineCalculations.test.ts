import assert from "node:assert/strict";
import test from "node:test";
import {
  multiLegOvernightTripFixture,
  simpleNonstopTripFixture,
  travelPresets
} from "../data/presets";
import type { Itinerary, LocationConfig } from "../types";
import {
  decimalHoursToMinutes,
  formatDurationFromHours,
  formatDurationMinutes,
  minutesToDecimalHours,
  resolveSegmentDurationHours,
  resolveSegmentDurationMinutes
} from "./durationFormat";
import {
  calculateDaylightSummary,
  getHourStatusForLocation,
  getTravelerStatusAtHour
} from "./timezoneMath";
import { getItineraryIssue } from "./itineraryDisplay";
import {
  getLastArrivalTripHour,
  getLayoverDurationHours,
  getNetTimezoneShiftHours,
  getSegmentArrivalTripHour,
  getTimelineHorizon,
  getTotalFlightDurationHours
} from "./timelineHorizon";

const findLocation = (itinerary: Itinerary, code: string): LocationConfig => {
  const location = itinerary.locations.find((item) => item.code === code);

  if (!location) {
    assert.fail(`Expected ${itinerary.id} to include ${code}.`);
  }

  return location;
};

const findItinerary = (id: string): Itinerary => {
  const itinerary = travelPresets.find((item) => item.id === id);

  if (!itinerary) {
    assert.fail(`Expected travel presets to include ${id}.`);
  }

  return itinerary;
};

test("calculates total elapsed trip duration for a multi-leg overnight itinerary", function calculatesTotalElapsedTripDuration() {
  assert.equal(getLastArrivalTripHour(multiLegOvernightTripFixture.segments), 18);
  assert.deepEqual(getTimelineHorizon(multiLegOvernightTripFixture), {
    lastArrivalTripHour: 18,
    maxTripHour: 26,
    postArrivalHours: 8
  });
});

test("keeps flight duration separate from elapsed trip and layover time", function calculatesFlightAndLayoverDurations() {
  const [mspToYul, yulToAth] = multiLegOvernightTripFixture.segments;

  assert.equal(mspToYul.duration, 3);
  assert.equal(yulToAth.duration, 8);
  assert.equal(getSegmentArrivalTripHour(mspToYul), 3);
  assert.equal(getLayoverDurationHours(mspToYul, yulToAth), 7);
  assert.equal(getTotalFlightDurationHours(multiLegOvernightTripFixture.segments), 11);
  assert.equal(getLastArrivalTripHour(multiLegOvernightTripFixture.segments), 18);
});

test("formats duration minutes without exposing decimal hours", function formatsDurationMinutes() {
  assert.equal(formatDurationMinutes(886), "14h 46m");
  assert.equal(formatDurationMinutes(245), "4h 05m");
  assert.equal(formatDurationMinutes(35), "35m");
  assert.equal(formatDurationMinutes(360), "6h");
});

test("handles zero-minute duration conversions", function handlesZeroMinuteDurationConversions() {
  assert.equal(decimalHoursToMinutes(0), 0);
  assert.equal(minutesToDecimalHours(0), 0);
  assert.equal(formatDurationMinutes(0), "0m");
  assert.equal(formatDurationFromHours(0), "0m");
});

test("prefers API duration minutes and converts to timeline hours", function prefersApiDurationMinutes() {
  const segment = {
    ...simpleNonstopTripFixture.segments[0],
    duration: 4.68,
    durationMinutes: 281
  };

  assert.equal(resolveSegmentDurationMinutes(segment), 281);
  assert.equal(resolveSegmentDurationHours(segment), 281 / 60);
});

test("falls back to decimal-hour duration when duration minutes are absent", function fallsBackToDecimalHourDuration() {
  const segment = {
    ...simpleNonstopTripFixture.segments[0],
    duration: 4.68,
    durationMinutes: undefined
  };

  assert.equal(resolveSegmentDurationMinutes(segment), 281);
  assert.equal(resolveSegmentDurationHours(segment), 281 / 60);
});

test("identifies layover status at the connecting airport", function identifiesLayoverStatus() {
  const layoverStatus = getTravelerStatusAtHour(multiLegOvernightTripFixture, 5);
  const secondFlightStatus = getTravelerStatusAtHour(multiLegOvernightTripFixture, 10);

  assert.equal(layoverStatus.type, "layover");
  assert.equal(layoverStatus.currentLocation?.code, "YUL");
  assert.equal(layoverStatus.flightSegment, null);
  assert.equal(secondFlightStatus.type, "flight");
  assert.equal(secondFlightStatus.flightSegment?.flightNumber, "AC1902");
});

test("converts local time across origin and destination timezones", function convertsLocalTimes() {
  const jfk = findLocation(simpleNonstopTripFixture, "JFK");
  const lhr = findLocation(simpleNonstopTripFixture, "LHR");
  const departureStatus = getHourStatusForLocation(simpleNonstopTripFixture, jfk, 2);
  const arrivalStatus = getHourStatusForLocation(simpleNonstopTripFixture, lhr, 9);

  assert.equal(departureStatus.formattedTime, "8 PM");
  assert.equal(departureStatus.dayName, "Friday");
  assert.equal(departureStatus.dayOffset, 0);
  assert.equal(departureStatus.timePeriod, "twilight");

  assert.equal(arrivalStatus.formattedTime, "8 AM");
  assert.equal(arrivalStatus.dayName, "Saturday");
  assert.equal(arrivalStatus.dayOffset, 1);
  assert.equal(arrivalStatus.timePeriod, "day");
});

test("calculates net timezone shift from origin to final destination", function calculatesNetTimezoneShift() {
  assert.equal(getNetTimezoneShiftHours(simpleNonstopTripFixture), 5);
  assert.equal(getNetTimezoneShiftHours(multiLegOvernightTripFixture), 8);
});

test("summarizes day, twilight, and night segments over the visible trip", function summarizesDayNightSegments() {
  const arrivalTripHour = getLastArrivalTripHour(simpleNonstopTripFixture.segments);
  const summary = calculateDaylightSummary(simpleNonstopTripFixture, arrivalTripHour);

  assert.deepEqual(summary, {
    daylightHours: 2,
    twilightHours: 3,
    nightHours: 5
  });
});

test("handles next-day and multi-day arrivals", function handlesOvernightAndMultiDayArrivals() {
  const lhr = findLocation(simpleNonstopTripFixture, "LHR");
  const simpleArrival = getHourStatusForLocation(simpleNonstopTripFixture, lhr, 9);
  const sydneyOutbound = findItinerary("sydney-flight-2026-outbound");
  const syd = findLocation(sydneyOutbound, "SYD");
  const sydneyArrival = getHourStatusForLocation(
    sydneyOutbound,
    syd,
    getLastArrivalTripHour(sydneyOutbound.segments)
  );

  assert.equal(simpleArrival.dayOffset, 1);
  assert.equal(simpleArrival.dayName, "Saturday");

  assert.equal(sydneyArrival.dayOffset, 2);
  assert.equal(sydneyArrival.dayName, "Wednesday");
  assert.equal(sydneyArrival.formattedTime, "6 AM");
});

test("summarizes multi-leg API durations in exact minutes", function summarizesMultiLegApiDurations() {
  const sydneyOutbound = findItinerary("sydney-flight-2026-outbound");
  const [mspToLax, laxToSyd] = sydneyOutbound.segments;

  assert.equal(formatDurationMinutes(resolveSegmentDurationMinutes(mspToLax)), "3h 57m");
  assert.equal(formatDurationMinutes(resolveSegmentDurationMinutes(laxToSyd)), "14h 55m");
  assert.equal(formatDurationFromHours(getTotalFlightDurationHours(sydneyOutbound.segments)), "18h 52m");
  assert.equal(formatDurationFromHours(getLayoverDurationHours(mspToLax, laxToSyd)), "2h");
});

test("returns safe fallback values for empty itinerary data", function handlesEmptyItineraryData() {
  const emptyItinerary: Itinerary = {
    id: "empty",
    name: "",
    description: "",
    startHourLocal: Number.NaN,
    startDayName: "",
    locations: [],
    segments: [],
    sleepPreferences: {
      targetBedtime: 22,
      targetWakeTime: 6,
      preAdjust: false
    }
  };

  assert.equal(getItineraryIssue(emptyItinerary), "Add at least one airport to build the timeline.");
  assert.deepEqual(getTimelineHorizon(emptyItinerary), {
    lastArrivalTripHour: 0,
    maxTripHour: 24,
    postArrivalHours: 0
  });
  assert.deepEqual(getTravelerStatusAtHour(emptyItinerary, Number.NaN), {
    type: "origin",
    currentLocation: null,
    flightSegment: null,
    tripHour: 0
  });
  assert.equal(getHourStatusForLocation(emptyItinerary, undefined, Number.NaN).formattedTime, "Time unavailable");
});

test("ignores internally inconsistent segments when calculating the timeline", function ignoresInvalidSegments() {
  const invalidItinerary: Itinerary = {
    ...simpleNonstopTripFixture,
    id: "invalid-segments",
    segments: [
      {
        ...simpleNonstopTripFixture.segments[0],
        id: "bad-duration",
        duration: Number.NaN,
        durationMinutes: undefined
      },
      {
        ...simpleNonstopTripFixture.segments[0],
        id: "bad-route",
        fromLocationId: "missing-origin"
      }
    ]
  };

  assert.equal(getItineraryIssue(invalidItinerary), "Flight segments need valid route airports and duration.");
  assert.deepEqual(getTimelineHorizon(invalidItinerary), {
    lastArrivalTripHour: 0,
    maxTripHour: 24,
    postArrivalHours: 0
  });
});
