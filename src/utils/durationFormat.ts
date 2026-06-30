import type { FlightSegment } from "../types";

const MINUTES_PER_HOUR = 60;

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};

export const decimalHoursToMinutes = (hours: unknown) => {
  if (!isFiniteNumber(hours)) {
    return 0;
  }

  return Math.max(0, Math.round(hours * MINUTES_PER_HOUR));
};

export const minutesToDecimalHours = (minutes: unknown) => {
  if (!isFiniteNumber(minutes)) {
    return 0;
  }

  return Math.max(0, minutes) / MINUTES_PER_HOUR;
};

export const formatDurationMinutes = (minutes: unknown) => {
  const totalMinutes = isFiniteNumber(minutes)
    ? Math.max(0, Math.round(minutes))
    : 0;
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const remainingMinutes = totalMinutes % MINUTES_PER_HOUR;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${String(remainingMinutes).padStart(2, "0")}m`;
};

export const formatDurationFromHours = (hours: unknown) => {
  return formatDurationMinutes(decimalHoursToMinutes(hours));
};

export const resolveSegmentDurationMinutes = (segment: FlightSegment | null | undefined) => {
  if (isFiniteNumber(segment?.durationMinutes)) {
    return Math.max(0, Math.round(segment.durationMinutes));
  }

  return decimalHoursToMinutes(segment?.duration);
};

export const resolveSegmentDurationHours = (segment: FlightSegment | null | undefined) => {
  return minutesToDecimalHours(resolveSegmentDurationMinutes(segment));
};
