import React, { useState } from "react";
import { Itinerary } from "../types";
import { 
  getHourStatusForLocation, 
  getTravelerStatusAtHour, 
  isRecommendedSleepHour,
  calculateDaylightSummary,
  formatLocalHour
} from "../utils/timezoneMath";
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
  const origin = itinerary.locations[0];
  const destination = itinerary.locations[itinerary.locations.length - 1];

  // Calculations for current status
  const currentLocalStatus = travelerStatus.currentLocation
    ? getHourStatusForLocation(itinerary, travelerStatus.currentLocation, currentTripHour)
    : null;

  const destinationStatus = getHourStatusForLocation(itinerary, destination, currentTripHour);
  const originStatus = getHourStatusForLocation(itinerary, origin, currentTripHour);
  const { daylightHours, twilightHours, nightHours } = calculateDaylightSummary(itinerary, maxTripHour);

  // Helper to jump the scrubber to a specific event
  const jumpToEvent = (hour: number) => {
    onSetTripHour(hour);
  };

  const toggleQuestion = (id: string) => {
    setOpenQuestion(openQuestion === id ? null : id);
  };

  // Questions and Answers data
  const questionsList = [
    {
      id: "q1",
      icon: <MapPin className="icon icon--rose" />,
      question: "What local time will it be where I am?",
      answer: () => {
        if (travelerStatus.type === "flight" && travelerStatus.flightSegment) {
          const flight = travelerStatus.flightSegment;
          const fromLoc = itinerary.locations.find(l => l.id === flight.fromLocationId)!;
          const toLoc = itinerary.locations.find(l => l.id === flight.toLocationId)!;
          return (
            <div className="qa-stack qa-stack--compact">
              <p>
                You are currently in flight <strong className="qa-emphasis">{flight.flightNumber}</strong>, cruising from <strong>{fromLoc.name} ({fromLoc.code})</strong> to <strong>{toLoc.name} ({toLoc.code})</strong>.
              </p>
              <div className="qa-flight-summary">
                <div>
                  <span className="qa-meta-label">Origin Time ({fromLoc.code})</span>
                  <strong className="qa-flight-summary__time">{getHourStatusForLocation(itinerary, fromLoc, currentTripHour).formattedTime}</strong>
                </div>
                <div className="qa-flight-summary__divider"></div>
                <div>
                  <span className="qa-meta-label">Destination Time ({toLoc.code})</span>
                  <strong className="qa-flight-summary__time">{getHourStatusForLocation(itinerary, toLoc, currentTripHour).formattedTime}</strong>
                </div>
                <div className="qa-flight-summary__divider"></div>
                <div>
                  <span className="qa-meta-label">Cruise Progress</span>
                  <strong className="qa-flight-summary__time">
                    {Math.round(((currentTripHour - flight.departureTripHour) / flight.duration) * 100)}%
                  </strong>
                </div>
              </div>
            </div>
          );
        } else if (currentLocalStatus) {
          return (
            <p>
              You are physically in <strong className="qa-emphasis">{travelerStatus.currentLocation?.name}</strong>. Your watch is synchronized to local time: <strong className="qa-inline-time">{currentLocalStatus.formattedTime}</strong> ({currentLocalStatus.dayName}).
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
      answer: () => (
        <div className="qa-stack qa-stack--compact">
          <p>
            At current trip hour <span className="qa-mono-pill">{currentTripHour}</span>, the local time in <strong>{destination.name} ({destination.timezoneLabel})</strong> is:
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
                // If there is a segment, jump to departure
                const firstSeg = itinerary.segments[0];
                if (firstSeg) jumpToEvent(firstSeg.departureTripHour);
              }}
              className="qa-action-button"
            >
              Back to Start
            </button>
          </div>
        </div>
      )
    },
    {
      id: "q3",
      icon: <Moon className="icon icon--purple" />,
      question: "When should I try to sleep?",
      answer: () => {
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
                    ? "💤 RECOMMENDED SLEEP WINDOW: Try to close your eyes now to adapt to destination time." 
                    : "☀️ BIOLOGICAL DAYTIME: Stay awake, hydrate, and seek bright sunlight."}
                </strong>
                <p className="qa-recommendation__note">
                  Click the timeline's purple hatched segments to see all suggested biological sleep blocks.
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
        const sorted = [...itinerary.segments].sort((a, b) => a.departureTripHour - b.departureTripHour);
        if (sorted.length < 2) {
          return <p>This itinerary does not contain any layovers.</p>;
        }
        
        // Find layovers
        const layoversList = [];
        for (let i = 0; i < sorted.length - 1; i++) {
          const f1 = sorted[i];
          const f2 = sorted[i + 1];
          const layoverDuration = f2.departureTripHour - (f1.departureTripHour + f1.duration);
          const layoverAirport = itinerary.locations.find(l => l.id === f1.toLocationId)!;
          layoversList.push({
            airport: layoverAirport,
            duration: layoverDuration,
            startTripHour: f1.departureTripHour + f1.duration
          });
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
                    {lay.airport.name} ({lay.airport.code})
                  </strong>
                  <span className="qa-duration-badge">
                    {lay.duration} Hours
                  </span>
                </div>
                <p className="qa-muted-copy">
                  <strong>Biological perception:</strong> Leaving {origin.name} morning time and waiting in {lay.airport.name} means your body still operates on origin circadian rhythm. Your layover is from{" "}
                  {getHourStatusForLocation(itinerary, lay.airport, lay.startTripHour).formattedTime} to{" "}
                  {getHourStatusForLocation(itinerary, lay.airport, lay.startTripHour + lay.duration).formattedTime} local time.
                </p>
                <button
                  id={`btn-jump-layover-${idx}`}
                  onClick={() => jumpToEvent(lay.startTripHour + Math.floor(lay.duration / 2))}
                  className="qa-link-button"
                >
                  Jump to Layover on Timeline →
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
        const sorted = [...itinerary.segments].sort((a, b) => a.departureTripHour - b.departureTripHour);
        if (sorted.length === 0) return <p>No flights scheduled.</p>;
        const lastFlight = sorted[sorted.length - 1];
        const lastArr = lastFlight.departureTripHour + lastFlight.duration;
        const departureStatus = getHourStatusForLocation(itinerary, origin, 0);
        const arrivalStatus = getHourStatusForLocation(itinerary, destination, lastArr);

        const timezoneJump = destination.offset - origin.offset;
        const totalDuration = lastArr;

        return (
          <div className="qa-stack qa-stack--compact">
            <p>
              Eastbound flyers chase the sun. By flying into future timezones, your clock is forced ahead, causing you to lose hours on the calendar.
            </p>
            <div className="qa-next-day-card">
              <div className="qa-metric-row">
                <span>Timezones Crossings:</span>
                <strong className="qa-next-day-card__value">{timezoneJump > 0 ? `+${timezoneJump}` : timezoneJump} Hours</strong>
              </div>
              <div className="qa-metric-row">
                <span>Flight Time (Inc. Layover):</span>
                <strong className="qa-next-day-card__value">{totalDuration} Hours</strong>
              </div>
              <div className="qa-divider"></div>
              <p className="qa-muted-copy">
                You depart {origin.name} at {departureStatus.formattedTime} ({departureStatus.dayName}) and arrive {destination.name} at {arrivalStatus.formattedTime} ({arrivalStatus.dayName}). Even though the absolute trip duration is {totalDuration} hours, the clocks jumped {timezoneJump} hours ahead, which is why it calendar-arrives the next day!
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
              <strong className="qa-solar-card__value qa-solar-card__value--day">{daylightHours}h</strong>
            </div>
            <div className="qa-solar-card qa-solar-card--twilight">
              <span className="qa-solar-card__label qa-solar-card__label--twilight">Twilight</span>
              <strong className="qa-solar-card__value qa-solar-card__value--twilight">{twilightHours}h</strong>
            </div>
            <div className="qa-solar-card qa-solar-card--night">
              <span className="qa-solar-card__label qa-solar-card__label--night">Night</span>
              <strong className="qa-solar-card__value qa-solar-card__value--night">{nightHours}h</strong>
            </div>
          </div>
          <p className="qa-solar-note">
            {daylightHours > nightHours 
              ? "☀️ This is a daytime-heavy itinerary. Expect high solar exposure which helps maintain daytime wakefulness but might cause sleep disturbances at arrival."
              : "🌙 This is a night-heavy itinerary. Recommended to get as much rest as possible on flights."}
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
