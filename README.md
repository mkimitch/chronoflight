# Chronoflight

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `pnpm install`
2. Set the required API keys in `.env` (refer to `.env.example`)
3. Run the app:
   `pnpm dev`

## Flight Data Integration

This project uses AirLabs for flight/location lookup. AirLabs is the best fit here because its official Free plan includes 1,000 monthly queries and the needed Airlines, Airports, Real-Time Flights, and Live Schedules endpoints. AeroDataBox is solid but its free Basic plan is 600 monthly API units and flight status is a Tier 2 endpoint; Amadeus has free monthly quota, but requires OAuth and its test environment uses limited/non-live data for flight status.

Set `AIRLABS_API_KEY` in `.env`, then run:

```sh
pnpm flight:lookup DL123
pnpm flight:lookup MSP-JFK
```

If pnpm blocks scripts with `ERR_PNPM_IGNORED_BUILDS` in this workspace, run `pnpm --config.verify-deps-before-run=false flight:lookup DL123` after dependencies are installed, or approve the existing esbuild builds with `pnpm approve-builds --all`.

The command returns normalized JSON with origin/destination city, IATA/ICAO codes, IANA timezone, UTC offset, flight number, airline name, and normalized status.


