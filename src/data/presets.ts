import { Itinerary } from "../types";

export const travelPresets: Itinerary[] = [
  {
    id: "msp-yul-ath",
    name: "Minneapolis to Athens (via Montreal)",
    description: "The classic Transatlantic journey from the US Midwest to Greece. Includes a 7-hour layover in Montreal, showcasing a gradual shift from afternoon to overnight flight legs.",
    startHourLocal: 8, // 8:00 AM local time at origin
    startDayName: "Thursday",
    locations: [
      { id: "msp", name: "Minneapolis", code: "MSP", timezoneLabel: "CDT", offset: -5 },
      { id: "yul", name: "Montreal", code: "YUL", timezoneLabel: "EDT", offset: -4 },
      { id: "ath", name: "Athens", code: "ATH", timezoneLabel: "EEST", offset: 3 },
    ],
    segments: [
      {
        id: "f1",
        flightNumber: "AC8102",
        fromLocationId: "msp",
        toLocationId: "yul",
        departureTripHour: 0, // starts at 8:00 AM MSP (which is 9:00 AM YUL)
        duration: 3, // arrives at 12:00 PM local YUL (11:00 AM MSP)
      },
      {
        id: "f2",
        flightNumber: "AC1902",
        fromLocationId: "yul",
        toLocationId: "ath",
        departureTripHour: 10, // departs at 7:00 PM local YUL (6:00 PM MSP, 2:00 AM ATH)
        duration: 8, // arrives at 10:00 AM local ATH next day
      }
    ],
    sleepPreferences: {
      targetBedtime: 22, // 10 PM
      targetWakeTime: 6, // 6 AM
      preAdjust: true
    }
  },
  {
    id: "sfo-nrt-sin",
    name: "San Francisco to Singapore (via Tokyo)",
    description: "A major Transpacific crossing that spans the International Date Line. Highlights the extreme jump of +16 hours, showing how a flight departing at noon arrives in the late afternoon of the following calendar day.",
    startHourLocal: 11, // 11:00 AM PDT
    startDayName: "Monday",
    locations: [
      { id: "sfo", name: "San Francisco", code: "SFO", timezoneLabel: "PDT", offset: -7 },
      { id: "nrt", name: "Tokyo", code: "NRT", timezoneLabel: "JST", offset: 9 },
      { id: "sin", name: "Singapore", code: "SIN", timezoneLabel: "SGT", offset: 8 },
    ],
    segments: [
      {
        id: "f3",
        flightNumber: "NH007",
        fromLocationId: "sfo",
        toLocationId: "nrt",
        departureTripHour: 1, // departs 12:00 PM SFO (Monday)
        duration: 11, // flight duration 11 hrs -> arrives 3:00 PM JST (Tuesday)
      },
      {
        id: "f4",
        flightNumber: "SQ011",
        fromLocationId: "nrt",
        toLocationId: "sin",
        departureTripHour: 16, // departs 7:00 PM JST (Tuesday)
        duration: 7.5, // arrives 2:30 AM SGT (Wednesday)
      }
    ],
    sleepPreferences: {
      targetBedtime: 23, // 11 PM
      targetWakeTime: 7, // 7 AM
      preAdjust: false
    }
  },
  {
    id: "jfk-lhr",
    name: "New York to London (Red-Eye Sprint)",
    description: "A fast, high-intensity eastbound flight across 5 timezones. Known as a 'sleep-disrupter' because the short 7-hour flight leaves little time to get meaningful rest before arriving in London early in the morning.",
    startHourLocal: 18, // 6:00 PM EDT
    startDayName: "Friday",
    locations: [
      { id: "jfk", name: "New York", code: "JFK", timezoneLabel: "EDT", offset: -4 },
      { id: "lhr", name: "London", code: "LHR", timezoneLabel: "BST", offset: 1 },
    ],
    segments: [
      {
        id: "f5",
        flightNumber: "BA112",
        fromLocationId: "jfk",
        toLocationId: "lhr",
        departureTripHour: 2, // departs 8:00 PM JFK
        duration: 7, // arrives 8:00 AM BST next day
      }
    ],
    sleepPreferences: {
      targetBedtime: 22,
      targetWakeTime: 6,
      preAdjust: true
    }
  }
];
