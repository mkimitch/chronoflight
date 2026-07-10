import { getSafeNumber } from "./itineraryDisplay";
import { formatLocalTime } from "./itineraryTime";

const MINUTES_PER_HOUR = 60;
const MS_PER_MINUTE = 60 * 1000;
const DEFAULT_INTERVAL_MINUTES = 60;

export interface TimelineAxisColumn {
  axisTripHour: number;
  index: number;
  label: string;
}

export interface TimelineAxis {
  axisStartTripHour: number;
  columns: TimelineAxisColumn[];
  intervalHours: number;
  intervalMinutes: number;
}

export interface TimelineAxisOptions {
  intervalMinutes?: number;
  maxTripHour: number;
  startHourLocal: number;
}

const getIntervalMinutes = (intervalMinutes = DEFAULT_INTERVAL_MINUTES) => {
  const safeIntervalMinutes = Math.round(getSafeNumber(intervalMinutes, DEFAULT_INTERVAL_MINUTES));

  return safeIntervalMinutes > 0 ? safeIntervalMinutes : DEFAULT_INTERVAL_MINUTES;
};

const getHourAndMinute = (hourValue: number) => {
  const totalMinutes = Math.round(hourValue * MINUTES_PER_HOUR);
  const normalizedMinutes = ((totalMinutes % (24 * MINUTES_PER_HOUR)) + (24 * MINUTES_PER_HOUR)) % (24 * MINUTES_PER_HOUR);

  return {
    hour: Math.floor(normalizedMinutes / MINUTES_PER_HOUR),
    minute: normalizedMinutes % MINUTES_PER_HOUR
  };
};

export const snapTimelineStart = (date: Date, intervalMinutes = DEFAULT_INTERVAL_MINUTES): Date => {
  const time = date.getTime();
  if (!Number.isFinite(time)) {
    return new Date(Number.NaN);
  }

  const intervalMs = getIntervalMinutes(intervalMinutes) * MS_PER_MINUTE;
  return new Date(Math.floor(time / intervalMs) * intervalMs);
};

export const getTimelineOffsetPercent = ({
  axisEnd,
  axisStart,
  eventTime
}: {
  axisEnd: Date;
  axisStart: Date;
  eventTime: Date;
}) => {
  const duration = axisEnd.getTime() - axisStart.getTime();

  if (!Number.isFinite(duration) || duration <= 0) {
    return 0;
  }

  const percent = ((eventTime.getTime() - axisStart.getTime()) / duration) * 100;
  return Math.min(100, Math.max(0, percent));
};

export const getSnappedTimelineAxisStartTripHour = (
  startHourLocal: number,
  intervalMinutes = DEFAULT_INTERVAL_MINUTES
) => {
  const interval = getIntervalMinutes(intervalMinutes);
  const startMinutes = Math.round(getSafeNumber(startHourLocal) * MINUTES_PER_HOUR);
  const snappedStartMinutes = Math.floor(startMinutes / interval) * interval;

  return (snappedStartMinutes - startMinutes) / MINUTES_PER_HOUR;
};

export const formatTimelineAxisLabel = (localHourValue: number) => {
  const { hour, minute } = getHourAndMinute(localHourValue);
  return formatLocalTime(hour, minute);
};

export const getTimelineAxisColumns = ({
  intervalMinutes = DEFAULT_INTERVAL_MINUTES,
  maxTripHour,
  startHourLocal
}: TimelineAxisOptions): TimelineAxis => {
  const interval = getIntervalMinutes(intervalMinutes);
  const intervalHours = interval / MINUTES_PER_HOUR;
  const axisStartTripHour = getSnappedTimelineAxisStartTripHour(startHourLocal, interval);
  const safeMaxTripHour = Math.max(0, getSafeNumber(maxTripHour));
  const columnCount = Math.max(1, Math.ceil((safeMaxTripHour - axisStartTripHour) / intervalHours) + 1);
  const columns = Array.from({ length: columnCount }, (_, index) => {
    const axisTripHour = axisStartTripHour + index * intervalHours;

    return {
      axisTripHour,
      index,
      label: formatTimelineAxisLabel(getSafeNumber(startHourLocal) + axisTripHour)
    };
  });

  return {
    axisStartTripHour,
    columns,
    intervalHours,
    intervalMinutes: interval
  };
};

export const getTimelineColumnIndexForTripHour = (axis: TimelineAxis, tripHour: number) => {
  const rawIndex = Math.floor((getSafeNumber(tripHour) - axis.axisStartTripHour) / axis.intervalHours);
  return Math.min(axis.columns.length - 1, Math.max(0, rawIndex));
};

export const getTimelinePositionPixels = ({
  axis,
  cellWidth,
  labelColumnWidth = 0,
  tripHour
}: {
  axis: TimelineAxis;
  cellWidth: number;
  labelColumnWidth?: number;
  tripHour: number;
}) => {
  return labelColumnWidth + ((getSafeNumber(tripHour) - axis.axisStartTripHour) / axis.intervalHours) * cellWidth;
};
