import type { AviationAirportSuggestion, AviationFlightSuggestion } from "../../src/types";

type QueryType = "flight" | "route";
type FlightQueryParam = "flight_iata" | "flight_icao";
type AirportCodeType = "iata" | "icao";
type FetchLike = typeof fetch;

interface AirLabsOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
}

interface ParsedQuery {
  raw: string;
  type: QueryType;
  normalized: string;
  flightParam?: FlightQueryParam;
  originIata?: string;
  destinationIata?: string;
}

interface AirLabsEnvelope<T> {
  request?: {
    endpoint?: string;
    has_more?: boolean;
  };
  response?: T;
  error?: {
    code?: string;
    message?: string;
  };
}

interface AirLabsFlight {
  airline_iata?: string | null;
  airline_icao?: string | null;
  flight_iata?: string | null;
  flight_icao?: string | null;
  flight_number?: string | number | null;
  dep_iata?: string | null;
  dep_icao?: string | null;
  dep_time?: string | null;
  dep_time_utc?: string | null;
  dep_time_ts?: number | null;
  arr_iata?: string | null;
  arr_icao?: string | null;
  arr_time?: string | null;
  arr_time_utc?: string | null;
  arr_time_ts?: number | null;
  duration?: number | null;
  status?: string | null;
}

interface AirLabsAirport {
  city?: string | null;
  city_code?: string | null;
  country_code?: string | null;
  iata_code?: string | null;
  icao_code?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  name?: string | null;
  timezone?: string | null;
}

interface AirLabsAirline {
  name?: string | null;
  iata_code?: string | null;
  icao_code?: string | null;
}

interface AirLabsSuggestResponse {
  airports?: AirLabsAirport[];
  airports_by_cities?: AirLabsAirport[];
  airports_by_countries?: AirLabsAirport[];
}

interface NormalizedLocation {
  airportName: string | null;
  cityName: string | null;
  airportCode: {
    iata: string | null;
    icao: string | null;
  };
  countryCode: string | null;
  coordinates: {
    latitude: number;
    longitude: number;
  } | null;
  displayLabel: string;
  timezone: {
    iana: string | null;
    utcOffset: string | null;
    utcOffsetHours: number | null;
  };
}

export class AirLabsIntegrationError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AirLabsIntegrationError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const AIRLABS_BASE_URL = "https://airlabs.co/api/v9";
const RESPONSE_FIELDS = [
  "airline_iata",
  "airline_icao",
  "flight_iata",
  "flight_icao",
  "flight_number",
  "dep_iata",
  "dep_icao",
  "dep_time",
  "dep_time_utc",
  "dep_time_ts",
  "arr_iata",
  "arr_icao",
  "arr_time",
  "arr_time_utc",
  "arr_time_ts",
  "duration",
  "status",
].join(",");

const airportFields = "name,city,city_code,country_code,iata_code,icao_code,timezone,lat,lng";
const airlineFields = "name,iata_code,icao_code";

const resolveOptions = (options: AirLabsOptions = {}) => {
  const apiKey = options.apiKey ?? process.env.AIRLABS_API_KEY;

  if (!apiKey) {
    throw new AirLabsIntegrationError(
      500,
      "missing_airlabs_api_key",
      "Set AIRLABS_API_KEY before calling the AirLabs integration.",
    );
  }

  return {
    apiKey,
    baseUrl: options.baseUrl ?? AIRLABS_BASE_URL,
    fetchImpl: options.fetchImpl ?? fetch,
  };
};

const parseUserQuery = (query: string): ParsedQuery => {
  const raw = query.trim();
  const normalized = raw.toUpperCase().replace(/\s+/g, " ");
  const routeMatch = normalized.match(/^([A-Z]{3})(?:\s*(?:-|>|TO)\s*|\s+)([A-Z]{3})$/);

  if (routeMatch) {
    return {
      raw,
      type: "route",
      normalized: `${routeMatch[1]}-${routeMatch[2]}`,
      originIata: routeMatch[1],
      destinationIata: routeMatch[2],
    };
  }

  const compact = normalized.replace(/\s+/g, "");

  if (/^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(compact)) {
    return {
      raw,
      type: "flight",
      normalized: compact,
      flightParam: "flight_iata",
    };
  }

  if (/^[A-Z]{3}\d{1,4}[A-Z]?$/.test(compact)) {
    return {
      raw,
      type: "flight",
      normalized: compact,
      flightParam: "flight_icao",
    };
  }

  throw new AirLabsIntegrationError(
    400,
    "invalid_query",
    "Use a flight number like DL123 or a route like MSP-JFK.",
  );
};

