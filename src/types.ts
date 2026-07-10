export type IanaTimezoneId = string;
export type IsoDateTime = string;
export type UtcOffsetHours = number;

export interface AirportCoordinates {
  latitude: number;
  longitude: number;
}

export interface AirportConfig {
  airportName?: string;
  code: string;
  iataCode?: string;
  icaoCode?: string;
  countryCode?: string;
  coordinates?: AirportCoordinates;
  latitude?: number;
  longitude?: number;
}

export interface LocationConfig extends AirportConfig {
  id: string;
  name: string;
  timezoneIana?: IanaTimezoneId; // Preferred canonical timezone, e.g. "America/Chicago".
  timezoneLabel: string; // Display cache, e.g. "CDT", "BST", or an IANA fallback.
  offset: UtcOffsetHours; // Intentionally cached UTC offset for timeline math at this itinerary date.
}

export interface FlightScheduleMoment {
  localDateTime?: IsoDateTime;
  utcDateTime?: IsoDateTime;
  timezoneIana?: IanaTimezoneId;
  utcOffsetHours?: UtcOffsetHours;
}

export interface FlightSegmentSchedule {
  departure?: FlightScheduleMoment;
  arrival?: FlightScheduleMoment;
}

export interface FlightSegment {
  id: string;
  airline?: string;
  airlineIata?: string;
  airlineIcao?: string;
  arrivalLabel?: string;
  departureLabel?: string;
  durationMinutes?: number;
  flightNumber: string;
  fromLocationId: string;
  note?: string;
  operatedBy?: string;
  rawStatus?: string;
  schedule?: FlightSegmentSchedule;
  scheduledArrival?: string;
  scheduledDeparture?: string;
  status?: string;
  toLocationId: string;
  departureTripHour: number; // Intentionally cached hours from trip start for current timeline rendering.
  duration: number; // Intentionally cached flight duration in hours for current timeline rendering.
}

export interface SleepWindow {
  id: string;
  locationId: string;
  startHourLocal: number; // e.g. 23 (11 PM)
  endHourLocal: number; // e.g. 7 (7 AM)
  label: string;
}

export type TimelineDisplayMode = "normal" | "night-only";
export type TimelinePostArrivalMode = "adaptive" | "custom";

export interface TimelinePreferences {
  displayMode: TimelineDisplayMode;
  postArrivalMode: TimelinePostArrivalMode;
  postArrivalHours: number;
}

export interface AviationAirportCode {
  iata: string | null;
  icao: string | null;
}

export interface AviationTimezone {
  iana: IanaTimezoneId | null;
  utcOffset: string | null;
  utcOffsetHours: UtcOffsetHours | null;
}

export interface AviationAirportSuggestion {
  provider: "airlabs";
  id: string;
  airportName: string | null;
  cityName: string | null;
  airportCode: AviationAirportCode;
  countryCode: string | null;
  coordinates: {
    latitude: number;
    longitude: number;
  } | null;
  displayLabel: string;
  timezone: AviationTimezone;
  source: {
    matchedBy: string;
    fetchedAt: string;
  };
}

export interface AviationFlightSuggestion {
  provider: "airlabs";
  id: string;
  query: {
    raw: string;
    type: "flight" | "route";
    normalized: string;
  };
  flight: {
    flightNumber: string | null;
    airlineName: string | null;
    airlineCode: AviationAirportCode;
    status: string | null;
    rawStatus: string | null;
  };
  origin: AviationAirportSuggestion;
  destination: AviationAirportSuggestion;
  schedule: {
    departure: {
      local: string | null;
      utc: string | null;
      timestamp: number | null;
    };
    arrival: {
      local: string | null;
      utc: string | null;
      timestamp: number | null;
    };
    durationMinutes: number | null;
  };
  source: {
    fetchedAt: string;
  };
}

export type TimelineEventType =
  | "airport-arrival"
  | "boarding"
  | "departure"
  | "arrival"
  | "layover"
  | "sleep-window"
  | "meal"
  | "note"
  | "custom";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  description?: string;
  tripHour: number;
  endTripHour?: number;
  locationId?: string;
  segmentId?: string;
  localDateTime?: IsoDateTime;
}

export interface Itinerary {
  id: string;
  name: string;
  description: string;
  bookingDetails?: {
    airline: string;
    airlineReference: string;
    agencyReference: string;
    bookedDate: string;
    fareClass: string;
    route: string;
    status: string;
    travelDates: string;
    travelers: number;
    tripId: string;
  };
  startDate?: string; // Origin local ISO date at trip hour 0 (YYYY-MM-DD).
  startHourLocal: number; // Origin local hour at trip hour 0 (0-23)
  startDayName: string; // Derived display fallback, e.g. "Monday"
  locations: LocationConfig[];
  segments: FlightSegment[];
  timelineEvents?: TimelineEvent[];
  timelinePreferences?: TimelinePreferences;
  sleepPreferences: {
    targetBedtime: number; // 0-23, e.g. 22 (10 PM)
    targetWakeTime: number; // 0-23, e.g. 6 (6 AM)
    preAdjust: boolean; // whether to suggest shifting sleep pre-travel
  };
}