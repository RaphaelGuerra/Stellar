import { describe, expect, it } from "vitest";
import { buildDailyTransitOutlook } from "../src/lib/transits";
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
      date: "1990-01-01",
      time: "12:00",
      city: "Rio de Janeiro",
      country: "BR",
      daylight_saving: "auto",
    },
    normalized: {
      localDateTime: "1990-01-01T12:00",
      utcDateTime: "1990-01-01T15:00:00Z",
      timezone: "America/Sao_Paulo",
      offsetMinutes: 180,
      daylightSaving: false,
      location: { lat: -22.9, lon: -43.2 },
    },
    planets,
    aspects: [],
  };
}

describe("buildDailyTransitOutlook", () => {
  it("builds one opportunity and one watchout insight", () => {
    const chartA = buildChart({ Sun: 0, Moon: 50, Venus: 90, Mars: 130 });
    const chartB = buildChart({ Sun: 180, Moon: 200, Venus: 250, Mars: 320 });
    const outlook = buildDailyTransitOutlook(chartA, chartB, {
      locale: "en",
      duoMode: "romantic",
      now: new Date("2026-02-10T12:00:00Z"),
    });

    expect(outlook.generatedAt).toBe("2026-02-10T12:00:00.000Z");
    expect(outlook.dateLabel.length).toBeGreaterThan(0);

    expect(outlook.opportunity.kind).toBe("opportunity");
    expect(outlook.opportunity.title.length).toBeGreaterThan(0);
    expect(outlook.opportunity.subtitle).toMatch(/Person [AB]/);
    expect(outlook.opportunity.details.length).toBeGreaterThan(0);
    expect(outlook.opportunity.tags).toContain("opportunity");

    expect(outlook.watchout.kind).toBe("watchout");
    expect(outlook.watchout.title.length).toBeGreaterThan(0);
    expect(outlook.watchout.subtitle).toMatch(/Person [AB]/);
    expect(outlook.watchout.details.length).toBeGreaterThan(0);
    expect(outlook.watchout.tags).toContain("watchout");
  });

  it("uses friendship framing when duo mode is friend", () => {
    const chartA = buildChart({ Sun: 15, Moon: 77, Venus: 122 });
    const chartB = buildChart({ Sun: 201, Moon: 248, Venus: 303 });
    const outlook = buildDailyTransitOutlook(chartA, chartB, {
      locale: "en",
      duoMode: "friend",
      now: new Date("2026-02-10T12:00:00Z"),
    });

    expect(outlook.opportunity.text).toContain("friendship");
    expect(outlook.watchout.text).toContain("friendship");
  });

  it("localizes labels and copy for Portuguese mode", () => {
    const chartA = buildChart({ Sun: 0 });
    const chartB = buildChart({ Sun: 180 });
    const outlook = buildDailyTransitOutlook(chartA, chartB, {
      locale: "pt",
      duoMode: "friend",
      now: new Date("2026-02-10T12:00:00Z"),
    });

    expect(outlook.opportunity.title).toContain("Janela");
    expect(outlook.watchout.title).toContain("Pressao");
    expect(outlook.opportunity.text).toContain("amizade");
    expect(outlook.watchout.text).toContain("amizade");
    expect(outlook.opportunity.tags).toContain("oportunidade");
    expect(outlook.watchout.tags).toContain("atencao");
  });

  it("is deterministic for the same input and timestamp", () => {
    const chartA = buildChart({ Sun: 0, Moon: 25, Mercury: 40 });
    const chartB = buildChart({ Sun: 180, Moon: 205, Mercury: 220 });
    const now = new Date("2026-02-10T12:00:00Z");
    const first = buildDailyTransitOutlook(chartA, chartB, {
      locale: "en",
      duoMode: "romantic",
      now,
    });
    const second = buildDailyTransitOutlook(chartA, chartB, {
      locale: "en",
      duoMode: "romantic",
      now,
    });

    expect(first).toEqual(second);
  });

  it("formats date label using chart A timezone", () => {
    const chartA = buildChart({ Sun: 0 });
    const chartB = buildChart({ Sun: 180 });
    chartA.normalized.timezone = "America/Los_Angeles";
    const now = new Date("2026-02-10T01:30:00Z");

    const outlook = buildDailyTransitOutlook(chartA, chartB, {
      locale: "en",
      duoMode: "romantic",
      now,
    });

    const expectedLocal = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "America/Los_Angeles",
    }).format(now);
    const expectedUtc = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(now);

    expect(outlook.dateLabel).toBe(expectedLocal);
    expect(outlook.dateLabel).not.toBe(expectedUtc);
  });

  it("falls back to UTC date label when timezone is invalid", () => {
    const chartA = buildChart({ Sun: 0 });
    const chartB = buildChart({ Sun: 180 });
    chartA.normalized.timezone = "Invalid/Timezone";
    const now = new Date("2026-02-10T12:00:00Z");

    const outlook = buildDailyTransitOutlook(chartA, chartB, {
      locale: "en",
      duoMode: "romantic",
      now,
    });

    const expectedUtc = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(now);

    expect(outlook.dateLabel).toBe(expectedUtc);
  });
});
