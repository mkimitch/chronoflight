export interface LocationConfig {
  id: string;
  name: string;
  airportName?: string;
  code: string;
  iataCode?: string;
  icaoCode?: string;
  timezoneLabel: string; // e.g. "CDT", "EDT", "EEST", or an IANA timezone from API autofill
  timezoneIana?: string;
  offset: number; // UTC offset in hours (can be half-hours, e.g. 5.5)
  countryCode?: string;
  latitude?: number;
  longitude?: number;
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
  scheduledArrival?: string;
  scheduledDeparture?: string;
  status?: string;
  toLocationId: string;
  departureTripHour: number; // hours from trip start
  duration: number; // flight duration in hours
}

export interface SleepWindow {
  id: string;
  locationId: string;
  startHourLocal: number; // e.g. 23 (11 PM)
  endHourLocal: number; // e.g. 7 (7 AM)
  label: string;
}

export type TimelinePostArrivalMode = "adaptive" | "custom";

export interface TimelinePreferences {
  postArrivalMode: TimelinePostArrivalMode;
  postArrivalHours: number;
}

export interface AviationAirportCode {
  iata: string | null;
  icao: string | null;
}

export interface AviationTimezone {
  iana: string | null;
  utcOffset: string | null;
  utcOffsetHours: number | null;
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
  startHourLocal: number; // Origin local hour at trip hour 0 (0-23)
  startDayName: string; // e.g. "Monday"
  locations: LocationConfig[];
  segments: FlightSegment[];
  timelinePreferences?: TimelinePreferences;
  sleepPreferences: {
    targetBedtime: number; // 0-23, e.g. 22 (10 PM)
    targetWakeTime: number; // 0-23, e.g. 6 (6 AM)
    preAdjust: boolean; // whether to suggest shifting sleep pre-travel
  };
}
