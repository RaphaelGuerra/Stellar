import { describe, expect, it } from "vitest";
import { generateChartWithAdapter } from "../src/lib/engine";
import type { ChartInput, ChartSettings } from "../src/lib/types";

const BASE_INPUT: ChartInput = {
  date: "1994-07-16",
  time: "04:42",
  city: "London",
  country: "GB",
  daylight_saving: "auto",
  location: {
    lat: 51.5074,
    lon: -0.1278,
    timezone: "Europe/London",
  },
};

function buildSettings(houseSystem: ChartSettings["houseSystem"]): Partial<ChartSettings> {
  return {
    zodiac: "tropical",
    houseSystem,
    aspectProfile: "major",
    orbMode: "standard",
    includeMinorAspects: false,
  };
}

function round(value: number | undefined): number {
  return Math.round((value ?? 0) * 1000) / 1000;
}

describe.sequential("house system fixtures", () => {
  it("builds 12 ordered cusps for all supported house systems", async () => {
    for (const houseSystem of ["Placidus", "WholeSign", "Equal", "Koch"] as const) {
      const chart = await generateChartWithAdapter(BASE_INPUT, "AstronomyEngineAdapter", buildSettings(houseSystem));
      expect(chart.houses).toBeDefined();
      expect(chart.houses?.length).toBe(12);
      expect(chart.houses?.map((h) => h.house)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      expect(chart.houses?.every((h) => h.system === houseSystem)).toBe(true);
    }
  });

  it("keeps whole-sign house 1 at the start of the ascendant sign", async () => {
    const equal = await generateChartWithAdapter(BASE_INPUT, "AstronomyEngineAdapter", buildSettings("Equal"));
    const wholeSign = await generateChartWithAdapter(BASE_INPUT, "AstronomyEngineAdapter", buildSettings("WholeSign"));

    const asc = equal.angles?.ascendant.longitude ?? 0;
    const expectedWholeSignHouse1 = Math.floor(asc / 30) * 30;
    expect(round(wholeSign.houses?.[0]?.longitude)).toBe(round(expectedWholeSignHouse1));
    expect(round(equal.houses?.[0]?.longitude)).toBe(round(asc));
  });

  it("documents fallback behavior for Placidus and Koch in astronomy adapter", async () => {
    const placidus = await generateChartWithAdapter(BASE_INPUT, "AstronomyEngineAdapter", buildSettings("Placidus"));
    const koch = await generateChartWithAdapter(BASE_INPUT, "AstronomyEngineAdapter", buildSettings("Koch"));
    const equal = await generateChartWithAdapter(BASE_INPUT, "AstronomyEngineAdapter", buildSettings("Equal"));

    expect(placidus.meta.warnings.some((w) => w.includes("Placidus currently falls back to Equal"))).toBe(true);
    expect(koch.meta.warnings.some((w) => w.includes("Koch currently falls back to Equal"))).toBe(true);
    expect(placidus.houses?.map((h) => round(h.longitude))).toEqual(equal.houses?.map((h) => round(h.longitude)));
    expect(koch.houses?.map((h) => round(h.longitude))).toEqual(equal.houses?.map((h) => round(h.longitude)));
  });

  it("preserves deterministic settings hash and changes it when settings differ", async () => {
    const equal = await generateChartWithAdapter(BASE_INPUT, "AstronomyEngineAdapter", buildSettings("Equal"));
    const equalAgain = await generateChartWithAdapter(BASE_INPUT, "AstronomyEngineAdapter", buildSettings("Equal"));
    const wholeSign = await generateChartWithAdapter(BASE_INPUT, "AstronomyEngineAdapter", buildSettings("WholeSign"));

    expect(equal.meta.settingsHash).toBe(equalAgain.meta.settingsHash);
    expect(equal.meta.settingsHash).not.toBe(wholeSign.meta.settingsHash);
  });

  it("uses Swiss ephemeris when available, otherwise surfaces fallback warning", async () => {
    const swissPlacidus = await generateChartWithAdapter(BASE_INPUT, "SwissEphemerisAdapter", buildSettings("Placidus"));
    if (swissPlacidus.meta.engine === "swiss-ephemeris") {
      expect(
        swissPlacidus.meta.warnings.some((warning) => warning.includes("falls back to Equal house cusps"))
      ).toBe(false);
      expect(swissPlacidus.houses?.length).toBe(12);
      return;
    }
    expect(
      swissPlacidus.meta.warnings.some((warning) => warning.includes("Swiss Ephemeris unavailable"))
    ).toBe(true);
  });
});
