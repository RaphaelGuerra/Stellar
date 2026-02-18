import { describe, expect, it } from "vitest";
import { generateChartWithAdapter } from "../src/lib/engine";
import type { ChartInput, ChartSettings } from "../src/lib/types";

interface FixtureLocation {
  city: string;
  country: string;
  lat: number;
  lon: number;
  timezone: string;
}

interface GoldenFixture {
  id: string;
  input: ChartInput;
  settings: ChartSettings;
}

const LOCATIONS: FixtureLocation[] = [
  {
    city: "New York",
    country: "US",
    lat: 40.7128,
    lon: -74.006,
    timezone: "America/New_York",
  },
  {
    city: "Rio de Janeiro",
    country: "BR",
    lat: -22.9068,
    lon: -43.1729,
    timezone: "America/Sao_Paulo",
  },
  {
    city: "London",
    country: "GB",
    lat: 51.5074,
    lon: -0.1278,
    timezone: "Europe/London",
  },
  {
    city: "Tokyo",
    country: "JP",
    lat: 35.6764,
    lon: 139.6503,
    timezone: "Asia/Tokyo",
  },
  {
    city: "Sydney",
    country: "AU",
    lat: -33.8688,
    lon: 151.2093,
    timezone: "Australia/Sydney",
  },
];

const DATES: string[] = [
  "1988-01-09",
  "1990-12-16",
  "1996-03-28",
  "2001-08-03",
  "2005-11-21",
  "2010-06-14",
  "2014-09-29",
  "2018-02-07",
  "2022-05-18",
  "2025-10-11",
];

const TIMES: string[] = ["00:20", "03:40", "06:05", "09:30", "12:00", "15:25", "18:50", "21:10"];
const HOUSE_SYSTEMS: ChartSettings["houseSystem"][] = ["Placidus", "WholeSign", "Equal", "Koch"];
const ORB_MODES: ChartSettings["orbMode"][] = ["standard", "tight", "wide"];

function round(value: number | undefined, decimals = 3): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

function buildFixtures(): GoldenFixture[] {
  const fixtures: GoldenFixture[] = [];
  for (let i = 0; i < 50; i++) {
    const location = LOCATIONS[i % LOCATIONS.length];
    const date = DATES[Math.floor(i / LOCATIONS.length)] ?? DATES[0];
    const time = TIMES[i % TIMES.length];
    const houseSystem = HOUSE_SYSTEMS[i % HOUSE_SYSTEMS.length];
    const orbMode = ORB_MODES[i % ORB_MODES.length];
    const aspectProfile: ChartSettings["aspectProfile"] = i % 3 === 0 ? "expanded" : "major";
    const includeMinorAspects = i % 5 === 0;

    fixtures.push({
      id: `fixture-${String(i + 1).padStart(2, "0")}`,
      input: {
        date,
        time,
        city: location.city,
        country: location.country,
        daylight_saving: "auto",
        location: {
          lat: location.lat,
          lon: location.lon,
          timezone: location.timezone,
        },
      },
      settings: {
        zodiac: "tropical",
        houseSystem,
        aspectProfile,
        orbMode,
        includeMinorAspects,
      },
    });
  }
  return fixtures;
}

function compactAspectSignature(chart: Awaited<ReturnType<typeof generateChartWithAdapter>>): string {
  return chart.aspects
    .slice(0, 6)
    .map((aspect) => `${aspect.a}-${aspect.b}:${aspect.type}@${round(aspect.orb, 1)}`)
    .join(",");
}

describe.sequential("engine golden fixtures", () => {
  it("matches compact chart signatures for 50 deterministic fixtures", async () => {
    const fixtures = buildFixtures();
    const signatures: string[] = [];

    for (const fixture of fixtures) {
      const chart = await generateChartWithAdapter(fixture.input, "AstronomyEngineAdapter", fixture.settings);
      const warnings = chart.meta.warnings
        .map((warning) => {
          if (warning.includes("falls back to Equal")) return "equal-fallback";
          if (warning.includes("True Node")) return "true-node-approx";
          if (warning.includes("Chiron and Vertex")) return "chiron-vertex-approx";
          return "warn";
        })
        .join("+");
      const house1 = chart.houses?.[0]?.longitude;
      const house10 = chart.houses?.[9]?.longitude;
      const house1Sign = chart.houses?.[0]?.sign ?? "n/a";
      const house10Sign = chart.houses?.[9]?.sign ?? "n/a";
      signatures.push(
        [
          fixture.id,
          chart.normalized.timezone,
          chart.normalized.localDateTime,
          chart.normalized.utcDateTime,
          `off=${chart.normalized.offsetMinutes}`,
          `hash=${chart.meta.settingsHash.slice(0, 12)}`,
          `sun=${round(chart.planets.Sun.longitude)}`,
          `moon=${round(chart.planets.Moon.longitude)}`,
          `venus=${round(chart.planets.Venus.longitude)}`,
          `asc=${round(chart.angles?.ascendant.longitude)}`,
          `mc=${round(chart.angles?.mc?.longitude)}`,
          `h1=${round(house1)}(${house1Sign})`,
          `h10=${round(house10)}(${house10Sign})`,
          `aspects=${compactAspectSignature(chart)}`,
          `warnings=${warnings || "none"}`,
        ].join("|")
      );
    }

    expect(signatures).toMatchSnapshot();
  });

  it("remains deterministic for repeated generation of a fixture", async () => {
    const fixture = buildFixtures()[17];
    const first = await generateChartWithAdapter(fixture.input, "AstronomyEngineAdapter", fixture.settings);
    const second = await generateChartWithAdapter(fixture.input, "AstronomyEngineAdapter", fixture.settings);

    const firstSignature = {
      utc: first.normalized.utcDateTime,
      hash: first.meta.settingsHash,
      sun: round(first.planets.Sun.longitude),
      moon: round(first.planets.Moon.longitude),
      asc: round(first.angles?.ascendant.longitude),
      h1: round(first.houses?.[0]?.longitude),
      aspects: compactAspectSignature(first),
    };
    const secondSignature = {
      utc: second.normalized.utcDateTime,
      hash: second.meta.settingsHash,
      sun: round(second.planets.Sun.longitude),
      moon: round(second.planets.Moon.longitude),
      asc: round(second.angles?.ascendant.longitude),
      h1: round(second.houses?.[0]?.longitude),
      aspects: compactAspectSignature(second),
    };

    expect(secondSignature).toEqual(firstSignature);
  });
});
