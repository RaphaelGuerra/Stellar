import { describe, expect, it } from "vitest";
import { buildAstralMapModelCompatibility, buildAstralMapModelSingle } from "../src/lib/astralMap";
import { buildChartComparison } from "../src/lib/synastry";
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

function buildChart(longitudes: Partial<Record<PlanetName, number>>, ascendantLongitude = 15): ChartResult {
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
      ascendant: toPlacement(ascendantLongitude),
    },
    aspects: [
      { a: "Sun", b: "Moon", type: "Square", orb: 1 },
      { a: "Venus", b: "Mars", type: "Trine", orb: 2 },
    ],
  };
}

describe("astral map model builders", () => {
  it("builds equal-house cusps from ascendant longitude", () => {
    const chart = buildChart({ Sun: 20 }, 37);
    const model = buildAstralMapModelSingle(chart);

    expect(model.houses).toHaveLength(12);
    expect(model.houses[0].house).toBe(1);
    expect(model.houses[0].cuspLongitude).toBe(37);
    expect(model.houses[1].cuspLongitude).toBe(67);
    expect(model.houses[11].cuspLongitude).toBe(7);
    expect(model.houses.every((house) => house.beta)).toBe(true);
  });

  it("builds deterministic planet coordinates", () => {
    const chart = buildChart({ Sun: 45, Moon: 225 }, 12);
    const first = buildAstralMapModelSingle(chart);
    const second = buildAstralMapModelSingle(chart);

    expect(first.planets).toEqual(second.planets);
    expect(first.planets).toHaveLength(10);
  });

  it("builds single-map lines from natal aspects", () => {
    const chart = buildChart({ Sun: 0, Moon: 90 }, 10);
    const model = buildAstralMapModelSingle(chart);

    expect(model.lines.length).toBeGreaterThan(0);
    expect(model.lines.some((line) => line.type === "Square")).toBe(true);
    expect(model.lines.every((line) => line.from.chart === "A" && line.to.chart === "A")).toBe(true);
  });

  it("builds compatibility lines from cross-chart synastry aspects", () => {
    const chartA = buildChart({ Sun: 0, Moon: 120 }, 5);
    const chartB = buildChart({ Sun: 180, Moon: 300 }, 30);
    const comparison = buildChartComparison(chartA, chartB, "en", "romantic");
    const model = buildAstralMapModelCompatibility(chartA, chartB, comparison);

    expect(model.mode).toBe("compatibility");
    expect(model.planets.some((point) => point.chart === "A")).toBe(true);
    expect(model.planets.some((point) => point.chart === "B")).toBe(true);
    expect(model.lines.length).toBe((comparison.aspects ?? []).length);
  });

  it("falls back to 0deg Aries when ascendant is unavailable", () => {
    const chart = buildChart({ Sun: 10 }, 0);
    delete chart.angles;

    const model = buildAstralMapModelSingle(chart);

    expect(model.usedAscendantFallback).toBe(true);
    expect(model.houses[0].cuspLongitude).toBe(0);
    expect(model.houses[0].sign).toBe("Aries");
  });
});
