import React, { useRef, useEffect, useState } from "react";
import { Itinerary, LocationConfig, FlightSegment } from "../types";
import {
  getHourStatusForLocation,
  getTravelerStatusAtHour,
  isRecommendedSleepHour,
  getOffsetDayName
} from "../utils/timezoneMath";
import { Sun, Moon, Plane, Clock, Bed } from "lucide-react";

interface TimelineVisualizerProps {
  itinerary: Itinerary;
  currentTripHour: number;
  onSetTripHour: (hour: number) => void;
  maxTripHour: number;
}

interface TimelinePoint {
  x: number;
  y: number;
}

interface FlightGeometry {
  arrX: number;
  arrY: number;
  cx1: number;
  cx2: number;
  cy1: number;
  cy2: number;
  depX: number;
  depY: number;
  fromLocation: LocationConfig;
  pathD: string;
  segment: FlightSegment;
  toLocation: LocationConfig;
}

interface ExactLocalDateTime {
  dateLabel: string;
  timeLabel: string;
  timezoneLabel: string;
}

interface FlightTooltipState {
  fromLocalTime: ExactLocalDateTime;
  fromLocation: LocationConfig;
  progressPercent: number;
  segment: FlightSegment;
  toLocalTime: ExactLocalDateTime;
  toLocation: LocationConfig;
  tooltipX: number;
  tooltipY: number;
  tripElapsedLabel: string;
  tripHour: number;
}

const MINUTES_PER_DAY = 24 * 60;

const getBezierPoint = (
  progress: number,
  start: TimelinePoint,
  control1: TimelinePoint,
  control2: TimelinePoint,
  end: TimelinePoint
): TimelinePoint => {
  const inverse = 1 - progress;
  const inverseSquared = inverse * inverse;
  const progressSquared = progress * progress;

  return {
    x: inverseSquared * inverse * start.x
      + 3 * inverseSquared * progress * control1.x
      + 3 * inverse * progressSquared * control2.x
      + progressSquared * progress * end.x,
    y: inverseSquared * inverse * start.y
      + 3 * inverseSquared * progress * control1.y
      + 3 * inverse * progressSquared * control2.y
      + progressSquared * progress * end.y
  };
};

const getNearestBezierProgress = (point: TimelinePoint, geometry: FlightGeometry) => {
  const start = { x: geometry.depX, y: geometry.depY };
  const control1 = { x: geometry.cx1, y: geometry.cy1 };
  const control2 = { x: geometry.cx2, y: geometry.cy2 };
  const end = { x: geometry.arrX, y: geometry.arrY };
  let bestProgress = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index <= 120; index++) {
    const progress = index / 120;
    const candidate = getBezierPoint(progress, start, control1, control2, end);
    const distance = (candidate.x - point.x) ** 2 + (candidate.y - point.y) ** 2;

    if (distance < bestDistance) {
      bestDistance = distance;
      bestProgress = progress;
    }
  }

  return bestProgress;
};

const formatExactLocalDateTime = (
  itinerary: Itinerary,
  location: LocationConfig,
  tripHour: number
): ExactLocalDateTime => {
  const origin = itinerary.locations[0];
  const offsetDiff = location.offset - origin.offset;
  const totalMinutes = Math.round((itinerary.startHourLocal + tripHour + offsetDiff) * 60);
  const dayOffset = Math.floor(totalMinutes / MINUTES_PER_DAY);
  const minuteOfDay = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour24 = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const meridiem = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const dayName = getOffsetDayName(itinerary.startDayName, dayOffset);
  const dayOffsetLabel = dayOffset === 0
    ? "start day"
    : `${dayOffset > 0 ? "+" : ""}${dayOffset} day${Math.abs(dayOffset) === 1 ? "" : "s"}`;

  return {
    dateLabel: `${dayName} (${dayOffsetLabel})`,
    timeLabel: `${hour12}:${String(minute).padStart(2, "0")} ${meridiem}`,
    timezoneLabel: `${location.timezoneLabel} UTC${location.offset >= 0 ? "+" : ""}${location.offset}`
  };
};

