import { describe, expect, it } from "vitest";
import { buildMatchScorecards } from "../src/lib/matchScorecards";
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

function buildChart(longitudes: Partial<Record<PlanetName, number>>): ChartResult {
  const planets = {} as ChartResult["planets"];
  for (const planet of PLANETS) {
    planets[planet] = toPlacement(longitudes[planet] ?? 0);
  }
  return {
    input: {
      date: "2001-03-03",
      time: "12:00",
      city: "Test",
      country: "TS",
      daylight_saving: "auto",
    },
    normalized: {
      localDateTime: "2001-03-03T12:00",
      utcDateTime: "2001-03-03T12:00:00Z",
      timezone: "UTC",
      offsetMinutes: 0,
      daylightSaving: false,
      location: { lat: 0, lon: 0 },
    },
    planets,
    aspects: [],
  };
}

describe("buildMatchScorecards", () => {
  it("returns exactly 3 area cards", () => {
    const chartA = buildChart({ Sun: 0, Moon: 120, Venus: 60, Mars: 180 });
    const chartB = buildChart({ Sun: 180, Moon: 300, Venus: 240, Mars: 0 });
    const comparison = buildChartComparison(chartA, chartB, "en", "romantic");

    const scorecards = buildMatchScorecards(comparison, "en", "romantic");

    expect(scorecards).toHaveLength(3);
    expect(scorecards.map((card) => card.area)).toEqual(["love", "friends", "family"]);
  });

  it("keeps score values in 0-100 and computes support/tension highlights", () => {
    const chartA = buildChart({ Sun: 0, Moon: 30, Venus: 60, Mars: 90, Saturn: 150, Uranus: 270 });
    const chartB = buildChart({ Sun: 180, Moon: 210, Venus: 240, Mars: 270, Saturn: 330, Uranus: 90 });
    const comparison = buildChartComparison(chartA, chartB, "en", "romantic");

    const scorecards = buildMatchScorecards(comparison, "en", "romantic");

    for (const card of scorecards) {
      expect(card.score).toBeGreaterThanOrEqual(0);
      expect(card.score).toBeLessThanOrEqual(100);
      expect(card.summary.length).toBeGreaterThan(0);
    }

    expect(scorecards.some((card) => card.topSupportAspect)).toBe(true);
    expect(scorecards.some((card) => card.topTensionAspect)).toBe(true);
  });

  it("localizes output for Portuguese and adapts friend-mode love area label", () => {
    const chartA = buildChart({ Sun: 0 });
    const chartB = buildChart({ Sun: 180 });
    const comparison = buildChartComparison(chartA, chartB, "pt", "friend");

    const scorecards = buildMatchScorecards(comparison, "pt", "friend");

    expect(scorecards).toHaveLength(3);
    expect(scorecards[0].summary.startsWith("Vibe")).toBe(true);
  });

  it("returns neutral summaries when there are no synastry aspects", () => {
    const chartA = buildChart({ Sun: 0, Moon: 10, Mercury: 20, Venus: 30, Mars: 40 });
    const chartB = buildChart({ Sun: 13, Moon: 23, Mercury: 33, Venus: 43, Mars: 53 });
    const comparison = buildChartComparison(chartA, chartB, "en", "romantic");
    comparison.aspects = [];

    const scorecards = buildMatchScorecards(comparison, "en", "romantic");

    expect(scorecards.every((card) => card.score === 50)).toBe(true);
    expect(scorecards.every((card) => card.topSupportAspect == null)).toBe(true);
    expect(scorecards.every((card) => card.topTensionAspect == null)).toBe(true);
  });
});
