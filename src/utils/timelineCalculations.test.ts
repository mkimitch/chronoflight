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
import { getItineraryStartDate } from "./itineraryTime";
import {
  calculateDaylightSummary,
  getHourStatusForLocation,
  getTravelerStatusAtHour
} from "./timezoneMath";
import { getSolarWindowForLocationDate } from "./solarPeriods";
import { getItineraryIssue } from "./itineraryDisplay";
import {
  getLastArrivalTripHour,
  getLayoverDurationHours,
  getNetTimezoneShiftHours,
  getSegmentArrivalTripHour,
  getTimelineHorizon,
  getTimelinePreferences,
  getTotalFlightDurationHours
} from "./timelineHorizon";
import { getTripSummaryMetrics } from "./tripSummary";
import {
  getTimelineAxisColumns,
  getTimelineOffsetPercent,
  getTimelinePositionPixels,
  snapTimelineStart
} from "./timelineAxis";
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
test("snaps timeline axes to clean intervals without changing event placement", function snapsTimelineAxesToCleanIntervals() {
  const axisStart = snapTimelineStart(new Date(Date.UTC(2026, 6, 6, 18, 58)), 60);
  const axisEnd = new Date(Date.UTC(2026, 6, 6, 19, 0));
  const eventTime = new Date(Date.UTC(2026, 6, 6, 18, 58));

  assert.equal(axisStart.toISOString(), "2026-07-06T18:00:00.000Z");
  assert.equal(Math.round(getTimelineOffsetPercent({ axisStart, axisEnd, eventTime }) * 10) / 10, 96.7);
  assert.equal(snapTimelineStart(new Date(Date.UTC(2026, 6, 29, 9, 45)), 30).toISOString(), "2026-07-29T09:30:00.000Z");
});

test("generates clean Sydney timeline axis labels with proportional trip-hour positions", function generatesCleanSydneyTimelineAxisLabels() {
  const outbound = getTimelineAxisColumns({
    maxTripHour: 3,
    startHourLocal: 18 + 58 / 60
  });
  const returnTrip = getTimelineAxisColumns({
    maxTripHour: 3,
    startHourLocal: 9 + 15 / 60
  });

  assert.deepEqual(outbound.columns.slice(0, 3).map((column) => column.label), ["6 PM", "7 PM", "8 PM"]);
  assert.equal(Math.round(outbound.axisStartTripHour * 60), -58);
  assert.equal(getTimelinePositionPixels({ axis: outbound, cellWidth: 60, labelColumnWidth: 140, tripHour: 0 }), 198);

  assert.deepEqual(returnTrip.columns.slice(0, 3).map((column) => column.label), ["9 AM", "10 AM", "11 AM"]);
  assert.equal(Math.round(returnTrip.axisStartTripHour * 60), -15);
  assert.equal(getTimelinePositionPixels({ axis: returnTrip, cellWidth: 60, labelColumnWidth: 140, tripHour: 0 }), 155);
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
  assert.equal(departureStatus.localDate, "2026-07-17");
  assert.equal(departureStatus.timePeriod, "day");
  assert.equal(departureStatus.timePeriodSource, "solar");

  assert.equal(arrivalStatus.formattedTime, "8 AM");
  assert.equal(arrivalStatus.dayName, "Saturday");
  assert.equal(arrivalStatus.dayOffset, 1);
  assert.equal(arrivalStatus.localDate, "2026-07-18");
  assert.equal(arrivalStatus.timePeriod, "day");
  assert.equal(arrivalStatus.timePeriodSource, "solar");
});

test("anchors local dates to the selected trip start date", function anchorsLocalDatesToSelectedStartDate() {
  const anchoredItinerary: Itinerary = {
    ...simpleNonstopTripFixture,
    startDate: "2026-07-17",
    startDayName: "Monday"
  };
  const jfk = findLocation(anchoredItinerary, "JFK");
  const startStatus = getHourStatusForLocation(anchoredItinerary, jfk, 0);

  assert.equal(getItineraryStartDate(anchoredItinerary), "2026-07-17");
  assert.equal(startStatus.dayName, "Friday");
  assert.equal(startStatus.localDate, "2026-07-17");
});

test("defaults timeline display preference to normal", function defaultsTimelineDisplayPreference() {
  assert.equal(getTimelinePreferences(simpleNonstopTripFixture).displayMode, "normal");
});

test("preserves the night-only timeline display preference", function preservesNightOnlyTimelineDisplayPreference() {
  const nightOnlyItinerary: Itinerary = {
    ...simpleNonstopTripFixture,
    timelinePreferences: {
      displayMode: "night-only",
      postArrivalMode: "custom",
      postArrivalHours: 4
    }
  };

  assert.deepEqual(getTimelinePreferences(nightOnlyItinerary), {
    displayMode: "night-only",
    postArrivalMode: "custom",
    postArrivalHours: 4
  });
});

