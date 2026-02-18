import { describe, expect, it } from "vitest";
import { DEFAULT_CHART_SETTINGS, PLANETS, SIGNS, normalizeAngle } from "../src/lib/constants";
import {
  generateAnnualProfections,
  generateComposite,
  generateLunarReturn,
  generateSecondaryProgressions,
  getActiveAstroAdapter,
  setActiveAstroAdapter,
} from "../src/lib/engine";
import type {
  ChartInput,
  ChartResult,
  ChartSettings,
  HouseNumber,
  PlanetName,
  PlanetPlacement,
} from "../src/lib/types";

function placementFromLongitude(longitude: number): PlanetPlacement {
  const normalized = normalizeAngle(longitude);
  const signIndex = Math.floor(normalized / 30);
  const degree = Math.round((normalized % 30) * 10) / 10;
  return {
    sign: SIGNS[signIndex] ?? "Aries",
    degree,
    longitude: normalized,
  };
}

function angleDistance(a: number, b: number): number {
  const delta = Math.abs(a - b);
  return delta > 180 ? 360 - delta : delta;
}

function midpointLongitude(a: number, b: number): number {
  const ar = (a * Math.PI) / 180;
  const br = (b * Math.PI) / 180;
  return normalizeAngle((Math.atan2(Math.sin(ar) + Math.sin(br), Math.cos(ar) + Math.cos(br)) * 180) / Math.PI);
}

function localDateTimeParts(date: Date, timeZone: string): { dateStr: string; timeStr: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  return {
    dateStr: `${year}-${month}-${day}`,
    timeStr: `${hour}:${minute}`,
  };
}

function buildChart({
  utcDateTime,
  timezone,
  city = "Rio de Janeiro",
  country = "BR",
  lat = -22.9,
  lon = -43.2,
  ascendant = 10,
  mc = 100,
  moon = 50,
}: {
  utcDateTime: string;
  timezone: string;
  city?: string;
  country?: string;
  lat?: number;
  lon?: number;
  ascendant?: number;
  mc?: number;
  moon?: number;
}): ChartResult {
  const planets = {} as Record<PlanetName, PlanetPlacement>;
  for (const [index, planet] of PLANETS.entries()) {
    planets[planet] = placementFromLongitude(index === 1 ? moon : index * 24);
  }
  const asc = placementFromLongitude(ascendant);
  const desc = placementFromLongitude(ascendant + 180);
  const mcPlacement = placementFromLongitude(mc);
  const ic = placementFromLongitude(mc + 180);
  const local = localDateTimeParts(new Date(utcDateTime), timezone);
  return {
    input: {
      date: local.dateStr,
      time: local.timeStr,
      city,
      country,
      daylight_saving: "auto",
      location: { lat, lon, timezone },
    },
    settings: DEFAULT_CHART_SETTINGS,
    normalized: {
      localDateTime: `${local.dateStr}T${local.timeStr}`,
      utcDateTime,
      timezone,
      offsetMinutes: 0,
      daylightSaving: false,
      location: { lat, lon },
    },
    points: {
      ...Object.fromEntries(PLANETS.map((planet) => [planet, planets[planet]])),
      Ascendant: asc,
      Descendant: desc,
      MC: mcPlacement,
      IC: ic,
      Vertex: placementFromLongitude(ascendant + 90),
      Fortune: placementFromLongitude(ascendant + moon - (planets.Sun.longitude ?? 0)),
    },
    planets,
    angles: {
      ascendant: asc,
      descendant: desc,
      mc: mcPlacement,
      ic,
      vertex: placementFromLongitude(ascendant + 90),
    },
    houses: Array.from({ length: 12 }, (_, index) => ({
      house: (index + 1) as HouseNumber,
      sign: SIGNS[index] ?? "Aries",
      degree: 0,
      longitude: index * 30,
      system: "Equal",
    })),
    aspects: [],
    meta: {
      engine: "astronomy-engine",
      adapter: "AstronomyEngineAdapter",
      settingsHash: "{}",
      warnings: [],
    },
  };
}

async function withStubbedAdapter(
  stub: (input: ChartInput, settings: ChartSettings) => Promise<ChartResult>,
  run: () => Promise<void>
) {
  const previousAdapter = getActiveAstroAdapter().name;
  setActiveAstroAdapter("SwissEphemerisAdapter");
  const adapter = getActiveAstroAdapter() as { generateChart: (input: ChartInput, settings: ChartSettings) => Promise<ChartResult> };
  const original = adapter.generateChart;
  adapter.generateChart = stub;
  try {
    await run();
  } finally {
    adapter.generateChart = original;
    setActiveAstroAdapter(previousAdapter);
  }
}

