import type { AviationAirportSuggestion, AviationFlightSuggestion } from "../types";

interface AviationSearchResponse<T> {
  results: T[];
}

interface AviationSearchErrorResponse {
  error?: {
    code?: string;
    message?: string;
    status?: number;
  };
}

const getErrorMessage = (payload: AviationSearchErrorResponse | null, fallback: string) => {
  return payload?.error?.message ?? fallback;
};

const fetchAviationResults = async <T>(
  path: string,
  query: string,
  signal?: AbortSignal
) => {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`${path}?${params.toString()}`, { signal });
  const payload = await response.json().catch(() => null) as AviationSearchResponse<T> | AviationSearchErrorResponse | null;

  if (!response.ok) {
    throw new Error(getErrorMessage(payload as AviationSearchErrorResponse | null, "Aviation search failed."));
  }

  return ((payload as AviationSearchResponse<T> | null)?.results ?? []);
};

export const searchAirports = (query: string, signal?: AbortSignal) => {
  return fetchAviationResults<AviationAirportSuggestion>("/api/aviation/airports", query, signal);
};

export const searchFlights = (query: string, signal?: AbortSignal) => {
  return fetchAviationResults<AviationFlightSuggestion>("/api/aviation/flights", query, signal);
};
