import { describe, expect, it } from "vitest";
import { PLANETS } from "../src/lib/constants";
import { generateChartWithAdapter } from "../src/lib/engine";
import type { ChartInput, ChartSettings, PlanetName } from "../src/lib/types";

interface RegressionFixture {
  id: string;
  input: ChartInput;
  settings: Partial<ChartSettings>;
}

const BASE_SETTINGS: Partial<ChartSettings> = {
  zodiac: "tropical",
  houseSystem: "Equal",
  aspectProfile: "expanded",
  orbMode: "standard",
  includeMinorAspects: true,
};

const FIXTURES: RegressionFixture[] = [
  {
    id: "ny-1990",
    input: {
      date: "1990-12-16",
      time: "12:00",
      city: "New York",
      country: "US",
      daylight_saving: "auto",
      location: { lat: 40.7128, lon: -74.006, timezone: "America/New_York" },
    },
    settings: BASE_SETTINGS,
  },
  {
    id: "rio-1988",
    input: {
      date: "1988-01-09",
      time: "03:40",
      city: "Rio de Janeiro",
      country: "BR",
      daylight_saving: "auto",
      location: { lat: -22.9068, lon: -43.1729, timezone: "America/Sao_Paulo" },
    },
    settings: BASE_SETTINGS,
  },
  {
    id: "london-2001",
    input: {
      date: "2001-08-03",
      time: "21:10",
      city: "London",
      country: "GB",
      daylight_saving: "auto",
      location: { lat: 51.5074, lon: -0.1278, timezone: "Europe/London" },
    },
    settings: BASE_SETTINGS,
  },
  {
    id: "tokyo-2014",
    input: {
      date: "2014-09-29",
      time: "06:05",
      city: "Tokyo",
      country: "JP",
      daylight_saving: "auto",
      location: { lat: 35.6764, lon: 139.6503, timezone: "Asia/Tokyo" },
    },
    settings: BASE_SETTINGS,
  },
  {
    id: "sydney-2022",
    input: {
      date: "2022-05-18",
      time: "15:25",
      city: "Sydney",
      country: "AU",
      daylight_saving: "auto",
      location: { lat: -33.8688, lon: 151.2093, timezone: "Australia/Sydney" },
    },
    settings: BASE_SETTINGS,
  },
];

function angleDistance(a: number | undefined, b: number | undefined): number {
  if (typeof a !== "number" || typeof b !== "number") return Number.POSITIVE_INFINITY;
  const delta = Math.abs(a - b);
  return delta > 180 ? 360 - delta : delta;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function getPlanetDelta(
  planet: PlanetName,
  astronomyLongitude: number | undefined,
  swissLongitude: number | undefined
): { planet: PlanetName; delta: number } {
  return {
    planet,
    delta: round(angleDistance(astronomyLongitude, swissLongitude)),
  };
}

describe.sequential("adapter regression comparator", () => {
  it("keeps Swiss and Astronomy outputs within stable drift tolerances", async () => {
    const deltas: Array<{
      id: string;
      utc: string;
      ascDelta: number;
      mcDelta: number;
      house1Delta: number;
      house10Delta: number;
      aspectsDelta: number;
      planets: Array<{ planet: PlanetName; delta: number }>;
    }> = [];

    for (const fixture of FIXTURES) {
      const astronomy = await generateChartWithAdapter(
        fixture.input,
        "AstronomyEngineAdapter",
        fixture.settings
      );
      const swiss = await generateChartWithAdapter(
        fixture.input,
        "SwissEphemerisAdapter",
        fixture.settings
      );

      if (swiss.meta.engine !== "swiss-ephemeris") {
        expect(
          swiss.meta.warnings.some((warning) =>
            warning.includes("Swiss Ephemeris unavailable in this runtime")
          )
        ).toBe(true);
        continue;
      }

      expect(swiss.normalized.utcDateTime).toBe(astronomy.normalized.utcDateTime);
      expect(swiss.normalized.offsetMinutes).toBe(astronomy.normalized.offsetMinutes);

      const planetDeltas = PLANETS.map((planet) =>
        getPlanetDelta(
          planet,
          astronomy.planets[planet].longitude,
          swiss.planets[planet].longitude
        )
      );

      for (const entry of planetDeltas) {
        expect(entry.delta).toBeLessThanOrEqual(0.8);
      }

      const ascDelta = round(
        angleDistance(
          astronomy.angles?.ascendant.longitude,
          swiss.angles?.ascendant.longitude
        )
      );
      const mcDelta = round(
        angleDistance(astronomy.angles?.mc?.longitude, swiss.angles?.mc?.longitude)
      );
      const house1Delta = round(
        angleDistance(astronomy.houses?.[0]?.longitude, swiss.houses?.[0]?.longitude)
      );
      const house10Delta = round(
        angleDistance(astronomy.houses?.[9]?.longitude, swiss.houses?.[9]?.longitude)
      );
      const aspectsDelta = Math.abs((astronomy.aspects?.length ?? 0) - (swiss.aspects?.length ?? 0));

      expect(ascDelta).toBeLessThanOrEqual(2.5);
      expect(mcDelta).toBeLessThanOrEqual(2.5);
      expect(house1Delta).toBeLessThanOrEqual(2.5);
      expect(house10Delta).toBeLessThanOrEqual(2.5);
      expect(aspectsDelta).toBeLessThanOrEqual(10);

      deltas.push({
        id: fixture.id,
        utc: astronomy.normalized.utcDateTime,
        ascDelta,
        mcDelta,
        house1Delta,
        house10Delta,
        aspectsDelta,
        planets: planetDeltas,
      });
    }

    if (deltas.length > 0) {
      expect(deltas).toMatchSnapshot();
    }
  });
});
