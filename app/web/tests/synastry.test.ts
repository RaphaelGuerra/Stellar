import { describe, expect, it } from "vitest";
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
    const longitude = longitudes[planet] ?? 0;
    planets[planet] = toPlacement(longitude);
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
    aspects: [],
  };
}

describe("buildChartComparison", () => {
  it("computes cross-chart aspects and sorts by orb", () => {
    const chartA = buildChart({ Sun: 0, Moon: 90, Mercury: 10, Venus: 50, Mars: 130 });
    const chartB = buildChart({ Sun: 180, Moon: 0, Mercury: 70, Venus: 170, Mars: 310 });
    const comparison = buildChartComparison(chartA, chartB, "en");

    const sunOpposition = comparison.aspects?.find(
      (aspect) =>
        aspect.a.planet === "Sun" &&
        aspect.b.planet === "Sun" &&
        aspect.type === "Opposition"
    );
    expect(sunOpposition?.orb).toBe(0);

    const moonSquare = comparison.aspects?.find(
      (aspect) =>
        aspect.a.planet === "Moon" &&
        aspect.b.planet === "Moon" &&
        aspect.type === "Square"
    );
    expect(moonSquare?.orb).toBe(0);

    const orbs = (comparison.aspects ?? []).map((aspect) => aspect.orb ?? 0);
    const sortedOrbs = [...orbs].sort((left, right) => left - right);
    expect(orbs).toEqual(sortedOrbs);
  });

  it("creates synastry highlights from detected aspects", () => {
    const chartA = buildChart({ Sun: 0, Moon: 0 });
    const chartB = buildChart({ Sun: 0, Moon: 180 });
    const comparison = buildChartComparison(chartA, chartB, "pt");

    expect(comparison.highlights.length).toBeGreaterThan(0);
    expect(comparison.highlights[0]?.kind).toBe("synastry-aspect");
    expect(comparison.highlights[0]?.related?.aspect).toBeDefined();
  });

  it("does not truncate highlights when there are more than 24 aspects", () => {
    const chartA = buildChart({});
    const chartB = buildChart({});
    const comparison = buildChartComparison(chartA, chartB, "en");

    expect((comparison.aspects ?? []).length).toBeGreaterThan(24);
    expect(comparison.highlights.length).toBe(comparison.aspects?.length);
  });

  it("falls back to sign+degree when longitude is missing", () => {
    const chartA = buildChart({ Sun: 0 });
    const chartB = buildChart({ Sun: 0 });

    chartA.planets.Sun.sign = "Gemini";
    chartA.planets.Sun.degree = 0;
    delete chartA.planets.Sun.longitude;

    chartB.planets.Sun.sign = "Aries";
    chartB.planets.Sun.degree = 0;
    delete chartB.planets.Sun.longitude;

    const comparison = buildChartComparison(chartA, chartB, "en");
    const sunSextile = comparison.aspects?.find(
      (aspect) =>
        aspect.a.planet === "Sun" &&
        aspect.b.planet === "Sun" &&
        aspect.type === "Sextile"
    );
    expect(sunSextile?.orb).toBe(0);
  });

  it("adds plain-language life areas to highlights for easier reading", () => {
    const chartA = buildChart({ Uranus: 0 });
    const chartB = buildChart({ Mars: 60 });
    const comparison = buildChartComparison(chartA, chartB, "en");

    const uranusMarsSextile = comparison.highlights.find(
      (highlight) =>
        highlight.related?.aspect?.a.planet === "Uranus" &&
        highlight.related?.aspect?.b.planet === "Mars" &&
        highlight.related?.aspect?.type === "Sextile"
    );

    expect(uranusMarsSextile).toBeDefined();
    expect(uranusMarsSextile?.title).toBeTruthy();
    expect(uranusMarsSextile?.subtitle).toContain("Uranus");
    expect(uranusMarsSextile?.subtitle).toContain("Mars");
    expect(uranusMarsSextile?.tone).toBe("harmonious");
    expect(uranusMarsSextile?.text).toContain("Main areas:");
    expect(uranusMarsSextile?.tags).toContain("work");
    expect(uranusMarsSextile?.tags).toContain("friends");
    expect(uranusMarsSextile?.details?.length).toBeGreaterThan(0);
    expect(uranusMarsSextile?.details?.[0]?.title).toBe("Aspect decoded");
    expect(uranusMarsSextile?.details?.[1]?.title).toBe("Life areas");
    expect(uranusMarsSextile?.details?.[1]?.text).toContain("Work");
    expect(uranusMarsSextile?.details?.[1]?.text).toContain("Friends");
  });

  it("adds plain-language life areas in Portuguese output too", () => {
    const chartA = buildChart({ Uranus: 0 });
    const chartB = buildChart({ Mars: 60 });
    const comparison = buildChartComparison(chartA, chartB, "pt");

    const uranusMarsSextile = comparison.highlights.find(
      (highlight) =>
        highlight.related?.aspect?.a.planet === "Uranus" &&
        highlight.related?.aspect?.b.planet === "Mars" &&
        highlight.related?.aspect?.type === "Sextile"
    );

    expect(uranusMarsSextile).toBeDefined();
    expect(uranusMarsSextile?.title).toBeTruthy();
    expect(uranusMarsSextile?.subtitle).toContain("Uranus");
    expect(uranusMarsSextile?.subtitle).toContain("Mars");
    expect(uranusMarsSextile?.tone).toBe("harmonious");
    expect(uranusMarsSextile?.text).toContain("Areas mais mexidas:");
    expect(uranusMarsSextile?.tags).toContain("trampo");
    expect(uranusMarsSextile?.tags).toContain("amizades");
    expect(uranusMarsSextile?.details?.length).toBeGreaterThan(0);
    expect(uranusMarsSextile?.details?.[0]?.title).toBe("Traducao sem astro-nerd");
    expect(uranusMarsSextile?.details?.[1]?.title).toBe("Areas que mais mexe");
    expect(uranusMarsSextile?.details?.[1]?.text).toContain("trampo");
    expect(uranusMarsSextile?.details?.[1]?.text).toContain("amizades");
  });
});
