import type { LocationConfig } from "../types";
import {
  formatLocalTime,
  getDateDifferenceDays,
  getLocalDateTimePartsForLocation,
  isIsoDateString,
  parseIsoDate
} from "./itineraryTime";

export type TimelineTimePeriod = "day" | "twilight" | "night";
export type TimelineTimePeriodSource = "solar" | "fallback";

export interface SolarWindow {
  message: string;
  source: TimelineTimePeriodSource;
  sunriseMinutes: number | null;
  sunsetMinutes: number | null;
}

export interface TimePeriodResult {
  source: TimelineTimePeriodSource;
  timePeriod: TimelineTimePeriod;
  window: SolarWindow;
}

const SUNRISE_SUNSET_ZENITH = 90.833;
const TWILIGHT_BUFFER_MINUTES = 45;
const MINUTES_PER_DAY = 24 * 60;
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const solarWindowCache = new Map<string, SolarWindow>();

const normalizeDegrees = (degrees: number) => ((degrees % 360) + 360) % 360;
const normalizeHours = (hours: number) => ((hours % 24) + 24) % 24;

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};

const getCoordinates = (location: LocationConfig | null | undefined) => {
  const latitude = location?.coordinates?.latitude ?? location?.latitude;
  const longitude = location?.coordinates?.longitude ?? location?.longitude;

  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) {
    return null;
  }

  return { latitude, longitude };
};

const getDayOfYear = (year: number, month: number, day: number) => {
  const start = Date.UTC(year, 0, 0);
  const current = Date.UTC(year, month - 1, day);
  return Math.floor((current - start) / (24 * 60 * 60 * 1000));
};

const calculateSunEventUtcMillis = (
  localDate: string,
  latitude: number,
  longitude: number,
  isSunrise: boolean
) => {
  const parsedDate = parseIsoDate(localDate);
  if (!parsedDate) {
    return null;
  }

  const dayOfYear = getDayOfYear(parsedDate.year, parsedDate.month, parsedDate.day);
  const longitudeHour = longitude / 15;
  const approximateTime = dayOfYear + ((isSunrise ? 6 : 18) - longitudeHour) / 24;
  const meanAnomaly = (0.9856 * approximateTime) - 3.289;
  const trueLongitude = normalizeDegrees(
    meanAnomaly
      + 1.916 * Math.sin(meanAnomaly * RAD)
      + 0.020 * Math.sin(2 * meanAnomaly * RAD)
      + 282.634
  );

  let rightAscension = normalizeDegrees(Math.atan(0.91764 * Math.tan(trueLongitude * RAD)) * DEG);
  const longitudeQuadrant = Math.floor(trueLongitude / 90) * 90;
  const ascensionQuadrant = Math.floor(rightAscension / 90) * 90;
  rightAscension = (rightAscension + longitudeQuadrant - ascensionQuadrant) / 15;

  const sinDeclination = 0.39782 * Math.sin(trueLongitude * RAD);
  const cosDeclination = Math.cos(Math.asin(sinDeclination));
  const cosHourAngle = (
    Math.cos(SUNRISE_SUNSET_ZENITH * RAD)
    - sinDeclination * Math.sin(latitude * RAD)
  ) / (cosDeclination * Math.cos(latitude * RAD));

  if (cosHourAngle > 1 || cosHourAngle < -1) {
    return null;
  }

  const hourAngle = isSunrise
    ? (360 - Math.acos(cosHourAngle) * DEG) / 15
    : (Math.acos(cosHourAngle) * DEG) / 15;
  const localMeanTime = hourAngle + rightAscension - (0.06571 * approximateTime) - 6.622;
  const utcHour = normalizeHours(localMeanTime - longitudeHour);

  return Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day)
    + Math.round(utcHour * 60) * 60 * 1000;
};

