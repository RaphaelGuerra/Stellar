import { describe, expect, it } from "vitest";
import {
  buildAdvancedOverlaySummary,
  buildCompatibilityForecast,
} from "../src/lib/phase5";
import type { ChartResult, PlanetName, ZodiacSign } from "../src/lib/types";

const PLANETS: PlanetName[] = [
  "Sun",
  "Moon",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
  "Uranus",
  "Neptune",
  "Pluto",
];

const SIGNS: ZodiacSign[] = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];

function toPlacement(longitude: number) {
  const normalized = ((longitude % 360) + 360) % 360;
  const signIndex = Math.floor(normalized / 30);
  const degree = Math.round((normalized % 30) * 10) / 10;
  return {
    sign: SIGNS[signIndex],
    degree,
    longitude: normalized,
  };
}

function buildChart(longitudes: Partial<Record<PlanetName, number>>): ChartResult {
  const planets = {} as ChartResult["planets"];
  for (const planet of PLANETS) {
    planets[planet] = toPlacement(longitudes[planet] ?? 0);
  }
  return {
    input: {
      date: "2000-01-01",
      time: "12:00",
      city: "Test",
      country: "TS",
      daylight_saving: "auto",
    },
    normalized: {
      localDateTime: "2000-01-01T12:00",
      utcDateTime: "2000-01-01T12:00:00Z",
      timezone: "UTC",
      offsetMinutes: 0,
      daylightSaving: false,
      location: { lat: 0, lon: 0 },
    },
    planets,
    angles: {
      ascendant: toPlacement(32.5),
    },
    aspects: [],
  };
}

describe("phase5", () => {
  it("builds deterministic 7-day forecast with best/toughest days", () => {
    const chartA = buildChart({ Sun: 0, Moon: 30, Venus: 120 });
    const chartB = buildChart({ Sun: 180, Moon: 210, Venus: 300 });
    const forecast = buildCompatibilityForecast(chartA, chartB, 7, {
      locale: "en",
      duoMode: "romantic",
      now: new Date("2026-02-10T12:00:00Z"),
      timeZone: "UTC",
    });

    expect(forecast.days).toHaveLength(7);
    expect(forecast.bestDay.vibeScore).toBeGreaterThanOrEqual(0);
    expect(forecast.bestDay.vibeScore).toBeLessThanOrEqual(100);
    expect(forecast.toughestDay.riskScore).toBeGreaterThanOrEqual(0);
    expect(forecast.toughestDay.riskScore).toBeLessThanOrEqual(100);
  });

  it("builds 14-day forecast in Portuguese", () => {
    const chartA = buildChart({ Sun: 0 });
    const chartB = buildChart({ Sun: 180 });
    const forecast = buildCompatibilityForecast(chartA, chartB, 14, {
      locale: "pt",
      duoMode: "friend",
      now: new Date("2026-02-10T12:00:00Z"),
      timeZone: "UTC",
    });

    expect(forecast.days).toHaveLength(14);
    expect(forecast.days[0]?.summary.length).toBeGreaterThan(0);
  });

  it("builds advanced overlays for composite core and key midpoints", () => {
    const chartA = buildChart({ Sun: 10, Moon: 80, Venus: 140, Mars: 200 });
    const chartB = buildChart({ Sun: 190, Moon: 260, Venus: 320, Mars: 20 });
    const overlays = buildAdvancedOverlaySummary(chartA, chartB, "en");

    expect(overlays.compositeCore).toHaveLength(5);
    expect(overlays.midpointHighlights).toHaveLength(3);
    expect(overlays.compositeCore[0]?.label).toContain("composite");
    expect(overlays.midpointHighlights[0]?.label).toContain("midpoint");
  });
});
