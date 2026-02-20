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
  it("returns exactly 4 cards with sun comparison at the end", () => {
    const chartA = buildChart({ Sun: 0, Moon: 120, Venus: 60, Mars: 180 });
    const chartB = buildChart({ Sun: 180, Moon: 300, Venus: 240, Mars: 0 });
    const comparison = buildChartComparison(chartA, chartB, "en", "romantic");

    const scorecards = buildMatchScorecards(comparison, "en", "romantic");

    expect(scorecards).toHaveLength(4);
    expect(scorecards.map((card) => card.area)).toEqual(["sun", "love", "friends", "family"]);
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

    expect(scorecards).toHaveLength(4);
    expect(scorecards[1].summary.startsWith("Vibe")).toBe(true);
  });

  it("returns neutral area summaries when there are no synastry aspects", () => {
    const chartA = buildChart({ Sun: 0, Moon: 10, Mercury: 20, Venus: 30, Mars: 40 });
    const chartB = buildChart({ Sun: 13, Moon: 23, Mercury: 33, Venus: 43, Mars: 53 });
    const comparison = buildChartComparison(chartA, chartB, "en", "romantic");
    comparison.aspects = [];

    const scorecards = buildMatchScorecards(comparison, "en", "romantic");
    const areaCards = scorecards.filter((card) => card.area !== "sun");

    expect(areaCards.every((card) => card.score === 50)).toBe(true);
    expect(areaCards.every((card) => card.topSupportAspect == null)).toBe(true);
    expect(areaCards.every((card) => card.topTensionAspect == null)).toBe(true);
  });

  it("highlights complementary opposites for strong same-planet opposition", () => {
    const chartA = buildChart({ Sun: 240 }); // Sagittarius
    const chartB = buildChart({ Sun: 60 }); // Gemini
    const comparison = buildChartComparison(chartA, chartB, "pt", "romantic");

    const scorecards = buildMatchScorecards(comparison, "pt", "romantic");
    const loveCard = scorecards.find((card) => card.area === "love");

    expect(loveCard).toBeDefined();
    expect(loveCard?.summary).toContain("opostos complementares");
    expect(loveCard?.summary).toContain("Sol em Sagitario x Sol em Gemeos");
    expect(loveCard?.topSupportAspect).toContain("Sol");
    expect(loveCard?.status).toBe("good");

    const sunCard = scorecards.find((card) => card.area === "sun");
    expect(sunCard).toBeDefined();
    expect(sunCard?.summary).toContain("opostos complementares");
    expect(sunCard?.summary).toContain("Sol em Sagitario x Sol em Gemeos");
  });

  it("applies the global Sun bonus to area cards when suns are complementary opposites", () => {
    const chartA = buildChart({ Sun: 240, Moon: 10, Venus: 30, Mars: 60, Mercury: 90 });
    const chartBNeutral = buildChart({ Sun: 300, Moon: 70, Venus: 120, Mars: 150, Mercury: 180 });
    const chartBOpposite = buildChart({ Sun: 60, Moon: 70, Venus: 120, Mars: 150, Mercury: 180 });

    const neutral = buildMatchScorecards(
      buildChartComparison(chartA, chartBNeutral, "en", "romantic"),
      "en",
      "romantic"
    );
    const opposite = buildMatchScorecards(
      buildChartComparison(chartA, chartBOpposite, "en", "romantic"),
      "en",
      "romantic"
    );

    const neutralLove = neutral.find((card) => card.area === "love");
    const oppositeLove = opposite.find((card) => card.area === "love");
    const oppositeSun = opposite.find((card) => card.area === "sun");
    expect(neutralLove).toBeDefined();
    expect(oppositeLove).toBeDefined();
    expect(oppositeSun).toBeDefined();
    expect((oppositeLove?.score ?? 0) - (neutralLove?.score ?? 0)).toBeGreaterThanOrEqual(12);
    expect(oppositeSun?.summary).toContain("complementary opposites");
  });
});
