import type { Itinerary, LocationConfig } from "../types";

export const DEFAULT_ITINERARY_START_DATE = "2026-01-01";

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_MINUTE = 60 * 1000;
const MINUTES_PER_DAY = 24 * 60;
const TIME_ZONE_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

export interface LocalDateParts {
  date: string;
  day: number;
  month: number;
  year: number;
}

export interface LocalDateTimeParts extends LocalDateParts {
  dayOffset: number;
  formattedDate: string;
  formattedTime: string;
  hour: number;
  minute: number;
  minuteOfDay: number;
  tripHour: number;
  utcMillis: number;
  weekday: string;
}

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};

export const parseIsoDate = (value: unknown): LocalDateParts | null => {
  if (typeof value !== "string") {
    return null;
  }

  const match = ISO_DATE_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    date: toIsoDate(year, month, day),
    day,
    month,
    year
  };
};

export const isIsoDateString = (value: unknown): value is string => {
  return parseIsoDate(value) !== null;
};

export const toIsoDate = (year: number, month: number, day: number) => {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

export const getDayNameForIsoDate = (dateValue: unknown) => {
  const parsedDate = parseIsoDate(dateValue);
  if (!parsedDate) {
    return null;
  }

  const date = new Date(Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day));
  return DAYS_OF_WEEK[date.getUTCDay()] ?? null;
};

export const getOffsetDayName = (startDay: string, dayOffset: number): string => {
  const startIndex = DAYS_OF_WEEK.indexOf(startDay);
  if (startIndex === -1 || !Number.isFinite(dayOffset)) return startDay || "Day unavailable";
  const targetIndex = (startIndex + dayOffset + 7000) % 7;
  return DAYS_OF_WEEK[targetIndex] ?? startDay;
};

export const getDateDifferenceDays = (startDateValue: unknown, endDateValue: unknown) => {
  const startDate = parseIsoDate(startDateValue);
  const endDate = parseIsoDate(endDateValue);

  if (!startDate || !endDate) {
    return 0;
  }

  const startUtc = Date.UTC(startDate.year, startDate.month - 1, startDate.day);
  const endUtc = Date.UTC(endDate.year, endDate.month - 1, endDate.day);
  return Math.round((endUtc - startUtc) / (MINUTES_PER_DAY * MS_PER_MINUTE));
};

export const formatLocalTime = (hour: number, minute = 0) => {
  if (!isFiniteNumber(hour) || !isFiniteNumber(minute)) {
    return "Time unavailable";
  }

  const normalizedHour = ((Math.trunc(hour) % 24) + 24) % 24;
  const normalizedMinute = ((Math.round(minute) % 60) + 60) % 60;
  const meridiem = normalizedHour >= 12 ? "PM" : "AM";
  const hour12 = normalizedHour % 12 === 0 ? 12 : normalizedHour % 12;

  if (normalizedMinute === 0) {
    return `${hour12} ${meridiem}`;
  }

  return `${hour12}:${String(normalizedMinute).padStart(2, "0")} ${meridiem}`;
};

export const formatLocalDate = (dateValue: unknown) => {
  const parsedDate = parseIsoDate(dateValue);
  if (!parsedDate) {
    return "Date unavailable";
  }

  const date = new Date(Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day));
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
};

const getScheduleStartDate = (itinerary: Itinerary | null | undefined) => {
  const scheduleDate = itinerary?.segments
    .map((segment) => segment.schedule?.departure?.localDateTime?.slice(0, 10))
    .find(isIsoDateString);

  return scheduleDate ?? null;
};

export const getItineraryStartDate = (itinerary: Itinerary | null | undefined) => {
  if (isIsoDateString(itinerary?.startDate)) {
    return itinerary.startDate;
  }

  return getScheduleStartDate(itinerary) ?? DEFAULT_ITINERARY_START_DATE;
};

export const getItineraryStartDayName = (itinerary: Itinerary | null | undefined) => {
  const dateDayName = getDayNameForIsoDate(getItineraryStartDate(itinerary));
  return dateDayName ?? itinerary?.startDayName ?? "Day unavailable";
};

export const getLocationTimeZone = (location: LocationConfig | null | undefined) => {
  const timezone = location?.timezoneIana?.trim();
  if (!timezone) {
    return null;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date(0));
    return timezone;
  } catch {
    return null;
  }
};

const getOffsetMinutesForLocation = (location: LocationConfig | null | undefined) => {
  return isFiniteNumber(location?.offset) ? Math.round(location.offset * 60) : 0;
};