const getRelativeLocalMinute = (
  location: LocationConfig,
  localDate: string,
  utcMillis: number
) => {
  const parts = getLocalDateTimePartsForLocation(location, utcMillis, 0, localDate);
  return parts.minuteOfDay + getDateDifferenceDays(localDate, parts.date) * MINUTES_PER_DAY;
};

const getFallbackWindow = (message: string): SolarWindow => ({
  message,
  source: "fallback",
  sunriseMinutes: null,
  sunsetMinutes: null
});

export const getSolarWindowForLocationDate = (
  location: LocationConfig | null | undefined,
  localDate: string
): SolarWindow => {
  const coordinates = getCoordinates(location);

  if (!isIsoDateString(localDate)) {
    return getFallbackWindow("Solar data unavailable; invalid local date.");
  }

  if (!location || !coordinates) {
    return getFallbackWindow("Solar data unavailable; using fallback daylight cycle.");
  }

  const cacheKey = [
    location.id,
    localDate,
    coordinates.latitude.toFixed(4),
    coordinates.longitude.toFixed(4),
    location.timezoneIana ?? location.offset
  ].join("|");
  const cachedWindow = solarWindowCache.get(cacheKey);
  if (cachedWindow) {
    return cachedWindow;
  }

  const sunriseUtcMillis = calculateSunEventUtcMillis(
    localDate,
    coordinates.latitude,
    coordinates.longitude,
    true
  );
  const sunsetUtcMillis = calculateSunEventUtcMillis(
    localDate,
    coordinates.latitude,
    coordinates.longitude,
    false
  );

  if (sunriseUtcMillis === null || sunsetUtcMillis === null) {
    return getFallbackWindow("Solar data unavailable; using fallback daylight cycle.");
  }

  const sunriseMinutes = getRelativeLocalMinute(location, localDate, sunriseUtcMillis);
  const sunsetMinutes = getRelativeLocalMinute(location, localDate, sunsetUtcMillis);
  const window: SolarWindow = {
    message: `Sunrise ${formatLocalTime(Math.floor(sunriseMinutes / 60), sunriseMinutes % 60)}, sunset ${formatLocalTime(Math.floor(sunsetMinutes / 60), sunsetMinutes % 60)}.`,
    source: "solar",
    sunriseMinutes,
    sunsetMinutes
  };

  solarWindowCache.set(cacheKey, window);
  return window;
};

const getFallbackPeriod = (localMinuteOfDay: number): TimelineTimePeriod => {
  const localHour = Math.floor(localMinuteOfDay / 60);

  if (localHour >= 6 && localHour < 18) {
    return "day";
  }

  if (localHour >= 18 && localHour < 21) {
    return "twilight";
  }

  return "night";
};

export const getTimePeriodForLocationDateTime = (
  location: LocationConfig | null | undefined,
  localDate: string,
  localMinuteOfDay: number
): TimePeriodResult => {
  const window = getSolarWindowForLocationDate(location, localDate);
  const safeMinute = isFiniteNumber(localMinuteOfDay) ? localMinuteOfDay : 0;

  if (window.source === "solar" && window.sunriseMinutes !== null && window.sunsetMinutes !== null) {
    const relativeMinute = safeMinute;
    const sunriseStart = window.sunriseMinutes - TWILIGHT_BUFFER_MINUTES;
    const sunsetEnd = window.sunsetMinutes + TWILIGHT_BUFFER_MINUTES;

    if (relativeMinute >= window.sunriseMinutes && relativeMinute < window.sunsetMinutes) {
      return { source: "solar", timePeriod: "day", window };
    }

    if (
      (relativeMinute >= sunriseStart && relativeMinute < window.sunriseMinutes)
      || (relativeMinute >= window.sunsetMinutes && relativeMinute < sunsetEnd)
    ) {
      return { source: "solar", timePeriod: "twilight", window };
    }

    return { source: "solar", timePeriod: "night", window };
  }

  return {
    source: "fallback",
    timePeriod: getFallbackPeriod(((safeMinute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY),
    window
  };
};