const parseAirportSearchQuery = (query: string) => {
  const raw = query.trim();

  if (raw.length < 3) {
    throw new AirLabsIntegrationError(
      400,
      "invalid_airport_query",
      "Search with at least 3 characters, such as MSP, KMSP, Sydney, or Los Angeles.",
    );
  }

  return {
    raw,
    normalized: raw.toUpperCase().replace(/\s+/g, " "),
  };
};

const getErrorStatus = (httpStatus: number, code: string | undefined) => {
  if (httpStatus === 429 || code?.includes("limit")) {
    return 429;
  }

  if (code === "not_found") {
    return 404;
  }

  if (code === "wrong_params") {
    return 400;
  }

  if (code?.includes("api_key")) {
    return 401;
  }

  return httpStatus >= 400 ? httpStatus : 502;
};

const fetchAirLabs = async <T>(
  endpoint: string,
  params: Record<string, string>,
  options: ReturnType<typeof resolveOptions>,
): Promise<AirLabsEnvelope<T>> => {
  const url = new URL(`${options.baseUrl}/${endpoint}`);

  for (const [key, value] of Object.entries({ ...params, api_key: options.apiKey })) {
    url.searchParams.set(key, value);
  }

  const response = await options.fetchImpl(url);
  const payload = await response.json().catch(() => null) as AirLabsEnvelope<T> | null;
  const apiError = payload?.error;

  if (!response.ok || apiError) {
    const status = getErrorStatus(response.status, apiError?.code);

    throw new AirLabsIntegrationError(
      status,
      apiError?.code ?? `http_${response.status}`,
      apiError?.message ?? `AirLabs request failed with HTTP ${response.status}.`,
      payload,
    );
  }

  if (!payload) {
    throw new AirLabsIntegrationError(502, "invalid_airlabs_response", "AirLabs returned an empty response.");
  }

  return payload;
};

const requireFlight = (flight: AirLabsFlight | null | undefined, parsed: ParsedQuery) => {
  if (!flight) {
    throw new AirLabsIntegrationError(404, "not_found", `No AirLabs flight result found for ${parsed.normalized}.`);
  }

  return flight;
};

const fetchFlight = async (parsed: ParsedQuery, options: ReturnType<typeof resolveOptions>) => {
  if (parsed.type === "route") {
    const payload = await fetchAirLabs<AirLabsFlight[]>(
      "schedules",
      {
        dep_iata: parsed.originIata ?? "",
        arr_iata: parsed.destinationIata ?? "",
        limit: "1",
        fields: RESPONSE_FIELDS,
      },
      options,
    );

    return requireFlight(payload.response?.[0], parsed);
  }

  const payload = await fetchAirLabs<AirLabsFlight>(
    "flight",
    {
      [parsed.flightParam ?? "flight_iata"]: parsed.normalized,
      fields: RESPONSE_FIELDS,
    },
    options,
  );

  return requireFlight(payload.response, parsed);
};

const safeFetchAirport = async (
  code: string | null | undefined,
  codeType: AirportCodeType,
  options: ReturnType<typeof resolveOptions>,
) => {
  if (!code) {
    return null;
  }

  try {
    const payload = await fetchAirLabs<AirLabsAirport[]>(
      "airports",
      {
        [`${codeType}_code`]: code,
        fields: airportFields,
      },
      options,
    );

    return payload.response?.[0] ?? null;
  } catch (error) {
    if (error instanceof AirLabsIntegrationError && error.status === 404) {
      return null;
    }

    throw error;
  }
};

const safeFetchAirline = async (flight: AirLabsFlight, options: ReturnType<typeof resolveOptions>) => {
  const codeType = flight.airline_iata ? "iata_code" : "icao_code";
  const code = flight.airline_iata ?? flight.airline_icao;

  if (!code) {
    return null;
  }

  try {
    const payload = await fetchAirLabs<AirLabsAirline[]>(
      "airlines",
      {
        [codeType]: code,
        fields: airlineFields,
      },
      options,
    );

    return payload.response?.[0] ?? null;
  } catch (error) {
    if (error instanceof AirLabsIntegrationError && error.status === 404) {
      return null;
    }

    throw error;
  }
};

