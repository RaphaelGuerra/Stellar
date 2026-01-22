import type { ChartInput, ChartResult } from "./types";
import { resolveCity } from "./resolveCity";

export async function generateChart(input: ChartInput): Promise<ChartResult> {
  // Stub implementation with sample data
  const resolvedCity = resolveCity({ city: input.city, country: input.country });
  const daylightSaving =
    input.daylight_saving === "auto" ? false : input.daylight_saving;
  const localDateTime = `${input.date}T${input.time}`;

  return {
    input,
    normalized: {
      localDateTime,
      utcDateTime: `${localDateTime}:00Z`,
      timezone: resolvedCity.timezone,
      offsetMinutes: 0,
      daylightSaving,
      location: {
        lat: resolvedCity.lat,
        lon: resolvedCity.lon,
      },
    },
    planets: {
      Sun: { sign: "Sagittarius" },
      Moon: { sign: "Gemini" },
      Mercury: { sign: "Capricorn" },
      Venus: { sign: "Scorpio" },
      Mars: { sign: "Aries" },
      Jupiter: { sign: "Pisces" },
      Saturn: { sign: "Aquarius" },
      Uranus: { sign: "Taurus" },
      Neptune: { sign: "Pisces" },
      Pluto: { sign: "Capricorn" },
    },
    houses: [{ house: 1, sign: "Leo", degree: 14.2 }],
    aspects: [
      { a: "Sun", b: "Moon", type: "Opposition" },
      { a: "Venus", b: "Mars", type: "Trine" },
      { a: "Mercury", b: "Saturn", type: "Square" },
    ],
  };
}
