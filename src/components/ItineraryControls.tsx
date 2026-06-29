import React, { useState } from "react";
import {
  AviationAirportSuggestion,
  AviationFlightSuggestion,
  FlightSegment,
  Itinerary,
  LocationConfig,
  TimelinePreferences
} from "../types";
import { travelPresets } from "../data/presets";
import AviationAutocomplete from "./AviationAutocomplete";
import { searchAirports, searchFlights } from "../utils/aviationSearch";
import {
  getTimelineHorizon,
  getTimelinePreferences,
  TIMELINE_POST_ARRIVAL_HOUR_MAX,
  TIMELINE_POST_ARRIVAL_HOUR_MIN
} from "../utils/timelineHorizon";
import {
  Plus,
  Trash2,
  MapPin,
  Plane,
  Moon,
  Clock,
  Compass,
  RefreshCw,
  Info
} from "lucide-react";

const DEFAULT_PRESET_ID = travelPresets[0]?.id ?? "";
const BASE_OFFSET_OPTIONS = Array.from({ length: 53 }, (_, index) => -12 + index * 0.5);
const POST_ARRIVAL_HOUR_OPTIONS = Array.from(
  { length: TIMELINE_POST_ARRIVAL_HOUR_MAX - TIMELINE_POST_ARRIVAL_HOUR_MIN + 1 },
  (_, index) => TIMELINE_POST_ARRIVAL_HOUR_MIN + index
);

const getPrimaryAirportCode = (airport: AviationAirportSuggestion) => {
  return airport.airportCode.iata ?? airport.airportCode.icao ?? "";
};

const formatUtcOffsetHours = (offset: number) => {
  const sign = offset >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offset);
  const hours = Math.floor(absoluteOffset);
  const minutes = Math.round((absoluteOffset - hours) * 60);
  const minuteLabel = minutes > 0 ? ":" + String(minutes).padStart(2, "0") : "";

  return "UTC" + sign + hours + minuteLabel;
};

const getOffsetOptions = (currentOffset: number) => {
  if (BASE_OFFSET_OPTIONS.includes(currentOffset)) {
    return BASE_OFFSET_OPTIONS;
  }

  return [...BASE_OFFSET_OPTIONS, currentOffset].sort((a, b) => a - b);
};

const formatElapsedHours = (hours: number) => {
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return minutes === 0 ? wholeHours + "h" : wholeHours + "h " + String(minutes).padStart(2, "0") + "m";
};

const getAirportOptionLabel = (airport: AviationAirportSuggestion) => airport.displayLabel;
const getFlightOptionLabel = (flight: AviationFlightSuggestion) => {
  return flight.flight.flightNumber ?? flight.query.normalized;
};

const renderAirportOption = (airport: AviationAirportSuggestion) => {
  const primaryCode = getPrimaryAirportCode(airport);
  const timezone = airport.timezone.iana ?? airport.timezone.utcOffset ?? "Timezone unavailable";

  return (
    <span className="aviation-option">
      <span className="aviation-option__title">
        <strong>{primaryCode || "Airport"}</strong>
        <span>{airport.airportName ?? airport.cityName ?? "Unknown airport"}</span>
      </span>
      <span className="aviation-option__meta">
        {[airport.cityName, airport.airportCode.icao, timezone].filter(Boolean).join(" | ")}
      </span>
    </span>
  );
};

const renderFlightOption = (flight: AviationFlightSuggestion) => {
  const originCode = getPrimaryAirportCode(flight.origin) || "Origin";
  const destinationCode = getPrimaryAirportCode(flight.destination) || "Destination";

  return (
    <span className="aviation-option">
      <span className="aviation-option__title">
        <strong>{flight.flight.flightNumber ?? flight.query.normalized}</strong>
        <span>{flight.flight.airlineName ?? "Airline unavailable"}</span>
      </span>
      <span className="aviation-option__meta">
        {[(originCode + " -> " + destinationCode), flight.flight.status, flight.schedule.departure.local].filter(Boolean).join(" | ")}
      </span>
    </span>
  );
};