const parseOffset = (value: string | undefined) => {
  if (!value || value === "GMT" || value === "UTC") {
    return "+00:00";
  }

  const match = value.match(/^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?$/);

  if (!match) {
    return null;
  }

  const [, sign, hour, minute = "00"] = match;
  return `${sign}${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
};

const utcOffsetToHours = (value: string | null) => {
  if (!value) {
    return null;
  }

  const match = value.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, sign, hour, minute] = match;
  const multiplier = sign === "-" ? -1 : 1;
  return multiplier * (Number(hour) + Number(minute) / 60);
};

const getUtcOffset = (timeZone: string | null | undefined, timestampSeconds: number | null | undefined) => {
  if (!timeZone) {
    return null;
  }

  try {
    const date = timestampSeconds ? new Date(timestampSeconds * 1000) : new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset" as Intl.DateTimeFormatOptions["timeZoneName"],
    }).formatToParts(date);
    const offset = parts.find((part) => part.type === "timeZoneName")?.value;

    return parseOffset(offset);
  } catch {
    return null;
  }
};

const normalizeStatus = (status: string | null | undefined) => {
  if (!status) {
    return null;
  }

  const lowerStatus = status.toLowerCase();
  return lowerStatus === "en-route" ? "active" : lowerStatus;
};

const toNumber = (value: number | string | null | undefined) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const getCoordinates = (airport: AirLabsAirport | null) => {
  const latitude = toNumber(airport?.lat);
  const longitude = toNumber(airport?.lng);

  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
};

const getAirportCode = (airport: AirLabsAirport | null, fallbackIata?: string | null, fallbackIcao?: string | null) => ({
  iata: airport?.iata_code ?? fallbackIata ?? null,
  icao: airport?.icao_code ?? fallbackIcao ?? null,
});

const getAirportDisplayLabel = (location: Pick<NormalizedLocation, "airportName" | "cityName" | "airportCode">) => {
  const primaryCode = location.airportCode.iata ?? location.airportCode.icao;
  const name = location.airportName ?? location.cityName ?? "Airport";
  const city = location.cityName && location.cityName !== name ? ` - ${location.cityName}` : "";
  return `${name}${primaryCode ? ` (${primaryCode})` : ""}${city}`;
};

const normalizeLocation = (
  airport: AirLabsAirport | null,
  fallbackIata: string | null | undefined,
  fallbackIcao: string | null | undefined,
  timestampSeconds: number | null | undefined,
): NormalizedLocation => {
  const utcOffset = getUtcOffset(airport?.timezone, timestampSeconds);
  const location = {
    airportName: airport?.name ?? null,
    cityName: airport?.city ?? null,
    airportCode: getAirportCode(airport, fallbackIata, fallbackIcao),
    countryCode: airport?.country_code ?? null,
    coordinates: getCoordinates(airport),
    displayLabel: "",
    timezone: {
      iana: airport?.timezone ?? null,
      utcOffset,
      utcOffsetHours: utcOffsetToHours(utcOffset),
    },
  };

  return {
    ...location,
    displayLabel: getAirportDisplayLabel(location),
  };
};

const normalizeAirportSuggestion = (
  airport: AirLabsAirport,
  matchedBy: string,
  fetchedAt: string,
): AviationAirportSuggestion => {
  const normalized = normalizeLocation(airport, airport.iata_code, airport.icao_code, null);
  const airportCode = normalized.airportCode.iata ?? normalized.airportCode.icao ?? normalized.airportName ?? normalized.cityName ?? fetchedAt;

  return {
    provider: "airlabs",
    id: `airlabs-airport-${String(airportCode).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    ...normalized,
    source: {
      matchedBy,
      fetchedAt,
    },
  };
};

const getFlightNumber = (flight: AirLabsFlight) => {
  if (flight.flight_iata) {
    return flight.flight_iata;
  }

  if (flight.flight_icao) {
    return flight.flight_icao;
  }

  if (flight.airline_iata && flight.flight_number) {
    return `${flight.airline_iata}${flight.flight_number}`;
  }

  return flight.flight_number ? String(flight.flight_number) : null;
};

const getIsoFromTimestamp = (timestampSeconds: number | null | undefined) => {
  return timestampSeconds ? new Date(timestampSeconds * 1000).toISOString() : null;
};

const getDurationMinutes = (flight: AirLabsFlight) => {
  if (typeof flight.duration === "number") {
    return flight.duration;
  }

  if (flight.dep_time_ts && flight.arr_time_ts) {
    return Math.round((flight.arr_time_ts - flight.dep_time_ts) / 60);
  }

  return null;
};

