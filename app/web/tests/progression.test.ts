import { describe, expect, it } from "vitest";
import { buildChartComparison } from "../src/lib/synastry";
import {
  ADVANCED_OVERLAYS_UNLOCK_MISSIONS,
  DEFAULT_PROGRESSION_STATE,
  awardDailyMissionCompletion,
  awardDailyMissionReflection,
  awardQuestCompletion,
  awardQuestReflection,
  buildUnlockedInsight,
  buildRelationshipQuest,
  getAdvancedOverlaysUnlockMissionCount,
  getDetailUnlockCount,
  getDetailUnlockCountByMissions,
  getAdvancedOverlaysUnlockXp,
  getMissionCompletionCount,
  getLocalDayKey,
  getNextDetailUnlockMissionCount,
  getNextDetailUnlockXp,
  hasCompletedMissionDay,
  hasCompletedQuest,
  hasReflectedMissionDay,
  hasReflectedQuest,
  isAdvancedOverlaysUnlockedByMissions,
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

  it("awards mission completion once per day and updates streak", () => {
    const first = awardDailyMissionCompletion(DEFAULT_PROGRESSION_STATE, "2026-02-10");
    expect(first.xp).toBe(40);
    expect(first.streak).toBe(1);
    expect(hasCompletedMissionDay(first, "2026-02-10")).toBe(true);

    const duplicate = awardDailyMissionCompletion(first, "2026-02-10");
    expect(duplicate).toEqual(first);

    const second = awardDailyMissionCompletion(first, "2026-02-11");
    expect(second.streak).toBe(2);
    expect(second.xp).toBe(80);
  });

  it("awards mission reflection only after completion and once per day", () => {
    const blocked = awardDailyMissionReflection(DEFAULT_PROGRESSION_STATE, "2026-02-10");
    expect(blocked).toEqual(DEFAULT_PROGRESSION_STATE);

    const completed = awardDailyMissionCompletion(DEFAULT_PROGRESSION_STATE, "2026-02-10");
    const reflected = awardDailyMissionReflection(completed, "2026-02-10");
    expect(reflected.xp).toBe(60);
    expect(hasReflectedMissionDay(reflected, "2026-02-10")).toBe(true);

    const duplicate = awardDailyMissionReflection(reflected, "2026-02-10");
    expect(duplicate).toEqual(reflected);
  });

  it("derives mission-based unlock milestones and supports XP fallback for legacy users", () => {
    expect(getDetailUnlockCountByMissions(0)).toBe(1);
    expect(getDetailUnlockCountByMissions(1)).toBe(2);
    expect(getDetailUnlockCountByMissions(3)).toBe(3);
    expect(getDetailUnlockCountByMissions(5)).toBe(4);
    expect(getNextDetailUnlockMissionCount(0)).toBe(1);
    expect(getNextDetailUnlockMissionCount(2)).toBe(3);
    expect(getNextDetailUnlockMissionCount(7)).toBeNull();
    expect(isAdvancedOverlaysUnlockedByMissions(ADVANCED_OVERLAYS_UNLOCK_MISSIONS - 1)).toBe(false);
    expect(isAdvancedOverlaysUnlockedByMissions(ADVANCED_OVERLAYS_UNLOCK_MISSIONS)).toBe(true);
    expect(getAdvancedOverlaysUnlockMissionCount(ADVANCED_OVERLAYS_UNLOCK_MISSIONS)).toBeNull();

    const legacyState = {
      ...DEFAULT_PROGRESSION_STATE,
      xp: 420,
      completedQuestIds: ["legacy-q-1", "legacy-q-2"],
    };
    expect(getMissionCompletionCount(legacyState)).toBe(ADVANCED_OVERLAYS_UNLOCK_MISSIONS);
  });

  it("builds deterministic unlock insights and caps stored unlocks", () => {
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
    if (!quest) return;

    const missionInsight = buildUnlockedInsight(
      comparison,
      quest,
      "mission",
      "en",
      new Date("2026-02-10T12:00:00Z")
    );
    const reflectionInsight = buildUnlockedInsight(
      comparison,
      quest,
      "reflection",
      "en",
      new Date("2026-02-10T12:00:00Z")
    );
    expect(missionInsight.id).not.toBe(reflectionInsight.id);

    const preloadedInsights = Array.from({ length: 48 }, (_, index) => ({
      id: `seed-${index}`,
      dayKey: "2026-02-01",
      source: "mission" as const,
      title: `Seed ${index}`,
      text: `Text ${index}`,
      tags: ["seed"],
      tone: "harmonious" as const,
      createdAt: "2026-02-01T00:00:00.000Z",
    }));
    const baseState = {
      ...DEFAULT_PROGRESSION_STATE,
      completedQuestIds: ["daily-mission:2026-02-09"],
      unlockedInsights: preloadedInsights,
    };

    const awarded = awardDailyMissionCompletion(baseState, "2026-02-10", missionInsight);
    expect(awarded.unlockedInsights).toHaveLength(48);
    expect(awarded.unlockedInsights[0].id).toBe(missionInsight.id);
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