const formatTripElapsed = (tripHour: number) => {
  const totalMinutes = Math.max(0, Math.round(tripHour * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
};

export default function TimelineVisualizer({
  itinerary,
  currentTripHour,
  onSetTripHour,
  maxTripHour
}: TimelineVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridContentRef = useRef<HTMLDivElement>(null);
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });
  const [flightTooltip, setFlightTooltip] = useState<FlightTooltipState | null>(null);

  const cellWidth = 60; // width of each hour cell in pixels
  const rowHeight = 90; // height of each location track in pixels
  const headerHeight = 44; // height of the column headers row in pixels

  const totalHours = maxTripHour + 1;
  const hoursArray = Array.from({ length: totalHours }, (_, i) => i);

  // Update SVG canvas dimensions when container or itinerary changes
  useEffect(() => {
    const updateDimensions = () => {
      if (gridContentRef.current) {
        setSvgDimensions({
          width: gridContentRef.current.scrollWidth,
          height: gridContentRef.current.scrollHeight
        });
      }
    };

    // Use a small timeout to let the DOM settle
    const timer = setTimeout(updateDimensions, 100);
    window.addEventListener("resize", updateDimensions);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateDimensions);
    };
  }, [itinerary, maxTripHour]);

  // Hide stale tooltip content when the visualized data changes
  useEffect(() => {
    setFlightTooltip(null);
  }, [itinerary, maxTripHour]);

  // Center scroll around active scrubber if possible
  useEffect(() => {
    if (containerRef.current) {
      const activeX = currentTripHour * cellWidth;
      const containerWidth = containerRef.current.clientWidth;
      const scrollLeft = activeX - containerWidth / 2 + cellWidth / 2;
      containerRef.current.scrollTo({
        left: Math.max(0, scrollLeft),
        behavior: "smooth"
      });
    }
  }, [currentTripHour]);

  // Determine locations row indexing
  const locations = itinerary.locations;
  const findRowIndex = (locId: string) => {
    return locations.findIndex(l => l.id === locId);
  };

  const getFlightGeometry = (segment: FlightSegment): FlightGeometry | null => {
    const fromIdx = findRowIndex(segment.fromLocationId);
    const toIdx = findRowIndex(segment.toLocationId);
    const fromLocation = locations[fromIdx];
    const toLocation = locations[toIdx];

    if (fromIdx === -1 || toIdx === -1 || !fromLocation || !toLocation) {
      return null;
    }

    const depX = 140 + segment.departureTripHour * cellWidth + cellWidth / 2;
    const depY = headerHeight + fromIdx * rowHeight + rowHeight / 2;
    const arrX = 140 + (segment.departureTripHour + segment.duration) * cellWidth + cellWidth / 2;
    const arrY = headerHeight + toIdx * rowHeight + rowHeight / 2;
    const dx = arrX - depX;
    const cx1 = depX + dx * 0.35;
    const cy1 = depY;
    const cx2 = depX + dx * 0.65;
    const cy2 = arrY;
    const pathD = `M ${depX} ${depY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${arrX} ${arrY}`;

    return {
      arrX,
      arrY,
      cx1,
      cx2,
      cy1,
      cy2,
      depX,
      depY,
      fromLocation,
      pathD,
      segment,
      toLocation
    };
  };

  const getTooltipPosition = (point: TimelinePoint) => {
    const tooltipWidth = 280;
    const tooltipHeight = 174;
    const maxX = Math.max(12, svgDimensions.width - tooltipWidth - 12);
    const maxY = Math.max(12, svgDimensions.height - tooltipHeight - 12);

    return {
      tooltipX: Math.min(Math.max(point.x + 16, 12), maxX),
      tooltipY: Math.min(Math.max(point.y + 16, 12), maxY)
    };
  };

  const buildFlightTooltip = (
    segment: FlightSegment,
    progress: number,
    anchorPoint: TimelinePoint
  ): FlightTooltipState | null => {
    const geometry = getFlightGeometry(segment);
    if (!geometry) {
      return null;
    }

    const clampedProgress = Math.min(1, Math.max(0, progress));
    const tripHour = segment.departureTripHour + segment.duration * clampedProgress;
    const { tooltipX, tooltipY } = getTooltipPosition(anchorPoint);

    return {
      fromLocalTime: formatExactLocalDateTime(itinerary, geometry.fromLocation, tripHour),
      fromLocation: geometry.fromLocation,
      progressPercent: Math.round(clampedProgress * 100),
      segment,
      toLocalTime: formatExactLocalDateTime(itinerary, geometry.toLocation, tripHour),
      toLocation: geometry.toLocation,
      tooltipX,
      tooltipY,
      tripElapsedLabel: formatTripElapsed(tripHour),
      tripHour
    };
  };

  const getPointerPoint = (event: React.PointerEvent<SVGPathElement>): TimelinePoint | null => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg || svgDimensions.width === 0 || svgDimensions.height === 0) {
      return null;
    }

    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }

    return {
      x: (event.clientX - rect.left) * (svgDimensions.width / rect.width),
      y: (event.clientY - rect.top) * (svgDimensions.height / rect.height)
    };
  };

  const getTooltipFromPointer = (
    event: React.PointerEvent<SVGPathElement>,
    segment: FlightSegment
  ) => {
    const geometry = getFlightGeometry(segment);
    const pointerPoint = getPointerPoint(event);
    if (!geometry || !pointerPoint) {
      return null;
    }

    const progress = getNearestBezierProgress(pointerPoint, geometry);
    const curvePoint = getBezierPoint(
      progress,
      { x: geometry.depX, y: geometry.depY },
      { x: geometry.cx1, y: geometry.cy1 },
      { x: geometry.cx2, y: geometry.cy2 },
      { x: geometry.arrX, y: geometry.arrY }
    );

    return buildFlightTooltip(segment, progress, curvePoint);
  };

  const handleFlightPointerMove = (
    event: React.PointerEvent<SVGPathElement>,
    segment: FlightSegment
  ) => {
    const tooltip = getTooltipFromPointer(event, segment);
    if (tooltip) {
      setFlightTooltip(tooltip);
    }
  };

  const handleFlightPathClick = (
    event: React.PointerEvent<SVGPathElement>,
    segment: FlightSegment
  ) => {
    const tooltip = getTooltipFromPointer(event, segment);
    if (!tooltip) {
      return;
    }

    setFlightTooltip(tooltip);
    onSetTripHour(Math.min(maxTripHour, Math.max(0, Math.round(tooltip.tripHour))));
  };

  const handleFlightPathFocus = (segment: FlightSegment) => {
    const geometry = getFlightGeometry(segment);
    if (!geometry) {
      return;
    }

    const midpoint = getBezierPoint(
      0.5,
      { x: geometry.depX, y: geometry.depY },
      { x: geometry.cx1, y: geometry.cy1 },
      { x: geometry.cx2, y: geometry.cy2 },
      { x: geometry.arrX, y: geometry.arrY }
    );
    const tooltip = buildFlightTooltip(segment, 0.5, midpoint);

    if (tooltip) {
      setFlightTooltip(tooltip);
    }
  };

  const handleFlightPathKeyDown = (
    event: React.KeyboardEvent<SVGPathElement>,
    segment: FlightSegment
  ) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    handleFlightPathFocus(segment);
    onSetTripHour(Math.min(maxTripHour, Math.max(0, Math.round(segment.departureTripHour + segment.duration / 2))));
  };

  // Helper to handle timeline column click
  const handleColumnClick = (hour: number) => {
    onSetTripHour(hour);
  };

  const playheadStyle = {
    left: `${140 + currentTripHour * cellWidth + cellWidth / 2}px`,
    width: "2px"
  };

  return (
    <div className="timeline-card">
      {/* Visualizer Title HUD */}
      <div className="timeline-header">
        <div>
          <h2 className="timeline-title">
            <Clock className="icon icon--indigo" />
            <span>Interactive Space-Time Flight Grid</span>
          </h2>
          <p className="timeline-caption">
            Compare local hours vertically across destinations. Slide the red indicator or click any cell to scrub time.
          </p>
        </div>

        {/* Legend */}
        <div className="timeline-legend">
          <div className="legend-token legend-token--day">
            <Sun className="icon icon--xs icon--amber" />
            <span>Day (6a-6p)</span>
          </div>
          <div className="legend-token legend-token--twilight">
            <div className="timeline-dot timeline-dot--sm timeline-dot--twilight"></div>
            <span>Twilight</span>
          </div>
          <div className="legend-token legend-token--night">
            <Moon className="icon icon--xs icon--purple" />
            <span>Night (9p-6a)</span>
          </div>
          <div className="legend-token legend-token--sleep">
            <div className="legend-sleep-pattern"></div>
            <span>Suggested Sleep</span>
          </div>
        </div>
      </div>

      {/* Main Scroller Area */}
      <div 
        ref={containerRef}
        className="timeline-scroller"
        style={{ minHeight: `${headerHeight + locations.length * rowHeight + 20}px` }}
      >
        <div 
          ref={gridContentRef}
          className="timeline-grid-content"
          style={{ width: `${locations.length ? totalHours * cellWidth + 140 : 100}px` }}
        >
          {/* 1. SVG Layer for Flights, Flight Numbers, and Connections */}
          <svg 
            className="timeline-flight-layer"
            style={{ width: `${svgDimensions.width}px`, height: `${svgDimensions.height}px` }}
          >
            {/* Draw flight paths */}
            {itinerary.segments.map((seg) => {
              const fromIdx = findRowIndex(seg.fromLocationId);
              const toIdx = findRowIndex(seg.toLocationId);
              
              if (fromIdx === -1 || toIdx === -1) return null;

              // Compute center coordinates of origin cell
              const depX = 140 + seg.departureTripHour * cellWidth + cellWidth / 2;
              const depY = headerHeight + fromIdx * rowHeight + rowHeight / 2;

              // Compute center coordinates of destination cell
              const arrX = 140 + (seg.departureTripHour + seg.duration) * cellWidth + cellWidth / 2;
              const arrY = headerHeight + toIdx * rowHeight + rowHeight / 2;

              // Control points for a graceful bezier curve path
              const dx = arrX - depX;
              const cx1 = depX + dx * 0.35;
              const cy1 = depY;
              const cx2 = depX + dx * 0.65;
              const cy2 = arrY;

              return (
                <g key={seg.id} className="timeline-flight-group">
                  {/* Subtle Flight path background trail */}
                  <path
                    d={`M ${depX} ${depY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${arrX} ${arrY}`}
                    fill="none"
                    stroke="oklch(var(--flight-path-shadow))"
                    strokeWidth="4"
                    strokeLinecap="round"
                    className="timeline-flight-path-shadow"
                  />
                  {/* Active Flight path line */}
                  <path
                    id={`path-flight-${seg.id}`}
                    d={`M ${depX} ${depY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${arrX} ${arrY}`}
                    fill="none"
                    stroke="oklch(var(--flight-path))"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="6 4"
                    className="timeline-flight-path"
                  />
                  <path
                    d={`M ${depX} ${depY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${arrX} ${arrY}`}
                    fill="none"
                    stroke="oklch(var(--flight-path) / 0)"
                    strokeWidth="18"
                    strokeLinecap="round"
                    className="timeline-flight-hit-area"
                    role="button"
                    tabIndex={0}
                    aria-label={`Inspect exact local times along ${seg.flightNumber}`}
                    onPointerMove={(event) => handleFlightPointerMove(event, seg)}
                    onPointerLeave={() => setFlightTooltip(null)}
                    onPointerDown={(event) => handleFlightPathClick(event, seg)}
                    onFocus={() => handleFlightPathFocus(seg)}
                    onBlur={() => setFlightTooltip(null)}
                    onKeyDown={(event) => handleFlightPathKeyDown(event, seg)}
                  />
                  {/* Flight Plane Icon along curve */}
                  <circle cx={(depX + arrX) / 2} cy={(depY + arrY) / 2 - 4} r="10" fill="oklch(var(--flight-marker-fill))" className="timeline-flight-marker" />
                  <text 
                    x={(depX + arrX) / 2} 
                    y={(depY + arrY) / 2} 
                    fill="oklch(var(--flight-marker-icon))" 
                    fontSize="7" 
                    fontWeight="bold" 
                    textAnchor="middle"
                  >
                    ✈
                  </text>

                  {/* Flight code label tag */}
                  <g transform={`translate(${(depX + arrX) / 2}, ${(depY + arrY) / 2 - 20})`}>
                    <rect 
                      x="-30" 
                      y="-8" 
                      width="60" 
                      height="15" 
                      rx="4" 
                      fill="oklch(var(--flight-label-background))" 
                    />
                    <text 
                      fill="oklch(var(--flight-label-text))" 
                      fontSize="8" 
                      fontWeight="bold" 
                      textAnchor="middle" 
                      y="2"
                    >
                      {seg.flightNumber}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>

          {/* 2. Horizontal Hours Headers */}
          <div className="timeline-hour-header">
            {/* Sticky Label cell corner */}
            <div className="timeline-location-corner">
              <span className="timeline-location-corner__label">Locations</span>
            </div>

            {/* Scrolling Hours */}
            <div className="timeline-hour-row">
              {hoursArray.map((hour) => {
                const isCurrent = hour === currentTripHour;
                return (
                  <div 
                    key={hour}
                    id={`header-col-${hour}`}
                    onClick={() => handleColumnClick(hour)}
                    className={`timeline-hour-cell${isCurrent ? " timeline-hour-cell--current" : ""}`}
                  >
                    <span>
                      {hour === 0 ? "START" : `H +${hour}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Timezone rows for each City */}
          {locations.map((loc, rowIdx) => {
            return (
              <div 
                key={loc.id} 
                className="timeline-row"
              >
                {/* Sticky Row City Label */}
                <div className="timeline-location-label">
                  <div className="timeline-location-name-row">
                    <span className="timeline-location-name">{loc.name}</span>
                    <span className="timeline-location-code">
                      {loc.code}
                    </span>
                  </div>
                  <span className="timeline-location-zone">
                    {loc.timezoneLabel} (UTC {loc.offset >= 0 ? `+${loc.offset}` : loc.offset})
                  </span>
                </div>

                {/* Grid cells representing each trip hour */}
                <div className="timeline-cells">
                  {hoursArray.map((hour) => {
                    const hourStatus = getHourStatusForLocation(itinerary, loc, hour);
                    const sleepSuggested = isRecommendedSleepHour(itinerary, hour);
                    const isPlayhead = hour === currentTripHour;
                    const periodClassName = `timeline-cell--${hourStatus.timePeriod}`;
                    const periodIconClassName = `timeline-cell__period-icon--${hourStatus.timePeriod}`;

                    const icon = hourStatus.timePeriod === "day"
                      ? <Sun className="icon icon--xs icon--amber" />
                      : hourStatus.timePeriod === "twilight"
                        ? <div className="timeline-dot timeline-dot--sm timeline-dot--twilight timeline-dot--pulse"></div>
                        : <Moon className="icon icon--xs icon--purple" />;

                    return (
                      <div
                        key={hour}
                        id={`cell-${loc.id}-${hour}`}
                        onClick={() => handleColumnClick(hour)}
                        className={`timeline-cell ${periodClassName}${isPlayhead ? " timeline-cell--playhead" : ""}`}
                      >
                        {/* Sleep overlay pattern if recommended */}
                        {sleepSuggested && (
                          <div 
                            className="timeline-sleep-overlay"
                            title="Sleep Window"
                          ></div>
                        )}

                        {/* Top corner indicator of day offset (e.g. +1 Day) */}
                        <div className="timeline-cell__top">
                          <span className={`timeline-cell__period-icon ${periodIconClassName}`}>
                            {icon}
                          </span>
                          {hourStatus.dayOffset !== 0 && (
                            <span className="timeline-day-offset">
                              {hourStatus.dayOffset > 0 ? `+${hourStatus.dayOffset}D` : `${hourStatus.dayOffset}D`}
                            </span>
                          )}
                        </div>

                        {/* Centered Large Hour label */}
                        <div className="timeline-cell__time">
                          <span className="timeline-cell__hour">
                            {hourStatus.formattedTime.split(" ")[0]}
                          </span>
                          <span className="timeline-cell__meridiem">
                            {hourStatus.formattedTime.split(" ")[1]}
                          </span>
                        </div>

                        {/* Bottom features (e.g. sleep indicator badge) */}
                        <div className="timeline-cell__bottom">
                          <span className="timeline-cell__day">
                            {hourStatus.dayName.slice(0, 3)}
                          </span>
                          {sleepSuggested && (
                            <Bed className="icon icon--xs icon--purple" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* 4. Overlay Playhead Scrubber */}
          <div
            aria-hidden="true"
            className="timeline-playhead"
            style={playheadStyle}
          >
            <div className="timeline-playhead__line"></div>
          </div>
          <div
            aria-hidden="true"
            className="timeline-playhead-pin"
            style={playheadStyle}
          >
            <div className="timeline-playhead__pin"></div>
          </div>

          {flightTooltip && (
            <div
              className="timeline-flight-tooltip"
              role="tooltip"
              style={{
                left: `${flightTooltip.tooltipX}px`,
                top: `${flightTooltip.tooltipY}px`
              }}
            >
              <div className="timeline-flight-tooltip__eyebrow">Flight path point</div>
              <div className="timeline-flight-tooltip__title">
                {flightTooltip.segment.flightNumber}
              </div>
              <div className="timeline-flight-tooltip__route">
                {flightTooltip.fromLocation.name} ({flightTooltip.fromLocation.code}) to {flightTooltip.toLocation.name} ({flightTooltip.toLocation.code})
              </div>

              <div className="timeline-flight-tooltip__section">
                <div className="timeline-flight-tooltip__row">
                  <span>{flightTooltip.fromLocation.code} local</span>
                  <strong>{flightTooltip.fromLocalTime.timeLabel}</strong>
                </div>
                <span className="timeline-flight-tooltip__detail">
                  {flightTooltip.fromLocalTime.dateLabel} | {flightTooltip.fromLocalTime.timezoneLabel}
                </span>
              </div>

              <div className="timeline-flight-tooltip__section">
                <div className="timeline-flight-tooltip__row">
                  <span>{flightTooltip.toLocation.code} local</span>
                  <strong>{flightTooltip.toLocalTime.timeLabel}</strong>
                </div>
                <span className="timeline-flight-tooltip__detail">
                  {flightTooltip.toLocalTime.dateLabel} | {flightTooltip.toLocalTime.timezoneLabel}
                </span>
              </div>

              <div className="timeline-flight-tooltip__meta">
                <span>Trip {flightTooltip.tripElapsedLabel}</span>
                <span>{flightTooltip.progressPercent}% through leg</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scrubber Range Slider Control */}
      <div className="timeline-slider-panel">
        <div className="timeline-slider-header">
          <span className="timeline-slider-label">
            <Clock className="icon icon--sm icon--indigo" />
            <span>Interactive Time Slider:</span>
            <strong className="timeline-slider-value">Trip Hour {currentTripHour} / {maxTripHour}</strong>
          </span>
          <span className="timeline-active-badge">
            <span className="timeline-active-dot"></span>
            <span>ACTIVE POSITION</span>
          </span>
        </div>

        <input
          type="range"
          id="timeline-main-scrubber"
          min={0}
          max={maxTripHour}
          value={currentTripHour}
          onChange={(e) => onSetTripHour(parseInt(e.target.value))}
          className="timeline-main-range"
        />

        {/* Dynamic status feedback based on physical position */}
        <div className="timeline-status">
          <div className="timeline-status__phase">
            <span className="timeline-status-label">Current Phase:</span>
            <span className="timeline-phase-badge">
              {(() => {
                const stat = getTravelerStatusAtHour(itinerary, currentTripHour);
                if (stat.type === "flight" && stat.flightSegment) {
                  return (
                    <>
                      <Plane className="icon icon--xs icon--indigo is-pulsing" />
                      <span>In Flight {stat.flightSegment.flightNumber}</span>
                    </>
                  );
                } else if (stat.type === "layover" && stat.currentLocation) {
                  return (
                    <>
                      <div className="timeline-dot timeline-dot--sm timeline-dot--amber"></div>
                      <span>Layover in {stat.currentLocation.name} ({stat.currentLocation.code})</span>
                    </>
                  );
                } else if (stat.type === "destination" && stat.currentLocation) {
                  return (
                    <>
                      <div className="timeline-dot timeline-dot--sm timeline-dot--emerald"></div>
                      <span>Arrived at {stat.currentLocation.name} ({stat.currentLocation.code})</span>
                    </>
                  );
                } else {
                  return (
                    <>
                      <div className="timeline-dot timeline-dot--sm timeline-dot--indigo"></div>
                      <span>At Origin in {stat.currentLocation?.name} ({stat.currentLocation?.code})</span>
                    </>
                  );
                }
              })()}
            </span>
          </div>

          <div className="timeline-status-times">
            <span>
              Origin Time: <strong>{getHourStatusForLocation(itinerary, itinerary.locations[0], currentTripHour).formattedTime}</strong>
            </span>
            <span className="timeline-status-divider">|</span>
            <span>
              Destination Time: <strong>{getHourStatusForLocation(itinerary, itinerary.locations[itinerary.locations.length - 1], currentTripHour).formattedTime}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
