import { describe, expect, it } from "vitest";
import { buildChartComparison } from "../src/lib/synastry";
import {
  DEFAULT_PROGRESSION_STATE,
  awardQuestCompletion,
  awardQuestReflection,
  buildRelationshipQuest,
  getDetailUnlockCount,
  getAdvancedOverlaysUnlockXp,
  getLocalDayKey,
  getNextDetailUnlockXp,
  hasCompletedQuest,
  hasReflectedQuest,
  isAdvancedOverlaysUnlocked,
} from "../src/lib/progression";
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
    aspects: [],
  };
}

describe("progression", () => {
  it("builds a relationship quest from the tightest challenging aspect", () => {
    const chartA = buildChart({ Sun: 0, Moon: 40, Venus: 100 });
    const chartB = buildChart({ Sun: 90, Moon: 180, Venus: 190 });
    const comparison = buildChartComparison(chartA, chartB, "en");

    const quest = buildRelationshipQuest(comparison, {
      locale: "en",
      duoMode: "romantic",
      now: new Date("2026-02-10T12:00:00Z"),
      timeZone: "UTC",
    });

    expect(quest).not.toBeNull();
    expect(quest?.id).toContain("2026-02-10");
    expect(quest?.details.length).toBe(4);
    expect(quest?.focusStatLabel.length).toBeGreaterThan(0);
    expect(quest?.sourceAspect.type === "Square" || quest?.sourceAspect.type === "Opposition").toBe(true);
  });

  it("localizes friendship quest framing in Portuguese", () => {
    const chartA = buildChart({ Sun: 0, Moon: 0 });
    const chartB = buildChart({ Sun: 90, Moon: 180 });
    const comparison = buildChartComparison(chartA, chartB, "pt", "friend");

    const quest = buildRelationshipQuest(comparison, {
      locale: "pt",
      duoMode: "friend",
      now: new Date("2026-02-10T12:00:00Z"),
      timeZone: "UTC",
    });

    expect(quest).not.toBeNull();
    expect(quest?.title).toContain("Missao");
    expect(quest?.text).toContain("amizade");
  });

  it("awards completion XP once and updates streak on consecutive days", () => {
    const firstDay = "2026-02-10";
    const secondDay = "2026-02-11";

    const first = awardQuestCompletion(DEFAULT_PROGRESSION_STATE, "q-1", firstDay);
    expect(first.xp).toBe(40);
    expect(first.streak).toBe(1);
    expect(hasCompletedQuest(first, "q-1")).toBe(true);

    const duplicate = awardQuestCompletion(first, "q-1", firstDay);
    expect(duplicate).toEqual(first);

    const second = awardQuestCompletion(first, "q-2", secondDay);
    expect(second.xp).toBe(80);
    expect(second.streak).toBe(2);
  });

  it("awards reflection XP once per quest", () => {
    const blocked = awardQuestReflection(DEFAULT_PROGRESSION_STATE, "q-1");
    expect(blocked).toEqual(DEFAULT_PROGRESSION_STATE);

    const base = awardQuestCompletion(DEFAULT_PROGRESSION_STATE, "q-1", "2026-02-10");
    const reflected = awardQuestReflection(base, "q-1");

    expect(reflected.xp).toBe(60);
    expect(hasReflectedQuest(reflected, "q-1")).toBe(true);

    const duplicate = awardQuestReflection(reflected, "q-1");
    expect(duplicate).toEqual(reflected);
  });

  it("derives detail unlock milestones from XP", () => {
    expect(getDetailUnlockCount(0)).toBe(1);
    expect(getDetailUnlockCount(79)).toBe(1);
    expect(getDetailUnlockCount(80)).toBe(2);
    expect(getDetailUnlockCount(180)).toBe(3);
    expect(getDetailUnlockCount(320)).toBe(4);
    expect(getNextDetailUnlockXp(0)).toBe(80);
    expect(getNextDetailUnlockXp(100)).toBe(180);
    expect(getNextDetailUnlockXp(400)).toBeNull();
    expect(isAdvancedOverlaysUnlocked(100)).toBe(false);
    expect(getAdvancedOverlaysUnlockXp(100)).toBe(420);
    expect(isAdvancedOverlaysUnlocked(420)).toBe(true);
    expect(getAdvancedOverlaysUnlockXp(420)).toBeNull();
  });

  it("builds local day keys in timezone and falls back safely", () => {
    const now = new Date("2026-02-10T02:30:00Z");
    const laDay = getLocalDayKey(now, "America/Los_Angeles");
    const utcDay = getLocalDayKey(now, "UTC");
    const fallback = getLocalDayKey(now, "Invalid/Timezone");

    expect(laDay).toBe("2026-02-09");
    expect(utcDay).toBe("2026-02-10");
    expect(fallback).toBe(utcDay);
  });
});
