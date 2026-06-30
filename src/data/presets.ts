import type { Itinerary, LocationConfig } from "../types";

type AirportPreset = Omit<LocationConfig, "id" | "name">;

const AIRPORTS = {
  ATH: {
    airportName: "Athens International Airport",
    code: "ATH",
    iataCode: "ATH",
    icaoCode: "LGAV",
    countryCode: "GR",
    coordinates: { latitude: 37.9364, longitude: 23.9445 },
    timezoneIana: "Europe/Athens",
    timezoneLabel: "EEST",
    offset: 3
  },
  DEN: {
    airportName: "Denver International Airport",
    code: "DEN",
    iataCode: "DEN",
    icaoCode: "KDEN",
    countryCode: "US",
    coordinates: { latitude: 39.8561, longitude: -104.6737 },
    timezoneIana: "America/Denver",
    timezoneLabel: "MDT",
    offset: -6
  },
  JFK: {
    airportName: "John F. Kennedy International Airport",
    code: "JFK",
    iataCode: "JFK",
    icaoCode: "KJFK",
    countryCode: "US",
    coordinates: { latitude: 40.6413, longitude: -73.7781 },
    timezoneIana: "America/New_York",
    timezoneLabel: "EDT",
    offset: -4
  },
  LAX: {
    airportName: "Los Angeles International Airport",
    code: "LAX",
    iataCode: "LAX",
    icaoCode: "KLAX",
    countryCode: "US",
    coordinates: { latitude: 33.9416, longitude: -118.4085 },
    timezoneIana: "America/Los_Angeles",
    timezoneLabel: "PDT",
    offset: -7
  },
  LHR: {
    airportName: "Heathrow Airport",
    code: "LHR",
    iataCode: "LHR",
    icaoCode: "EGLL",
    countryCode: "GB",
    coordinates: { latitude: 51.47, longitude: -0.4543 },
    timezoneIana: "Europe/London",
    timezoneLabel: "BST",
    offset: 1
  },
  MSP: {
    airportName: "Minneapolis-Saint Paul International Airport",
    code: "MSP",
    iataCode: "MSP",
    icaoCode: "KMSP",
    countryCode: "US",
    coordinates: { latitude: 44.8848, longitude: -93.2223 },
    timezoneIana: "America/Chicago",
    timezoneLabel: "CDT",
    offset: -5
  },
  NRT: {
    airportName: "Narita International Airport",
    code: "NRT",
    iataCode: "NRT",
    icaoCode: "RJAA",
    countryCode: "JP",
    coordinates: { latitude: 35.7719, longitude: 140.3929 },
    timezoneIana: "Asia/Tokyo",
    timezoneLabel: "JST",
    offset: 9
  },
  SFO: {
    airportName: "San Francisco International Airport",
    code: "SFO",
    iataCode: "SFO",
    icaoCode: "KSFO",
    countryCode: "US",
    coordinates: { latitude: 37.6213, longitude: -122.379 },
    timezoneIana: "America/Los_Angeles",
    timezoneLabel: "PDT",
    offset: -7
  },
  SIN: {
    airportName: "Singapore Changi Airport",
    code: "SIN",
    iataCode: "SIN",
    icaoCode: "WSSS",
    countryCode: "SG",
    coordinates: { latitude: 1.3644, longitude: 103.9915 },
    timezoneIana: "Asia/Singapore",
    timezoneLabel: "SGT",
    offset: 8
  },
  SYD: {
    airportName: "Sydney Kingsford Smith Airport",
    code: "SYD",
    iataCode: "SYD",
    icaoCode: "YSSY",
    countryCode: "AU",
    coordinates: { latitude: -33.9399, longitude: 151.1753 },
    timezoneIana: "Australia/Sydney",
    timezoneLabel: "AEST",
    offset: 10
  },
  YUL: {
    airportName: "Montreal-Trudeau International Airport",
    code: "YUL",
    iataCode: "YUL",
    icaoCode: "CYUL",
    countryCode: "CA",
    coordinates: { latitude: 45.4706, longitude: -73.7408 },
    timezoneIana: "America/Toronto",
    timezoneLabel: "EDT",
    offset: -4
  }
} satisfies Record<string, AirportPreset>;

const makeLocation = (id: string, name: string, airport: AirportPreset): LocationConfig => ({
  id,
  name,
  ...airport
});

