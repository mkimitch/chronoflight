import type { Itinerary } from "../types";
import { formatDurationFromHours } from "../utils/durationFormat";
import { getTripSummaryMetrics } from "../utils/tripSummary";
import { Clock, Coffee, Moon, Plane, Sun, TimerReset } from "lucide-react";

interface TripSummaryProps {
  itinerary: Itinerary;
}

const formatClockShift = (hours: number) => {
  if (hours === 0) {
    return "0h";
  }

  const sign = hours > 0 ? "+" : "-";
  return sign + formatDurationFromHours(Math.abs(hours));
};

const formatGroundLabel = (layoverCount: number) => {
  if (layoverCount === 0) {
    return "Ground";
  }

  return layoverCount === 1 ? "Ground / 1 layover" : `Ground / ${layoverCount} layovers`;
};

export default function TripSummary({ itinerary }: TripSummaryProps) {
  const summary = getTripSummaryMetrics(itinerary);
  const hasSegments = itinerary.segments.length > 0 && summary.elapsedHours > 0;

  const summaryItems = [
    {
      icon: <TimerReset className="icon icon--sm icon--indigo" />,
      label: "Elapsed",
      value: formatDurationFromHours(summary.elapsedHours)
    },
    {
      icon: <Plane className="icon icon--sm icon--indigo" />,
      label: "Flight",
      value: formatDurationFromHours(summary.flightHours)
    },
    {
      icon: <Coffee className="icon icon--sm icon--amber" />,
      label: formatGroundLabel(summary.layoverCount),
      value: formatDurationFromHours(summary.groundHours)
    },
    {
      icon: <Clock className="icon icon--sm icon--muted" />,
      label: "Clock change",
      value: formatClockShift(summary.netTimezoneShiftHours)
    },
    {
      icon: <Sun className="icon icon--sm icon--amber" />,
      label: "Daylight",
      value: formatDurationFromHours(summary.daylightHours)
    },
    {
      icon: <Moon className="icon icon--sm icon--purple" />,
      label: "Night",
      value: formatDurationFromHours(summary.nightHours)
    }
  ];

  return (
    <section className="trip-summary-card" aria-label="Trip Summary">
      <div className="trip-summary-card__header">
        <div className="controls-heading__label">
          <Clock className="icon icon--sm icon--indigo" />
          <span>Trip Summary</span>
        </div>
        {!hasSegments && (
          <span className="trip-summary-card__status">Needs flights</span>
        )}
      </div>

      <div className="trip-summary-grid">
        {summaryItems.map((item) => (
          <div key={item.label} className="trip-summary-item">
            <span className="trip-summary-item__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="trip-summary-item__label">{item.label}</span>
            <strong className="trip-summary-item__value">{item.value}</strong>
          </div>
        ))}
      </div>

      {!hasSegments && (
        <p className="trip-summary-card__note">
          Add valid flight timing to calculate elapsed, ground, and light exposure totals.
        </p>
      )}
    </section>
  );
}