describe.sequential("predictive engine correctness", () => {
  it("adjusts profection age when birthday has not happened yet", () => {
    const baseChart = buildChart({
      utcDateTime: "1990-12-16T15:00:00Z",
      timezone: "America/Sao_Paulo",
    });
    const result = generateAnnualProfections(baseChart, new Date("2026-12-15T12:00:00Z"));
    expect(result.age).toBe(35);
    expect(result.profectedHouse).toBe(12);
  });

  it("recomputes midpoint composite angles and normalized timestamp", async () => {
    const chartA = buildChart({
      utcDateTime: "1990-01-01T00:00:00Z",
      timezone: "UTC",
      ascendant: 15,
      mc: 105,
      moon: 40,
    });
    const chartB = buildChart({
      utcDateTime: "1990-01-03T00:00:00Z",
      timezone: "UTC",
      ascendant: 75,
      mc: 225,
      moon: 120,
    });

    const composite = await generateComposite(chartA, chartB, "midpoint");
    const expectedAsc = midpointLongitude(15, 75);
    const expectedMc = midpointLongitude(105, 225);

    expect(angleDistance(composite.angles?.ascendant.longitude ?? 0, expectedAsc)).toBeLessThan(0.01);
    expect(angleDistance(composite.angles?.mc?.longitude ?? 0, expectedMc)).toBeLessThan(0.01);
    expect(composite.normalized.utcDateTime).toBe("1990-01-02T00:00:00Z");
    expect(composite.points.Ascendant?.longitude).not.toBe(chartA.points.Ascendant?.longitude);
  });

  it("localizes progression input to the chart timezone instead of reusing UTC clock time", async () => {
    const baseChart = buildChart({
      utcDateTime: "1990-01-01T15:00:00Z",
      timezone: "Asia/Kolkata",
      lat: 19.076,
      lon: 72.8777,
      city: "Mumbai",
      country: "IN",
    });

    await withStubbedAdapter(
      async (input, settings) =>
        Promise.resolve({
          ...baseChart,
          input,
          settings,
          normalized: {
            ...baseChart.normalized,
            localDateTime: `${input.date}T${input.time}`,
            utcDateTime: `${input.date}T${input.time}:00Z`,
            timezone: input.location?.timezone ?? baseChart.normalized.timezone,
            location: {
              lat: input.location?.lat ?? baseChart.normalized.location.lat,
              lon: input.location?.lon ?? baseChart.normalized.location.lon,
            },
          },
        }),
      async () => {
        const progression = await generateSecondaryProgressions(baseChart, "1990-01-01");
        const expectedLocal = localDateTimeParts(
          new Date(baseChart.normalized.utcDateTime),
          baseChart.normalized.timezone
        );
        expect(progression.progressedChart.input.date).toBe(expectedLocal.dateStr);
        expect(progression.progressedChart.input.time).toBe(expectedLocal.timeStr);
      }
    );
  });

  it("searches lunar returns across the requested month window", async () => {
    const baseChart = buildChart({
      utcDateTime: "1990-01-01T00:00:00Z",
      timezone: "UTC",
      moon: 20,
    });

    await withStubbedAdapter(
      async (input, settings) => {
        const dayOfMonth = Number(input.date.slice(8, 10));
        const moonLongitude = (dayOfMonth * 10) % 360;
        const planets = {} as Record<PlanetName, PlanetPlacement>;
        for (const planet of PLANETS) {
          planets[planet] = placementFromLongitude(planet === "Moon" ? moonLongitude : 0);
        }
        return Promise.resolve({
          ...baseChart,
          input,
          settings,
          planets,
          points: {
            ...baseChart.points,
            ...Object.fromEntries(PLANETS.map((planet) => [planet, planets[planet]])),
          },
          normalized: {
            ...baseChart.normalized,
            localDateTime: `${input.date}T${input.time}`,
            utcDateTime: `${input.date}T${input.time}:00Z`,
          },
        });
      },
      async () => {
        const lunarReturn = await generateLunarReturn(baseChart, "2026-01");
        expect(new Date(lunarReturn.exactDateTimeUtc).getUTCDate()).toBe(2);
        expect(Math.round((lunarReturn.chart.planets.Moon.longitude ?? 0) * 10) / 10).toBe(20);
      }
    );
  });
});