const mapAirportToLocation = (
  location: LocationConfig,
  airport: AviationAirportSuggestion
): LocationConfig => {
  const primaryCode = getPrimaryAirportCode(airport) || location.code;
  const timezoneLabel = airport.timezone.iana ?? airport.timezone.utcOffset ?? location.timezoneLabel;

  return {
    ...location,
    airportName: airport.airportName ?? location.airportName,
    code: primaryCode.toUpperCase(),
    countryCode: airport.countryCode ?? location.countryCode,
    iataCode: airport.airportCode.iata ?? location.iataCode,
    icaoCode: airport.airportCode.icao ?? location.icaoCode,
    latitude: airport.coordinates?.latitude ?? location.latitude,
    longitude: airport.coordinates?.longitude ?? location.longitude,
    name: airport.cityName ?? airport.airportName ?? location.name,
    offset: airport.timezone.utcOffsetHours ?? location.offset,
    timezoneIana: airport.timezone.iana ?? location.timezoneIana,
    timezoneLabel
  };
};

const locationMatchesAirport = (location: LocationConfig, airport: AviationAirportSuggestion) => {
  const airportCodes = [airport.airportCode.iata, airport.airportCode.icao]
    .filter((code): code is string => Boolean(code))
    .map((code) => code.toUpperCase());
  const locationCodes = [location.code, location.iataCode, location.icaoCode]
    .filter((code): code is string => Boolean(code))
    .map((code) => code.toUpperCase());

  return locationCodes.some((code) => airportCodes.includes(code));
};

const findLocationIdForAirport = (
  locations: LocationConfig[],
  airport: AviationAirportSuggestion,
  fallbackId: string
) => {
  return locations.find((location) => locationMatchesAirport(location, airport))?.id ?? fallbackId;
};

const formatScheduleLabel = (
  airport: AviationAirportSuggestion,
  localSchedule: string | null
) => {
  if (!localSchedule) {
    return undefined;
  }

  const primaryCode = getPrimaryAirportCode(airport) || "Airport";
  const place = airport.cityName ?? airport.airportName ?? primaryCode;
  return place + " (" + primaryCode + "), " + localSchedule;
};

interface ItineraryControlsProps {
  currentItinerary: Itinerary;
  onUpdateItinerary: (updated: Itinerary) => void;
  onSelectPreset: (presetId: string) => void;
}

