import { describe, expect, it } from "vitest";
import { DEFAULT_CHART_SETTINGS } from "../src/lib/constants";
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

  it("returns the four RPG synastry stats normalized to 0-100", () => {
    const chartA = buildChart({ Sun: 0, Moon: 90, Venus: 120, Mars: 210, Jupiter: 15, Saturn: 45 });
    const chartB = buildChart({ Sun: 180, Moon: 270, Venus: 300, Mars: 30, Jupiter: 195, Saturn: 225 });
    const comparison = buildChartComparison(chartA, chartB, "en");

    expect(comparison.stats.map((stat) => stat.key)).toEqual([
      "attraction",
      "communication",
      "stability",
      "growth",
    ]);

    for (const stat of comparison.stats) {
      expect(stat.score).toBeGreaterThanOrEqual(0);
      expect(stat.score).toBeLessThanOrEqual(100);
      expect(stat.label.length).toBeGreaterThan(0);
      expect(stat.summary.length).toBeGreaterThan(0);
    }
  });

  it("localizes RPG stat labels for Portuguese output", () => {
    const chartA = buildChart({ Sun: 0 });
    const chartB = buildChart({ Sun: 0 });
    const comparison = buildChartComparison(chartA, chartB, "pt");

    expect(comparison.stats.map((stat) => stat.label)).toEqual([
      "Atracao",
      "Comunicacao",
      "Estabilidade",
      "Crescimento",
    ]);
  });

  it("builds explicit Sun x Sun comparison metadata", () => {
    const chartA = buildChart({ Sun: 240 }); // Sagittarius
    const chartB = buildChart({ Sun: 60 }); // Gemini
    const comparison = buildChartComparison(chartA, chartB, "pt", "romantic");

    expect(comparison.sunComparison).toBeDefined();
    expect(comparison.sunComparison.relation).toBe("complementary-opposites");
    expect(comparison.sunComparison.label).toBe("Sol em Sagitario x Sol em Gemeos");
    expect(comparison.sunComparison.globalBonus).toBe(15);
  });

  it("mentions complementary opposites in relationship stats when applicable", () => {
    const chartA = buildChart({ Sun: 240 }); // Sagittarius
    const chartB = buildChart({ Sun: 60 }); // Gemini
    const comparison = buildChartComparison(chartA, chartB, "pt", "romantic");

    expect(comparison.stats.some((stat) => /opostos complementares/i.test(stat.summary))).toBe(
      true
    );
    expect(comparison.stats.some((stat) => stat.summary.includes("Sol em Sagitario x Sol em Gemeos"))).toBe(
      true
    );
  });

  it("applies Sun global bonus to RPG stats for opposite signs even without Sun opposition orb", () => {
    const chartA = buildChart({ Sun: 29, Moon: 0, Mercury: 10, Venus: 20, Mars: 30 });
    const chartB = buildChart({ Sun: 181, Moon: 40, Mercury: 50, Venus: 60, Mars: 70 });
    const comparison = buildChartComparison(chartA, chartB, "pt", "romantic");

    const sunOpposition = (comparison.aspects ?? []).find(
      (aspect) =>
        aspect.a.planet === "Sun" &&
        aspect.b.planet === "Sun" &&
        aspect.type === "Opposition"
    );

    expect(sunOpposition).toBeUndefined();
    expect(comparison.sunComparison.relation).toBe("complementary-opposites");
    expect(comparison.sunComparison.globalBonus).toBe(12);
    expect(comparison.stats.some((stat) => stat.summary.includes("Bonus solar global (+12)"))).toBe(true);
  });

  it("caps the Sun global bonus at +15 for near-exact oppositions", () => {
    const chartA = buildChart({ Sun: 240 });
    const chartB = buildChart({ Sun: 60 });
    const comparison = buildChartComparison(chartA, chartB, "en", "romantic");

    expect(comparison.sunComparison.globalBonus).toBe(15);
    expect(comparison.stats.some((stat) => stat.summary.includes("Global Sun bonus (+15)"))).toBe(true);
  });

  it("uses friend framing for bond-heavy friend mode highlights", () => {
    const chartA = buildChart({ Venus: 0 });
    const chartB = buildChart({ Venus: 0 });
    const comparison = buildChartComparison(chartA, chartB, "en", "friend");

    const venusConjunction = comparison.highlights.find(
      (highlight) =>
        highlight.related?.aspect?.a.planet === "Venus" &&
        highlight.related?.aspect?.b.planet === "Venus" &&
        highlight.related?.aspect?.type === "Conjunction"
    );

    expect(venusConjunction).toBeDefined();
    expect(venusConjunction?.title).not.toContain("Love");
    expect(venusConjunction?.tags).toContain("bond");
    expect(venusConjunction?.text).toContain("Main areas");
  });

  it("enables expanded aspects when aspect profile is expanded", () => {
    const chartA = buildChart({ Sun: 0 });
    const chartB = buildChart({ Sun: 150 });
    chartA.settings = { ...DEFAULT_CHART_SETTINGS, aspectProfile: "expanded" };

    const comparison = buildChartComparison(chartA, chartB, "en");
    const sunQuincunx = comparison.aspects?.find(
      (aspect) =>
        aspect.a.planet === "Sun" &&
        aspect.b.planet === "Sun" &&
        aspect.type === "Quincunx"
    );
    expect(sunQuincunx?.orb).toBe(0);
  });

  it("enables minor-only aspects when includeMinorAspects is true", () => {
    const chartA = buildChart({ Sun: 0 });
    const chartB = buildChart({ Sun: 72 });
    chartA.settings = { ...DEFAULT_CHART_SETTINGS, includeMinorAspects: true };

    const comparison = buildChartComparison(chartA, chartB, "en");
    const sunQuintile = comparison.aspects?.find(
      (aspect) =>
        aspect.a.planet === "Sun" &&
        aspect.b.planet === "Sun" &&
        aspect.type === "Quintile"
    );
    expect(sunQuintile?.orb).toBe(0);
  });
});