export const multiLegOvernightTripFixture: Itinerary = {
  id: "msp-yul-ath",
  name: "Minneapolis to Athens (via Montreal)",
  description: "Fixture for a multi-leg overnight trip with a layover, next-day arrival, IANA timezone IDs, cached UTC offsets, and airport coordinates.",
  startHourLocal: 8,
  startDayName: "Thursday",
  locations: [
    makeLocation("msp", "Minneapolis", AIRPORTS.MSP),
    makeLocation("yul", "Montreal", AIRPORTS.YUL),
    makeLocation("ath", "Athens", AIRPORTS.ATH)
  ],
  segments: [
    {
      id: "f1",
      flightNumber: "AC8102",
      fromLocationId: "msp",
      toLocationId: "yul",
      departureTripHour: 0,
      duration: 3,
      durationMinutes: 180,
      schedule: {
        departure: {
          localDateTime: "2026-07-16T08:00:00-05:00",
          utcDateTime: "2026-07-16T13:00:00Z",
          timezoneIana: "America/Chicago",
          utcOffsetHours: -5
        },
        arrival: {
          localDateTime: "2026-07-16T12:00:00-04:00",
          utcDateTime: "2026-07-16T16:00:00Z",
          timezoneIana: "America/Toronto",
          utcOffsetHours: -4
        }
      }
    },
    {
      id: "f2",
      flightNumber: "AC1902",
      fromLocationId: "yul",
      toLocationId: "ath",
      departureTripHour: 10,
      duration: 8,
      durationMinutes: 480,
      schedule: {
        departure: {
          localDateTime: "2026-07-16T19:00:00-04:00",
          utcDateTime: "2026-07-16T23:00:00Z",
          timezoneIana: "America/Toronto",
          utcOffsetHours: -4
        },
        arrival: {
          localDateTime: "2026-07-17T10:00:00+03:00",
          utcDateTime: "2026-07-17T07:00:00Z",
          timezoneIana: "Europe/Athens",
          utcOffsetHours: 3
        }
      }
    }
  ],
  timelineEvents: [
    {
      id: "msp-yul-ath-depart-msp",
      type: "departure",
      title: "Depart MSP",
      tripHour: 0,
      locationId: "msp",
      segmentId: "f1",
      localDateTime: "2026-07-16T08:00:00-05:00"
    },
    {
      id: "msp-yul-ath-layover-yul",
      type: "layover",
      title: "Layover in Montreal",
      tripHour: 3,
      endTripHour: 10,
      locationId: "yul",
      localDateTime: "2026-07-16T12:00:00-04:00"
    },
    {
      id: "msp-yul-ath-arrive-ath",
      type: "arrival",
      title: "Arrive in Athens next day",
      tripHour: 18,
      locationId: "ath",
      segmentId: "f2",
      localDateTime: "2026-07-17T10:00:00+03:00"
    }
  ],
  sleepPreferences: {
    targetBedtime: 22,
    targetWakeTime: 6,
    preAdjust: true
  }
};

export const simpleNonstopTripFixture: Itinerary = {
  id: "jfk-lhr",
  name: "New York to London (Red-Eye Sprint)",
  description: "Fixture for a simple nonstop overnight trip with source schedule moments and a next-day local arrival.",
  startHourLocal: 18,
  startDayName: "Friday",
  locations: [
    makeLocation("jfk", "New York", AIRPORTS.JFK),
    makeLocation("lhr", "London", AIRPORTS.LHR)
  ],
  segments: [
    {
      id: "f5",
      flightNumber: "BA112",
      fromLocationId: "jfk",
      toLocationId: "lhr",
      departureTripHour: 2,
      duration: 7,
      durationMinutes: 420,
      schedule: {
        departure: {
          localDateTime: "2026-07-17T20:00:00-04:00",
          utcDateTime: "2026-07-18T00:00:00Z",
          timezoneIana: "America/New_York",
          utcOffsetHours: -4
        },
        arrival: {
          localDateTime: "2026-07-18T08:00:00+01:00",
          utcDateTime: "2026-07-18T07:00:00Z",
          timezoneIana: "Europe/London",
          utcOffsetHours: 1
        }
      }
    }
  ],
  timelineEvents: [
    {
      id: "jfk-lhr-depart-jfk",
      type: "departure",
      title: "Depart JFK",
      tripHour: 2,
      locationId: "jfk",
      segmentId: "f5",
      localDateTime: "2026-07-17T20:00:00-04:00"
    },
    {
      id: "jfk-lhr-arrive-lhr",
      type: "arrival",
      title: "Arrive in London next day",
      tripHour: 9,
      locationId: "lhr",
      segmentId: "f5",
      localDateTime: "2026-07-18T08:00:00+01:00"
    }
  ],
  sleepPreferences: {
    targetBedtime: 22,
    targetWakeTime: 6,
    preAdjust: true
  }
};