const getDateTimeFormatter = (timeZone: string) => {
  const cachedFormatter = TIME_ZONE_FORMATTERS.get(timeZone);
  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone,
    weekday: "long",
    year: "numeric"
  });
  TIME_ZONE_FORMATTERS.set(timeZone, formatter);
  return formatter;
};

const getPartsRecord = (formatter: Intl.DateTimeFormat, date: Date) => {
  return Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
};

export const getTimeZoneOffsetMinutes = (timeZone: string, utcMillis: number) => {
  const parts = getPartsRecord(getDateTimeFormatter(timeZone), new Date(utcMillis));
  const asUtcMillis = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute)
  );

  return Math.round((asUtcMillis - utcMillis) / MS_PER_MINUTE);
};

const getLocalWallClockMillis = (dateValue: string, localHour: number) => {
  const parsedDate = parseIsoDate(dateValue) ?? parseIsoDate(DEFAULT_ITINERARY_START_DATE)!;
  const localMinutes = isFiniteNumber(localHour) ? Math.round(localHour * 60) : 0;
  return Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day) + localMinutes * MS_PER_MINUTE;
};

export const localDateTimeToUtcMillis = (
  dateValue: string,
  localHour: number,
  location: LocationConfig | null | undefined
) => {
  const wallClockMillis = getLocalWallClockMillis(dateValue, localHour);
  const timeZone = getLocationTimeZone(location);

  if (!timeZone) {
    return wallClockMillis - getOffsetMinutesForLocation(location) * MS_PER_MINUTE;
  }

  let utcMillis = wallClockMillis - getTimeZoneOffsetMinutes(timeZone, wallClockMillis) * MS_PER_MINUTE;
  utcMillis = wallClockMillis - getTimeZoneOffsetMinutes(timeZone, utcMillis) * MS_PER_MINUTE;
  return utcMillis;
};

export const getLocalDateTimePartsForLocation = (
  location: LocationConfig | null | undefined,
  utcMillis: number,
  tripHour = 0,
  startDateValue = DEFAULT_ITINERARY_START_DATE
): LocalDateTimeParts => {
  const timeZone = getLocationTimeZone(location);
  let year: number;
  let month: number;
  let day: number;
  let hour: number;
  let minute: number;
  let weekday: string;

  if (timeZone) {
    const parts = getPartsRecord(getDateTimeFormatter(timeZone), new Date(utcMillis));
    year = Number(parts.year);
    month = Number(parts.month);
    day = Number(parts.day);
    hour = Number(parts.hour);
    minute = Number(parts.minute);
    weekday = parts.weekday ?? "Day unavailable";
  } else {
    const localDate = new Date(utcMillis + getOffsetMinutesForLocation(location) * MS_PER_MINUTE);
    year = localDate.getUTCFullYear();
    month = localDate.getUTCMonth() + 1;
    day = localDate.getUTCDate();
    hour = localDate.getUTCHours();
    minute = localDate.getUTCMinutes();
    weekday = DAYS_OF_WEEK[localDate.getUTCDay()] ?? "Day unavailable";
  }

  const date = toIsoDate(year, month, day);

  return {
    date,
    day,
    dayOffset: getDateDifferenceDays(startDateValue, date),
    formattedDate: formatLocalDate(date),
    formattedTime: formatLocalTime(hour, minute),
    hour,
    minute,
    minuteOfDay: hour * 60 + minute,
    month,
    tripHour,
    utcMillis,
    weekday,
    year
  };
};

export const getTripStartUtcMillis = (itinerary: Itinerary) => {
  return localDateTimeToUtcMillis(
    getItineraryStartDate(itinerary),
    isFiniteNumber(itinerary.startHourLocal) ? itinerary.startHourLocal : 0,
    itinerary.locations[0]
  );
};

export const getTripUtcMillis = (itinerary: Itinerary, tripHour: number) => {
  const safeTripHour = isFiniteNumber(tripHour) ? Math.max(0, tripHour) : 0;
  return getTripStartUtcMillis(itinerary) + Math.round(safeTripHour * 60) * MS_PER_MINUTE;
};

export const getLocalTimelineDateTime = (
  itinerary: Itinerary,
  location: LocationConfig | null | undefined,
  tripHour: number
) => {
  const safeTripHour = isFiniteNumber(tripHour) ? Math.max(0, tripHour) : 0;
  return getLocalDateTimePartsForLocation(
    location,
    getTripUtcMillis(itinerary, safeTripHour),
    safeTripHour,
    getItineraryStartDate(itinerary)
  );
};