test("calculates net timezone shift from origin to final destination", function calculatesNetTimezoneShift() {
  assert.equal(getNetTimezoneShiftHours(simpleNonstopTripFixture), 5);
  assert.equal(getNetTimezoneShiftHours(multiLegOvernightTripFixture), 8);
});

test("summarizes day, twilight, and night segments over the visible trip", function summarizesDayNightSegments() {
  const arrivalTripHour = getLastArrivalTripHour(simpleNonstopTripFixture.segments);
  const summary = calculateDaylightSummary(simpleNonstopTripFixture, arrivalTripHour);

  assert.deepEqual(summary, {
    daylightHours: 5,
    twilightHours: 1,
    nightHours: 4
  });
});

test("falls back to static daylight periods when coordinates are unavailable", function fallsBackWhenSolarDataIsUnavailable() {
  const jfk = findLocation(simpleNonstopTripFixture, "JFK");
  const locationWithoutCoordinates: LocationConfig = {
    ...jfk,
    coordinates: undefined,
    latitude: undefined,
    longitude: undefined
  };
  const itineraryWithoutCoordinates: Itinerary = {
    ...simpleNonstopTripFixture,
    locations: [locationWithoutCoordinates, simpleNonstopTripFixture.locations[1]]
  };
  const status = getHourStatusForLocation(itineraryWithoutCoordinates, locationWithoutCoordinates, 0);

  assert.equal(status.localDate, "2026-07-17");
  assert.equal(status.timePeriod, "twilight");
  assert.equal(status.timePeriodSource, "fallback");
});
test("keeps Sydney solar events on the selected local day", function keepsSydneySolarEventsOnLocalDay() {
  const sydneyOutbound = findItinerary("sydney-flight-2026-outbound");
  const syd = findLocation(sydneyOutbound, "SYD");
  const window = getSolarWindowForLocationDate(syd, "2026-07-09");

  assert.equal(window.source, "solar");
  assert.ok(
    window.sunriseMinutes !== null && window.sunriseMinutes >= 360 && window.sunriseMinutes < 480,
    `Expected Sydney sunrise inside the local morning, got ${window.sunriseMinutes}.`
  );
  assert.ok(
    window.sunsetMinutes !== null && window.sunsetMinutes >= 960 && window.sunsetMinutes < 1080,
    `Expected Sydney sunset inside the local evening, got ${window.sunsetMinutes}.`
  );
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
  assert.equal(sydneyArrival.dayName, "Thursday");
  assert.equal(sydneyArrival.localDate, "2026-07-09");
  assert.equal(sydneyArrival.formattedTime, "7:05 AM");
  assert.equal(sydneyArrival.timePeriod, "day");
  assert.equal(sydneyArrival.timePeriodSource, "solar");
});

test("summarizes multi-leg API durations in exact minutes", function summarizesMultiLegApiDurations() {
  const sydneyOutbound = findItinerary("sydney-flight-2026-outbound");
  const [mspToLax, laxToSyd] = sydneyOutbound.segments;

  assert.equal(formatDurationMinutes(resolveSegmentDurationMinutes(mspToLax)), "3h 40m");
  assert.equal(formatDurationMinutes(resolveSegmentDurationMinutes(laxToSyd)), "15h 05m");
  assert.equal(formatDurationFromHours(getTotalFlightDurationHours(sydneyOutbound.segments)), "18h 45m");
  assert.equal(formatDurationFromHours(getLayoverDurationHours(mspToLax, laxToSyd)), "12h 38m");
});

test("summarizes simple nonstop trip metrics", function summarizesSimpleNonstopTripMetrics() {
  assert.deepEqual(getTripSummaryMetrics(simpleNonstopTripFixture), {
    daylightHours: 5,
    elapsedHours: 9,
    flightHours: 7,
    groundHours: 2,
    layoverCount: 0,
    netTimezoneShiftHours: 5,
    nightHours: 4
  });
});

test("summarizes multi-leg trip metrics with layover time", function summarizesMultiLegTripMetrics() {
  assert.deepEqual(getTripSummaryMetrics(multiLegOvernightTripFixture), {
    daylightHours: 14,
    elapsedHours: 18,
    flightHours: 11,
    groundHours: 7,
    layoverCount: 1,
    netTimezoneShiftHours: 8,
    nightHours: 4
  });
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

  assert.deepEqual(getTripSummaryMetrics(emptyItinerary), {
    daylightHours: 0,
    elapsedHours: 0,
    flightHours: 0,
    groundHours: 0,
    layoverCount: 0,
    netTimezoneShiftHours: 0,
    nightHours: 0
  });
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