export default function ItineraryControls({
  currentItinerary,
  onUpdateItinerary,
  onSelectPreset
}: ItineraryControlsProps) {
  const [activeTab, setActiveTab] = useState<"preset" | "locations" | "flights" | "sleep">("preset");
  const startHourOptions = Array.from({ length: 24 }, (_, index) => index);
  const hasCustomStartHour = !startHourOptions.includes(currentItinerary.startHourLocal);
  const timelinePreferences = getTimelinePreferences(currentItinerary);
  const timelineHorizon = getTimelineHorizon(currentItinerary);
  const maxSegmentTripHour = Math.max(
    36,
    ...currentItinerary.segments.map((segment) => Math.ceil(segment.departureTripHour + segment.duration + 4))
  );

  // Handle Preset change
  const selectPreset = (id: string) => {
    onSelectPreset(id);
  };

  // Helper to deep copy and update the itinerary
  const updateItinerary = (updatedFields: Partial<Itinerary>) => {
    onUpdateItinerary({
      ...currentItinerary,
      ...updatedFields,
    });
  };

  const handleTimelinePreferenceChange = (updatedPreferences: Partial<TimelinePreferences>) => {
    updateItinerary({
      timelinePreferences: {
        ...timelinePreferences,
        ...updatedPreferences
      }
    });
  };

  // Update a specific location config
  const handleLocationChange = (index: number, key: keyof LocationConfig, value: any) => {
    const updatedLocations = [...currentItinerary.locations];
    updatedLocations[index] = {
      ...updatedLocations[index],
      [key]: value
    };
    updateItinerary({ locations: updatedLocations });
  };

  const handleIataCodeChange = (index: number, value: string) => {
    const updatedLocations = [...currentItinerary.locations];
    updatedLocations[index] = {
      ...updatedLocations[index],
      code: value || updatedLocations[index].code,
      iataCode: value
    };
    updateItinerary({ locations: updatedLocations });
  };

  const handleTimezoneChange = (index: number, value: string) => {
    const updatedLocations = [...currentItinerary.locations];
    updatedLocations[index] = {
      ...updatedLocations[index],
      timezoneIana: value,
      timezoneLabel: value || updatedLocations[index].timezoneLabel
    };
    updateItinerary({ locations: updatedLocations });
  };

  const handleAirportSelect = (index: number, airport: AviationAirportSuggestion) => {
    const updatedLocations = [...currentItinerary.locations];
    updatedLocations[index] = mapAirportToLocation(updatedLocations[index], airport);
    updateItinerary({ locations: updatedLocations });
  };

  // Add a new location
  const handleAddLocation = () => {
    const newId = `loc-${Date.now()}`;
    const lastLoc = currentItinerary.locations[currentItinerary.locations.length - 1];
    const newLoc: LocationConfig = {
      id: newId,
      name: "New City",
      code: "NEW",
      timezoneLabel: "GMT",
      offset: (lastLoc?.offset || 0) + 1
    };
    updateItinerary({
      locations: [...currentItinerary.locations, newLoc]
    });
  };

  // Delete a location
  const handleDeleteLocation = (id: string) => {
    if (currentItinerary.locations.length <= 1) return; // Must have at least one location
    const updatedLocations = currentItinerary.locations.filter(l => l.id !== id);
    const updatedSegments = currentItinerary.segments.filter(
      s => s.fromLocationId !== id && s.toLocationId !== id
    );
    updateItinerary({
      locations: updatedLocations,
      segments: updatedSegments
    });
  };

  // Update a specific flight segment
  const handleSegmentChange = (id: string, key: keyof FlightSegment, value: any) => {
    const updatedSegments = currentItinerary.segments.map(s => {
      if (s.id === id) {
        return { ...s, [key]: value };
      }
      return s;
    });
    updateItinerary({ segments: updatedSegments });
  };

  const handleFlightSelect = (segmentId: string, flight: AviationFlightSuggestion) => {
    const segment = currentItinerary.segments.find((item) => item.id === segmentId);
    if (!segment) {
      return;
    }

    const originLocationId = findLocationIdForAirport(currentItinerary.locations, flight.origin, segment.fromLocationId);
    const destinationLocationId = findLocationIdForAirport(currentItinerary.locations, flight.destination, segment.toLocationId);
    const updatedLocations = currentItinerary.locations.map((location) => {
      if (location.id === originLocationId) {
        return mapAirportToLocation(location, flight.origin);
      }

      if (location.id === destinationLocationId) {
        return mapAirportToLocation(location, flight.destination);
      }

      return location;
    });

    const updatedSegments = currentItinerary.segments.map((item) => {
      if (item.id !== segmentId) {
        return item;
      }

      const durationHours = flight.schedule.durationMinutes
        ? Number((flight.schedule.durationMinutes / 60).toFixed(2))
        : item.duration;

      return {
        ...item,
        airline: flight.flight.airlineName ?? item.airline,
        airlineIata: flight.flight.airlineCode.iata ?? item.airlineIata,
        airlineIcao: flight.flight.airlineCode.icao ?? item.airlineIcao,
        arrivalLabel: formatScheduleLabel(flight.destination, flight.schedule.arrival.local) ?? item.arrivalLabel,
        departureLabel: formatScheduleLabel(flight.origin, flight.schedule.departure.local) ?? item.departureLabel,
        duration: durationHours,
        durationMinutes: flight.schedule.durationMinutes ?? item.durationMinutes,
        flightNumber: flight.flight.flightNumber ?? item.flightNumber,
        fromLocationId: originLocationId,
        rawStatus: flight.flight.rawStatus ?? item.rawStatus,
        scheduledArrival: flight.schedule.arrival.utc ?? flight.schedule.arrival.local ?? item.scheduledArrival,
        scheduledDeparture: flight.schedule.departure.utc ?? flight.schedule.departure.local ?? item.scheduledDeparture,
        status: flight.flight.status ?? item.status,
        toLocationId: destinationLocationId
      };
    });

    updateItinerary({
      locations: updatedLocations,
      segments: updatedSegments
    });
  };

  // Add a flight segment
  const handleAddSegment = () => {
    if (currentItinerary.locations.length < 2) return;
    const newId = `flt-${Date.now()}`;
    const lastSegment = currentItinerary.segments[currentItinerary.segments.length - 1];
    
    // Auto-compute reasonable start hour
    const startHour = lastSegment ? lastSegment.departureTripHour + lastSegment.duration + 4 : 2;
    
    const newSegment: FlightSegment = {
      id: newId,
      flightNumber: `FL${Math.floor(Math.random() * 900) + 100}`,
      fromLocationId: currentItinerary.locations[0].id,
      toLocationId: currentItinerary.locations[currentItinerary.locations.length - 1].id,
      departureTripHour: startHour,
      duration: 5,
    };
    updateItinerary({
      segments: [...currentItinerary.segments, newSegment]
    });
  };

  // Delete a flight segment
  const handleDeleteSegment = (id: string) => {
    const updatedSegments = currentItinerary.segments.filter(s => s.id !== id);
    updateItinerary({ segments: updatedSegments });
  };

  // Update sleep preferences
  const handleSleepChange = (key: string, value: any) => {
    updateItinerary({
      sleepPreferences: {
        ...currentItinerary.sleepPreferences,
        [key]: value
      }
    });
  };

  const formatHourOption = (hour: number) => {
    const totalMinutes = Math.round(hour * 60);
    const hour24 = Math.floor(totalMinutes / 60) % 24;
    const minute = totalMinutes % 60;
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    const meridiem = hour24 >= 12 ? "PM" : "AM";

    return `${hour12}:${String(minute).padStart(2, "0")} ${meridiem}`;
  };

  return (
    <div className="controls-card">
      {/* Control Tabs */}
      <div className="controls-tabs">
        <button
          id="btn-tab-preset"
          onClick={() => setActiveTab("preset")}
          className={`controls-tab${activeTab === "preset" ? " controls-tab--active" : ""}`}
        >
          <Compass className="icon icon--sm" />
          <span>Presets</span>
        </button>
        <button
          id="btn-tab-locations"
          onClick={() => setActiveTab("locations")}
          className={`controls-tab${activeTab === "locations" ? " controls-tab--active" : ""}`}
        >
          <MapPin className="icon icon--sm" />
          <span>Cities</span>
        </button>
        <button
          id="btn-tab-flights"
          onClick={() => setActiveTab("flights")}
          className={`controls-tab${activeTab === "flights" ? " controls-tab--active" : ""}`}
        >
          <Plane className="icon icon--sm" />
          <span>Flights</span>
        </button>
        <button
          id="btn-tab-sleep"
          onClick={() => setActiveTab("sleep")}
          className={`controls-tab${activeTab === "sleep" ? " controls-tab--active" : ""}`}
        >
          <Moon className="icon icon--sm" />
          <span>Sleep</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="controls-body">
        
        {/* PRESET TAB */}
        {activeTab === "preset" && (
          <div className="controls-section">
            <div className="controls-heading__label">
              <Compass className="icon icon--indigo" />
              <span>Select Journey Preset</span>
            </div>
            
            <div className="controls-presets">
              {travelPresets.map((preset) => {
                const isActivePreset = currentItinerary.id === preset.id;

                return (
                  <button
                    key={preset.id}
                    id={`preset-card-${preset.id}`}
                    onClick={() => selectPreset(preset.id)}
                    className={`preset-card${isActivePreset ? " preset-card--active" : ""}`}
                  >
                    <div className="preset-card__header">
                      <h3 className={`preset-card__title${isActivePreset ? " preset-card__title--active" : ""}`}>
                        {preset.name}
                      </h3>
                      <span className={`preset-card__route${isActivePreset ? " preset-card__route--active" : ""}`}>
                        {preset.locations.map(l => l.code).join(" → ")}
                      </span>
                    </div>
                    <p className="preset-card__description">
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="controls-subsection">
              <div className="controls-heading__label">
                <Clock className="icon icon--sm icon--indigo" />
                <span>Base Schedule Controls</span>
              </div>

              <div className="form-grid form-grid--two">
                <div>
                  <label className="field-label">
                    Start Local Hour
                  </label>
                  <select
                    id="select-start-hour"
                    value={currentItinerary.startHourLocal}
                    onChange={(e) => updateItinerary({ startHourLocal: parseFloat(e.target.value) })}
                    className="form-input"
                  >
                    {hasCustomStartHour && (
                      <option value={currentItinerary.startHourLocal}>
                        {formatHourOption(currentItinerary.startHourLocal)}
                      </option>
                    )}
                    {startHourOptions.map((hour) => (
                      <option key={hour} value={hour}>
                        {formatHourOption(hour)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label">
                    Departure Day
                  </label>
                  <select
                    id="select-start-day"
                    value={currentItinerary.startDayName}
                    onChange={(e) => updateItinerary({ startDayName: e.target.value })}
                    className="form-input"
                  >
                    {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="controls-subsection">
              <div className="controls-heading__label">
                <Clock className="icon icon--sm icon--indigo" />
                <span>Timeline Range</span>
              </div>

              <div className="form-grid form-grid--two">
                <div>
                  <label className="field-label" htmlFor="select-timeline-range-mode">
                    Range Mode
                  </label>
                  <select
                    id="select-timeline-range-mode"
                    value={timelinePreferences.postArrivalMode}
                    onChange={(e) => handleTimelinePreferenceChange({
                      postArrivalMode: e.target.value as TimelinePreferences["postArrivalMode"]
                    })}
                    className="form-input"
                  >
                    <option value="adaptive">Adaptive</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="field-label" htmlFor="input-timeline-resolved-window">
                    Visible Window
                  </label>
                  <input
                    id="input-timeline-resolved-window"
                    type="text"
                    readOnly
                    value={`Arrival + ${timelineHorizon.postArrivalHours}h`}
                    className="form-input form-input--readonly form-input--strong"
                  />
                </div>
              </div>

              <div className="field--full">
                <label className="field-label" htmlFor="select-post-arrival-hours">
                  Custom Post-Arrival Hours
                </label>
                <select
                  id="select-post-arrival-hours"
                  value={timelinePreferences.postArrivalHours}
                  onChange={(e) => handleTimelinePreferenceChange({ postArrivalHours: parseInt(e.target.value) })}
                  className="form-input"
                  disabled={timelinePreferences.postArrivalMode !== "custom"}
                >
                  {POST_ARRIVAL_HOUR_OPTIONS.map((hour) => (
                    <option key={hour} value={hour}>{hour}h</option>
                  ))}
                </select>
              </div>

              <div className="timeline-range-summary">
                <span>Final arrival: {formatElapsedHours(timelineHorizon.lastArrivalTripHour)}</span>
                <span>Timeline ends: Trip Hour {timelineHorizon.maxTripHour}</span>
              </div>
            </div>
          </div>
        )}

        {/* LOCATIONS TAB */}
        {activeTab === "locations" && (
          <div className="controls-section">
            <div className="controls-heading">
              <div className="controls-heading__label">
                <MapPin className="icon icon--sm icon--indigo" />
                <span>Cities & Timezones</span>
              </div>
              <button
                id="btn-add-location"
                onClick={handleAddLocation}
                className="inline-action"
              >
                <Plus className="icon icon--sm" />
                <span>Add City</span>
              </button>
            </div>

            <div className="controls-section">
              {currentItinerary.locations.map((loc, idx) => (
                <div key={loc.id} className="form-card">
                  <div className="form-card__header">
                    <span className="form-card__eyebrow">
                      Location {idx + 1} {idx === 0 && "(Origin)"} {idx === currentItinerary.locations.length - 1 && "(Final)"}
                    </span>
                    {currentItinerary.locations.length > 1 && (
                      <button
                        id={`btn-delete-loc-${loc.id}`}
                        onClick={() => handleDeleteLocation(loc.id)}
                        className="icon-button"
                      >
                        <Trash2 className="icon icon--sm" />
                      </button>
                    )}
                  </div>

                  <AviationAutocomplete<AviationAirportSuggestion>
                    emptyMessage="No matching airports found. Try an IATA/ICAO code."
                    getOptionId={(airport) => airport.id}
                    getOptionLabel={getAirportOptionLabel}
                    helperText="Search by city, airport, IATA, or ICAO. Selecting a result autofills the fields below."
                    label="Airport Search"
                    onSelect={(airport) => handleAirportSelect(idx, airport)}
                    placeholder="MSP, KMSP, Sydney, Los Angeles..."
                    renderOption={renderAirportOption}
                    search={searchAirports}
                  />

                  <div className="form-grid form-grid--location">
                    <div className="field--city">
                      <label className="field-label field-label--compact">City Name</label>
                      <input
                        type="text"
                        value={loc.name}
                        onChange={(e) => handleLocationChange(idx, "name", e.target.value)}
                        className="form-input form-input--compact form-input--strong"
                        placeholder="e.g. Minneapolis"
                      />
                    </div>

                    <div className="field--airport">
                      <label className="field-label field-label--compact">Airport Name</label>
                      <input
                        type="text"
                        value={loc.airportName ?? ""}
                        onChange={(e) => handleLocationChange(idx, "airportName", e.target.value)}
                        className="form-input form-input--compact"
                        placeholder="e.g. Minneapolis-St Paul International"
                      />
                    </div>

                    <div className="field--code">
                      <label className="field-label field-label--compact">IATA</label>
                      <input
                        type="text"
                        maxLength={3}
                        value={loc.iataCode ?? (loc.code.length === 3 ? loc.code : "")}
                        onChange={(e) => handleIataCodeChange(idx, e.target.value.toUpperCase())}
                        className="form-input form-input--compact form-input--strong form-input--center"
                        placeholder="MSP"
                      />
                    </div>

                    <div className="field--icao">
                      <label className="field-label field-label--compact">ICAO</label>
                      <input
                        type="text"
                        maxLength={4}
                        value={loc.icaoCode ?? (loc.code.length === 4 ? loc.code : "")}
                        onChange={(e) => handleLocationChange(idx, "icaoCode", e.target.value.toUpperCase())}
                        className="form-input form-input--compact form-input--strong form-input--center"
                        placeholder="KMSP"
                      />
                    </div>

                    <div className="field--timezone">
                      <label className="field-label field-label--compact">Timezone</label>
                      <input
                        type="text"
                        value={loc.timezoneIana ?? loc.timezoneLabel}
                        onChange={(e) => handleTimezoneChange(idx, e.target.value)}
                        className="form-input form-input--compact"
                        placeholder="America/Chicago"
                      />
                    </div>

                    <div className="field--offset">
                      <label className="field-label field-label--compact">UTC Offset</label>
                      <select
                        value={loc.offset}
                        onChange={(e) => handleLocationChange(idx, "offset", parseFloat(e.target.value))}
                        className="form-input form-input--compact"
                      >
                        {getOffsetOptions(loc.offset).map((offset) => (
                          <option key={offset} value={offset}>
                            {formatUtcOffsetHours(offset)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FLIGHTS TAB */}
        {activeTab === "flights" && (
          <div className="controls-section">
            <div className="controls-heading">
              <div className="controls-heading__label">
                <Plane className="icon icon--sm icon--indigo" />
                <span>Flight Segments</span>
              </div>
              <button
                id="btn-add-flight"
                onClick={handleAddSegment}
                className="inline-action"
              >
                <Plus className="icon icon--sm" />
                <span>Add Flight</span>
              </button>
            </div>

            {currentItinerary.segments.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state__copy">No flights defined. Add one to begin!</p>
              </div>
            ) : (
              <div className="controls-section">
                {currentItinerary.segments.map((seg, idx) => (
                  <div key={seg.id} className="form-card">
                    <div className="form-card__header">
                      <span className="flight-pill">
                        {seg.flightNumber || "Flight"} (Leg {idx + 1})
                      </span>
                      <button
                        id={`btn-delete-seg-${seg.id}`}
                        onClick={() => handleDeleteSegment(seg.id)}
                        className="icon-button"
                      >
                        <Trash2 className="icon icon--sm" />
                      </button>
                    </div>

                    <AviationAutocomplete<AviationFlightSuggestion>
                      emptyMessage="No flight found. Try a flight number like DL41."
                      getOptionId={(flight) => flight.id}
                      getOptionLabel={getFlightOptionLabel}
                      helperText="Selecting a flight fills airline, status, route airports, and schedule fields when AirLabs provides them."
                      label="Flight Search"
                      onSelect={(flight) => handleFlightSelect(seg.id, flight)}
                      placeholder="DL41, DAL41, MSP-LAX..."
                      renderOption={renderFlightOption}
                      search={searchFlights}
                    />

                    <div className="form-grid form-grid--flight">
                      <div>
                        <label className="field-label field-label--compact">Flight Number</label>
                        <input
                          type="text"
                          value={seg.flightNumber}
                          onChange={(e) => handleSegmentChange(seg.id, "flightNumber", e.target.value.toUpperCase())}
                          className="form-input form-input--compact form-input--strong"
                        />
                      </div>

                      <div>
                        <label className="field-label field-label--compact">Airline</label>
                        <input
                          type="text"
                          value={seg.airline ?? ""}
                          onChange={(e) => handleSegmentChange(seg.id, "airline", e.target.value)}
                          className="form-input form-input--compact"
                          placeholder="Delta Air Lines"
                        />
                      </div>

                      <div>
                        <label className="field-label field-label--compact">Status</label>
                        <input
                          type="text"
                          value={seg.status ?? ""}
                          onChange={(e) => handleSegmentChange(seg.id, "status", e.target.value)}
                          className="form-input form-input--compact"
                          placeholder="scheduled, active, landed"
                        />
                      </div>

                      <div>
                        <label className="field-label field-label--compact">Duration (Hours)</label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          step={0.05}
                          value={seg.duration}
                          onChange={(e) => handleSegmentChange(seg.id, "duration", Math.max(1, parseFloat(e.target.value) || 1))}
                          className="form-input form-input--compact form-input--strong"
                        />
                      </div>

                      <div>
                        <label className="field-label field-label--compact">Route From</label>
                        <select
                          value={seg.fromLocationId}
                          onChange={(e) => handleSegmentChange(seg.id, "fromLocationId", e.target.value)}
                          className="form-input form-input--compact"
                        >
                          {currentItinerary.locations.map(l => (
                            <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="field-label field-label--compact">Route To</label>
                        <select
                          value={seg.toLocationId}
                          onChange={(e) => handleSegmentChange(seg.id, "toLocationId", e.target.value)}
                          className="form-input form-input--compact"
                        >
                          {currentItinerary.locations.map(l => (
                            <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="field-label field-label--compact">Scheduled Departure</label>
                        <input
                          type="text"
                          value={seg.scheduledDeparture ?? ""}
                          onChange={(e) => handleSegmentChange(seg.id, "scheduledDeparture", e.target.value)}
                          className="form-input form-input--compact"
                          placeholder="API schedule unavailable"
                        />
                      </div>

                      <div>
                        <label className="field-label field-label--compact">Scheduled Arrival</label>
                        <input
                          type="text"
                          value={seg.scheduledArrival ?? ""}
                          onChange={(e) => handleSegmentChange(seg.id, "scheduledArrival", e.target.value)}
                          className="form-input form-input--compact"
                          placeholder="API schedule unavailable"
                        />
                      </div>

                      <div className="field--full">
                        <label className="field-label field-label--compact">
                          Departure Trip Hour: <span className="highlight-value">{formatElapsedHours(seg.departureTripHour)}</span>
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={maxSegmentTripHour}
                          step={0.25}
                          value={seg.departureTripHour}
                          onChange={(e) => handleSegmentChange(seg.id, "departureTripHour", parseFloat(e.target.value))}
                          className="range-input"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SLEEP TAB */}
        {activeTab === "sleep" && (
          <div className="controls-section">
            <div className="controls-heading__label">
              <Moon className="icon icon--sm icon--indigo" />
              <span>Circadian Rhythm Settings</span>
            </div>

            <div className="notice notice--warm">
              <Info className="icon icon--amber" />
              <div>
                Our circadian advisor suggesting optimal travel sleep windows. Change your personal target bedtime below to calculate biological pre-adjustments!
              </div>
            </div>

            <div className="controls-section">
              <div>
                <label className="field-label">
                  My Target Bedtime ({currentItinerary.sleepPreferences.targetBedtime}:00)
                </label>
                <select
                  value={currentItinerary.sleepPreferences.targetBedtime}
                  onChange={(e) => handleSleepChange("targetBedtime", parseInt(e.target.value))}
                  className="form-input"
                >
                  {Array.from({ length: 24 }).map((_, i) => (
                    <option key={i} value={i}>
                      {i === 0 ? "12 AM" : i === 12 ? "12 PM" : i > 12 ? `${i - 12} PM` : `${i} AM`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="field-label">
                  My Target Wake Time ({currentItinerary.sleepPreferences.targetWakeTime}:00)
                </label>
                <select
                  value={currentItinerary.sleepPreferences.targetWakeTime}
                  onChange={(e) => handleSleepChange("targetWakeTime", parseInt(e.target.value))}
                  className="form-input"
                >
                  {Array.from({ length: 24 }).map((_, i) => (
                    <option key={i} value={i}>
                      {i === 0 ? "12 AM" : i === 12 ? "12 PM" : i > 12 ? `${i - 12} PM` : `${i} AM`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="checkbox-row">
                <input
                  type="checkbox"
                  id="chk-preadjust"
                  checked={currentItinerary.sleepPreferences.preAdjust}
                  onChange={(e) => handleSleepChange("preAdjust", e.target.checked)}
                  className="checkbox-input"
                />
                <label htmlFor="chk-preadjust" className="checkbox-label">
                  Enable destination pre-adjustment suggestions
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Restore defaults button */}
      <div className="controls-footer">
        <span className="controls-footer__label">Fully Interactive Builder</span>
        <button
          id="btn-restore-defaults"
          onClick={() => selectPreset(DEFAULT_PRESET_ID)}
          className="reset-button"
        >
          <RefreshCw className="icon icon--xs" />
          <span>Reset Preset</span>
        </button>
      </div>
    </div>
  );
}