export const travelPresets: Itinerary[] = [
  {
    id: "sydney-flight-2026-outbound",
    name: "Sydney Flight - MSP to SYD",
    description: "Confirmed Delta Air Lines outbound itinerary for 4 travelers. MSP -> SYD via LAX, departing Mon, Jul 06, 2026 and arriving Wed, Jul 08, 2026. Fare class: Delta Main Basic. Trip ID: 1011154358.",
    startHourLocal: 18 + 58 / 60,
    startDayName: "Monday",
    bookingDetails: {
      airline: "Delta Air Lines",
      airlineReference: "HLYKSE",
      agencyReference: "JXJRYR",
      bookedDate: "Dec 24, 2025",
      fareClass: "Delta Main Basic",
      route: "Minneapolis/St Paul (MSP) -> Sydney (SYD)",
      status: "Confirmed",
      travelDates: "Mon, Jul 06, 2026 - Wed, Jul 08, 2026",
      travelers: 4,
      tripId: "1011154358"
    },
    locations: [
      makeLocation("sydney-outbound-msp", "Minneapolis/St Paul", AIRPORTS.MSP),
      makeLocation("sydney-outbound-lax", "Los Angeles", AIRPORTS.LAX),
      makeLocation("sydney-outbound-syd", "Sydney", AIRPORTS.SYD)
    ],
    segments: [
      {
        id: "sydney-outbound-dl2122",
        airline: "Delta Air Lines",
        arrivalLabel: "Los Angeles (LAX), Mon, Jul 06, 2026, 8:55 PM",
        departureLabel: "Minneapolis/St Paul (MSP), Mon, Jul 06, 2026, 6:58 PM",
        durationMinutes: 237,
        flightNumber: "DL 2122",
        fromLocationId: "sydney-outbound-msp",
        operatedBy: "Delta Air Lines Inc",
        schedule: {
          departure: {
            localDateTime: "2026-07-06T18:58:00-05:00",
            utcDateTime: "2026-07-06T23:58:00Z",
            timezoneIana: "America/Chicago",
            utcOffsetHours: -5
          },
          arrival: {
            localDateTime: "2026-07-06T20:55:00-07:00",
            utcDateTime: "2026-07-07T03:55:00Z",
            timezoneIana: "America/Los_Angeles",
            utcOffsetHours: -7
          }
        },
        toLocationId: "sydney-outbound-lax",
        departureTripHour: 0,
        duration: 3 + 57 / 60
      },
      {
        id: "sydney-outbound-dl41",
        airline: "Delta Air Lines",
        arrivalLabel: "Sydney (SYD), Wed, Jul 08, 2026, 6:50 AM",
        departureLabel: "Los Angeles (LAX), Mon, Jul 06, 2026, 10:55 PM",
        durationMinutes: 895,
        flightNumber: "DL 41",
        fromLocationId: "sydney-outbound-lax",
        note: "2nd day arrival",
        operatedBy: "Delta Air Lines Inc",
        schedule: {
          departure: {
            localDateTime: "2026-07-06T22:55:00-07:00",
            utcDateTime: "2026-07-07T05:55:00Z",
            timezoneIana: "America/Los_Angeles",
            utcOffsetHours: -7
          },
          arrival: {
            localDateTime: "2026-07-08T06:50:00+10:00",
            utcDateTime: "2026-07-07T20:50:00Z",
            timezoneIana: "Australia/Sydney",
            utcOffsetHours: 10
          }
        },
        toLocationId: "sydney-outbound-syd",
        departureTripHour: 5 + 57 / 60,
        duration: 14 + 55 / 60
      }
    ],
    sleepPreferences: {
      targetBedtime: 22,
      targetWakeTime: 6,
      preAdjust: true
    }
  },
  {
    id: "sydney-flight-2026-return",
    name: "Sydney Flight - SYD to MSP",
    description: "Confirmed Delta Air Lines return itinerary for 4 travelers. SYD -> MSP via LAX on Wed, Jul 29, 2026. Fare class: Delta Main Basic. Trip ID: 1011154358.",
    startHourLocal: 9 + 15 / 60,
    startDayName: "Wednesday",
    bookingDetails: {
      airline: "Delta Air Lines",
      airlineReference: "HLYKSE",
      agencyReference: "JXJRYR",
      bookedDate: "Dec 24, 2025",
      fareClass: "Delta Main Basic",
      route: "Sydney (SYD) -> Minneapolis/St Paul (MSP)",
      status: "Confirmed",
      travelDates: "Wed, Jul 29, 2026",
      travelers: 4,
      tripId: "1011154358"
    },
    locations: [
      makeLocation("sydney-return-syd", "Sydney", AIRPORTS.SYD),
      makeLocation("sydney-return-lax", "Los Angeles", AIRPORTS.LAX),
      makeLocation("sydney-return-msp", "Minneapolis/St Paul", AIRPORTS.MSP)
    ],
    segments: [
      {
        id: "sydney-return-dl40",
        airline: "Delta Air Lines",
        arrivalLabel: "Los Angeles (LAX), Wed, Jul 29, 2026, 6:05 AM",
        departureLabel: "Sydney (SYD), Wed, Jul 29, 2026, 9:15 AM",
        durationMinutes: 830,
        flightNumber: "DL 40",
        fromLocationId: "sydney-return-syd",
        operatedBy: "Delta Air Lines Inc",
        schedule: {
          departure: {
            localDateTime: "2026-07-29T09:15:00+10:00",
            utcDateTime: "2026-07-28T23:15:00Z",
            timezoneIana: "Australia/Sydney",
            utcOffsetHours: 10
          },
          arrival: {
            localDateTime: "2026-07-29T06:05:00-07:00",
            utcDateTime: "2026-07-29T13:05:00Z",
            timezoneIana: "America/Los_Angeles",
            utcOffsetHours: -7
          }
        },
        toLocationId: "sydney-return-lax",
        departureTripHour: 0,
        duration: 13 + 50 / 60
      },
      {
        id: "sydney-return-dl799",
        airline: "Delta Air Lines",
        arrivalLabel: "Minneapolis/St Paul (MSP), Wed, Jul 29, 2026, 1:42 PM",
        departureLabel: "Los Angeles (LAX), Wed, Jul 29, 2026, 8:05 AM",
        durationMinutes: 217,
        flightNumber: "DL 799",
        fromLocationId: "sydney-return-lax",
        operatedBy: "Delta Air Lines Inc",
        schedule: {
          departure: {
            localDateTime: "2026-07-29T08:05:00-07:00",
            utcDateTime: "2026-07-29T15:05:00Z",
            timezoneIana: "America/Los_Angeles",
            utcOffsetHours: -7
          },
          arrival: {
            localDateTime: "2026-07-29T13:42:00-05:00",
            utcDateTime: "2026-07-29T18:42:00Z",
            timezoneIana: "America/Chicago",
            utcOffsetHours: -5
          }
        },
        toLocationId: "sydney-return-msp",
        departureTripHour: 15 + 50 / 60,
        duration: 3 + 37 / 60
      }
    ],
    sleepPreferences: {
      targetBedtime: 22,
      targetWakeTime: 6,
      preAdjust: true
    }
  },
  multiLegOvernightTripFixture,
  {
    id: "sfo-nrt-sin",
    name: "San Francisco to Singapore (via Tokyo)",
    description: "A major Transpacific crossing that spans the International Date Line. Highlights the extreme jump of +16 hours, showing how a flight departing at noon arrives in the late afternoon of the following calendar day.",
    startHourLocal: 11,
    startDayName: "Monday",
    locations: [
      makeLocation("sfo", "San Francisco", AIRPORTS.SFO),
      makeLocation("nrt", "Tokyo", AIRPORTS.NRT),
      makeLocation("sin", "Singapore", AIRPORTS.SIN)
    ],
    segments: [
      {
        id: "f3",
        flightNumber: "NH007",
        fromLocationId: "sfo",
        toLocationId: "nrt",
        departureTripHour: 1,
        duration: 11
      },
      {
        id: "f4",
        flightNumber: "SQ011",
        fromLocationId: "nrt",
        toLocationId: "sin",
        departureTripHour: 16,
        duration: 7.5
      }
    ],
    sleepPreferences: {
      targetBedtime: 23,
      targetWakeTime: 7,
      preAdjust: false
    }
  },
  simpleNonstopTripFixture
];