const dedupeAirports = (airports: AirLabsAirport[]) => {
  const seen = new Set<string>();

  return airports.filter((airport) => {
    const key = [airport.iata_code, airport.icao_code, airport.name, airport.city]
      .filter(Boolean)
      .join("|")
      .toLowerCase();

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

export const searchAirLabsAirports = async (
  query: string,
  airLabsOptions: AirLabsOptions = {},
  limit = 8,
): Promise<AviationAirportSuggestion[]> => {
  const parsed = parseAirportSearchQuery(query);
  const options = resolveOptions(airLabsOptions);
  const directLookups: Array<Promise<AirLabsAirport | null>> = [];

  if (/^[A-Z]{3}$/.test(parsed.normalized)) {
    directLookups.push(safeFetchAirport(parsed.normalized, "iata", options));
  }

  if (/^[A-Z]{4}$/.test(parsed.normalized)) {
    directLookups.push(safeFetchAirport(parsed.normalized, "icao", options));
  }

  const [directAirports, suggestPayload] = await Promise.all([
    Promise.all(directLookups),
    fetchAirLabs<AirLabsSuggestResponse>(
      "suggest",
      {
        q: parsed.raw,
        limit: String(limit),
        fields: airportFields,
      },
      options,
    ).catch((error) => {
      if (error instanceof AirLabsIntegrationError && error.status === 404) {
        return null;
      }

      throw error;
    }),
  ]);

  const suggested = suggestPayload?.response;
  const airports = dedupeAirports([
    ...directAirports.filter((airport): airport is AirLabsAirport => Boolean(airport)),
    ...(suggested?.airports ?? []),
    ...(suggested?.airports_by_cities ?? []),
    ...(suggested?.airports_by_countries ?? []),
  ]);
  const fetchedAt = new Date().toISOString();

  return airports
    .slice(0, limit)
    .map((airport) => normalizeAirportSuggestion(airport, "airport_search", fetchedAt));
};

export const lookupAirLabsFlight = async (
  query: string,
  airLabsOptions: AirLabsOptions = {},
): Promise<AviationFlightSuggestion> => {
  const parsed = parseUserQuery(query);
  const options = resolveOptions(airLabsOptions);
  const flight = await fetchFlight(parsed, options);
  const originCodeType: AirportCodeType = flight.dep_iata ? "iata" : "icao";
  const destinationCodeType: AirportCodeType = flight.arr_iata ? "iata" : "icao";
  const [origin, destination, airline] = await Promise.all([
    safeFetchAirport(flight.dep_iata ?? flight.dep_icao, originCodeType, options),
    safeFetchAirport(flight.arr_iata ?? flight.arr_icao, destinationCodeType, options),
    safeFetchAirline(flight, options),
  ]);
  const fetchedAt = new Date().toISOString();
  const originLocation = normalizeLocation(origin, flight.dep_iata, flight.dep_icao, flight.dep_time_ts);
  const destinationLocation = normalizeLocation(destination, flight.arr_iata, flight.arr_icao, flight.arr_time_ts);
  const flightNumber = getFlightNumber(flight);

  return {
    provider: "airlabs",
    id: `airlabs-flight-${(flightNumber ?? parsed.normalized).toLowerCase()}`,
    query: {
      raw: parsed.raw,
      type: parsed.type,
      normalized: parsed.normalized,
    },
    flight: {
      flightNumber,
      airlineName: airline?.name ?? null,
      airlineCode: {
        iata: airline?.iata_code ?? flight.airline_iata ?? null,
        icao: airline?.icao_code ?? flight.airline_icao ?? null,
      },
      status: normalizeStatus(flight.status),
      rawStatus: flight.status ?? null,
    },
    origin: {
      provider: "airlabs",
      id: `airlabs-airport-${(originLocation.airportCode.iata ?? originLocation.airportCode.icao ?? "origin").toLowerCase()}`,
      ...originLocation,
      source: {
        matchedBy: "flight_origin",
        fetchedAt,
      },
    },
    destination: {
      provider: "airlabs",
      id: `airlabs-airport-${(destinationLocation.airportCode.iata ?? destinationLocation.airportCode.icao ?? "destination").toLowerCase()}`,
      ...destinationLocation,
      source: {
        matchedBy: "flight_destination",
        fetchedAt,
      },
    },
    schedule: {
      departure: {
        local: flight.dep_time ?? null,
        utc: flight.dep_time_utc ?? getIsoFromTimestamp(flight.dep_time_ts),
        timestamp: flight.dep_time_ts ?? null,
      },
      arrival: {
        local: flight.arr_time ?? null,
        utc: flight.arr_time_utc ?? getIsoFromTimestamp(flight.arr_time_ts),
        timestamp: flight.arr_time_ts ?? null,
      },
      durationMinutes: getDurationMinutes(flight),
    },
    source: {
      fetchedAt,
    },
  };
};
