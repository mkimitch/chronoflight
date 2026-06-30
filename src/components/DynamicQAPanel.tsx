import React, { useState } from "react";
import type { Itinerary } from "../types";
import {
  getHourStatusForLocation,
  getTravelerStatusAtHour,
  isRecommendedSleepHour,
  calculateDaylightSummary
} from "../utils/timezoneMath";
import { formatDurationFromHours } from "../utils/durationFormat";
import {
  getAirportCode,
  getLocationLabel,
  getLocationName,
  getLocationOffset,
  getRenderableSegments,
  getSegmentArrivalTripHour,
  getSegmentDepartureTripHour,
  getSegmentDurationHours
} from "../utils/itineraryDisplay";
import {
  HelpCircle,
  ChevronRight,
  ChevronDown,
  MapPin,
  Moon,
  Sun,
  Clock,
  Compass,
  Bed,
  Coffee
} from "lucide-react";

interface DynamicQAPanelProps {
  itinerary: Itinerary;
  currentTripHour: number;
  maxTripHour: number;
  onSetTripHour: (hour: number) => void;
}

export default function DynamicQAPanel({
  itinerary,
  currentTripHour,
  maxTripHour,
  onSetTripHour
}: DynamicQAPanelProps) {
  const [openQuestion, setOpenQuestion] = useState<string | null>("q1");

  const travelerStatus = getTravelerStatusAtHour(itinerary, currentTripHour);
  const origin = itinerary.locations[0] ?? null;
  const destination = itinerary.locations[itinerary.locations.length - 1] ?? null;
  const renderableSegments = getRenderableSegments(itinerary);

  // Calculations for current status
  const currentLocalStatus = travelerStatus.currentLocation
    ? getHourStatusForLocation(itinerary, travelerStatus.currentLocation, currentTripHour)
    : null;

  const destinationStatus = destination
    ? getHourStatusForLocation(itinerary, destination, currentTripHour)
    : null;
  const { daylightHours, twilightHours, nightHours } = calculateDaylightSummary(itinerary, maxTripHour);

  // Helper to jump the scrubber to a specific event
  const jumpToEvent = (hour: number) => {
    onSetTripHour(hour);
  };

  const toggleQuestion = (id: string) => {
    setOpenQuestion(openQuestion === id ? null : id);
  };

  if (!origin) {
    return (
      <div className="qa-card">
        <div className="qa-header">
          <HelpCircle className="icon icon--indigo" />
          <h2>Travel Advisor</h2>
        </div>
        <div className="empty-state" role="status">
          <p className="empty-state__copy">Add at least one airport to unlock travel guidance.</p>
        </div>
      </div>
    );
  }

  // Questions and Answers data
  const questionsList = [
    {
      id: "q1",
      icon: <MapPin className="icon icon--rose" />,
      question: "What local time will it be where I am?",
      answer: () => {
        if (travelerStatus.type === "flight" && travelerStatus.flightSegment) {
          const flight = travelerStatus.flightSegment;
          const fromLoc = itinerary.locations.find(l => l.id === flight.fromLocationId);
          const toLoc = itinerary.locations.find(l => l.id === flight.toLocationId);

          if (!fromLoc || !toLoc) {
            return <p>This flight is missing route airport data.</p>;
          }

          return (
            <div className="qa-stack qa-stack--compact">
              <p>
                You are currently in flight <strong className="qa-emphasis">{flight.flightNumber || "Flight"}</strong>, cruising from <strong>{getLocationLabel(fromLoc)}</strong> to <strong>{getLocationLabel(toLoc)}</strong>.
              </p>
              <div className="qa-flight-summary">
                <div>
                  <span className="qa-meta-label">Origin Time ({getAirportCode(fromLoc)})</span>
                  <strong className="qa-flight-summary__time">{getHourStatusForLocation(itinerary, fromLoc, currentTripHour).formattedTime}</strong>
                </div>
                <div className="qa-flight-summary__divider"></div>
                <div>
                  <span className="qa-meta-label">Destination Time ({getAirportCode(toLoc)})</span>
                  <strong className="qa-flight-summary__time">{getHourStatusForLocation(itinerary, toLoc, currentTripHour).formattedTime}</strong>
                </div>
                <div className="qa-flight-summary__divider"></div>
                <div>
                  <span className="qa-meta-label">Cruise Progress</span>
                  <strong className="qa-flight-summary__time">
                    {Math.round(((currentTripHour - getSegmentDepartureTripHour(flight)) / getSegmentDurationHours(flight)) * 100)}%
                  </strong>
                </div>
              </div>
            </div>
          );
        } else if (currentLocalStatus) {
          return (
            <p>
              You are physically in <strong className="qa-emphasis">{getLocationName(travelerStatus.currentLocation)}</strong>. Your watch is synchronized to local time: <strong className="qa-inline-time">{currentLocalStatus.formattedTime}</strong> ({currentLocalStatus.dayName}).
            </p>
          );
        }
        return <p>Select an hour on the scrubber timeline to view local times.</p>;
      }
    },
    {
      id: "q2",
      icon: <Clock className="icon icon--emerald" />,
      question: "What local time will it be at my final destination?",
      answer: () => {
        if (!destination || !destinationStatus) {
          return <p>Add a destination airport to calculate destination time.</p>;
        }

        return (
          <div className="qa-stack qa-stack--compact">
            <p>
              At <span className="qa-mono-pill">Trip {formatDurationFromHours(currentTripHour)}</span>, the local time in <strong>{getLocationLabel(destination)}</strong> is:
            </p>
            <div className="qa-destination-card">
              <div>
                <span className="qa-destination-card__label">Destination Clock</span>
                <div className="qa-destination-card__time">
                  {destinationStatus.formattedTime}
                </div>
                <span className="qa-destination-card__day">{destinationStatus.dayName} {destinationStatus.dayOffset > 0 ? `(+${destinationStatus.dayOffset} day)` : ""}</span>
              </div>
              <button
                onClick={() => {
                  const firstSeg = renderableSegments[0];
                  if (firstSeg) jumpToEvent(getSegmentDepartureTripHour(firstSeg));
                }}
                className="qa-action-button"
              >
                Back to Start
              </button>
            </div>
          </div>
        );
      }
    },
    {
      id: "q3",
      icon: <Moon className="icon icon--purple" />,
      question: "When should I try to sleep?",
      answer: () => {
        if (itinerary.locations.length < 2 || renderableSegments.length === 0) {
          return <p>Add origin, destination, and flight timing to calculate sleep guidance.</p>;
        }

        const isSleepRecommended = isRecommendedSleepHour(itinerary, currentTripHour);
        return (
          <div className="qa-stack">
            <p>
              Circadian adaptation requires shifting your biological clock. We recommend adjusting to your destination's nighttime cycle starting at the midpoint of your trip.
            </p>
            <div className={`qa-recommendation${isSleepRecommended ? " qa-recommendation--active" : ""}`}>
              <Bed className={`icon icon--md${isSleepRecommended ? " icon--purple is-pulsing" : " icon--muted"}`} />
              <div>
                <span className="qa-recommendation__title">Biological Recommendation</span>
                <strong className="qa-recommendation__text">
                  {isSleepRecommended
                    ? "Recommended sleep window: try to rest now."
                    : "Biological daytime: stay awake and seek bright light."}
                </strong>
                <p className="qa-recommendation__note">
                  Use the hatched timeline cells to scan suggested sleep blocks.
                </p>
              </div>
            </div>
          </div>
        );
      }
    },
    {
      id: "q4",
      icon: <Coffee className="icon icon--amber" />,
      question: "How long is my layover really going to feel?",
      answer: () => {
        const sorted = [...renderableSegments].sort((a, b) => getSegmentDepartureTripHour(a) - getSegmentDepartureTripHour(b));
        if (sorted.length < 2) {
          return <p>This itinerary does not contain any complete layovers.</p>;
        }

        const layoversList = [];
        for (let i = 0; i < sorted.length - 1; i++) {
          const f1 = sorted[i];
          const f2 = sorted[i + 1];
          const layoverDuration = Math.max(0, getSegmentDepartureTripHour(f2) - getSegmentArrivalTripHour(f1));
          const layoverAirport = itinerary.locations.find(l => l.id === f1.toLocationId);

          if (!layoverAirport) {
            continue;
          }

          layoversList.push({
            airport: layoverAirport,
            duration: layoverDuration,
            startTripHour: getSegmentArrivalTripHour(f1)
          });
        }

        if (layoversList.length === 0) {
          return <p>Layover airport data is missing.</p>;
        }

        return (
          <div className="qa-stack">
            <p>
              You have <strong className="qa-strong">{layoversList.length} layover(s)</strong>. Real time spent on the ground:
            </p>
            {layoversList.map((lay, idx) => (
              <div key={`${lay.airport.id}-${lay.startTripHour}`} className="qa-layover-card">
                <div className="qa-layover-header">
                  <strong className="qa-layover-title">
                    <MapPin className="icon icon--sm icon--muted" />
                    {getLocationLabel(lay.airport)}
                  </strong>
                  <span className="qa-duration-badge">
                    {formatDurationFromHours(lay.duration)}
                  </span>
                </div>
                <p className="qa-muted-copy">
                  Your layover in {getLocationName(lay.airport)} is from {" "}
                  {getHourStatusForLocation(itinerary, lay.airport, lay.startTripHour).formattedTime} to {" "}
                  {getHourStatusForLocation(itinerary, lay.airport, lay.startTripHour + lay.duration).formattedTime} local time.
                </p>
                <button
                  id={`btn-jump-layover-${idx}`}
                  onClick={() => jumpToEvent(lay.startTripHour + lay.duration / 2)}
                  className="qa-link-button"
                >
                  Jump to Layover on Timeline
                </button>
              </div>
            ))}
          </div>
        );
      }
    },
    {
      id: "q5",
      icon: <Compass className="icon icon--indigo" />,
      question: "Why does this flight arrive the next day?",
      answer: () => {
        const sorted = [...renderableSegments].sort((a, b) => getSegmentDepartureTripHour(a) - getSegmentDepartureTripHour(b));
        if (!destination || sorted.length === 0) return <p>Add a complete flight segment to compare calendar arrival.</p>;
        const lastFlight = sorted[sorted.length - 1];
        const lastArr = getSegmentArrivalTripHour(lastFlight);
        const departureStatus = getHourStatusForLocation(itinerary, origin, 0);
        const arrivalStatus = getHourStatusForLocation(itinerary, destination, lastArr);

        const timezoneJump = getLocationOffset(destination) - getLocationOffset(origin);
        const timezoneJumpSign = timezoneJump > 0 ? "+" : timezoneJump < 0 ? "-" : "";
        const timezoneJumpLabel = timezoneJumpSign + formatDurationFromHours(Math.abs(timezoneJump));
        const totalDuration = lastArr;

        return (
          <div className="qa-stack qa-stack--compact">
            <p>
              Calendar arrival changes when elapsed flight time combines with timezone shifts.
            </p>
            <div className="qa-next-day-card">
              <div className="qa-metric-row">
                <span>Timezone Shift:</span>
                <strong className="qa-next-day-card__value">{timezoneJumpLabel}</strong>
              </div>
              <div className="qa-metric-row">
                <span>Elapsed Trip Time:</span>
                <strong className="qa-next-day-card__value">{formatDurationFromHours(totalDuration)}</strong>
              </div>
              <div className="qa-divider"></div>
              <p className="qa-muted-copy">
                You depart {getLocationName(origin)} at {departureStatus.formattedTime} ({departureStatus.dayName}) and arrive {getLocationName(destination)} at {arrivalStatus.formattedTime} ({arrivalStatus.dayName}).
              </p>
            </div>
          </div>
        );
      }
    },
    {
      id: "q6",
      icon: <Sun className="icon icon--amber" />,
      question: "How much daylight will I experience?",
      answer: () => (
        <div className="qa-stack">
          <p>
            Because of the direction of travel, the length of the sun's cycle changes dynamically. Here is your solar breakdown:
          </p>
          <div className="qa-solar-grid">
            <div className="qa-solar-card qa-solar-card--day">
              <span className="qa-solar-card__label qa-solar-card__label--day">Daylight</span>
              <strong className="qa-solar-card__value qa-solar-card__value--day">{formatDurationFromHours(daylightHours)}</strong>
            </div>
            <div className="qa-solar-card qa-solar-card--twilight">
              <span className="qa-solar-card__label qa-solar-card__label--twilight">Twilight</span>
              <strong className="qa-solar-card__value qa-solar-card__value--twilight">{formatDurationFromHours(twilightHours)}</strong>
            </div>
            <div className="qa-solar-card qa-solar-card--night">
              <span className="qa-solar-card__label qa-solar-card__label--night">Night</span>
              <strong className="qa-solar-card__value qa-solar-card__value--night">{formatDurationFromHours(nightHours)}</strong>
            </div>
          </div>
          <p className="qa-solar-note">
            {daylightHours > nightHours
              ? "This is a daytime-heavy itinerary. Expect more bright-light exposure."
              : "This is a night-heavy itinerary. Plan rest where practical."}
          </p>
        </div>
      )
    }
  ];

  return (
    <div className="qa-card">
      <div className="qa-header">
        <HelpCircle className="icon icon--indigo" />
        <h2>Travel Advisor (FAQ Toolkit)</h2>
      </div>

      <div className="qa-list">
        {questionsList.map((item) => (
          <div
            key={item.id}
            className={`qa-item${openQuestion === item.id ? " qa-item--open" : ""}`}
          >
            <button
              id={`btn-faq-${item.id}`}
              onClick={() => toggleQuestion(item.id)}
              className="qa-question"
            >
              <div className="qa-question__content">
                {item.icon}
                <span>{item.question}</span>
              </div>
              {openQuestion === item.id ? (
                <ChevronDown className="icon icon--muted" />
              ) : (
                <ChevronRight className="icon icon--muted" />
              )}
            </button>
            {openQuestion === item.id && (
              <div className="qa-answer">
                {item.answer()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
