import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateChartWithAdapter } from "../src/lib/engine";
import type { AspectName, ChartInput, ChartSettings, PlanetName } from "../src/lib/types";

type AdapterName = "AstronomyEngineAdapter" | "SwissEphemerisAdapter";

interface ExternalBaselineTolerance {
  planetsDegrees?: number;
  anglesDegrees?: number;
  housesDegrees?: number;
  aspectsOrbDegrees?: number;
}

interface ExpectedAspect {
  a: PlanetName;
  b: PlanetName;
  type: AspectName;
  orb?: number;
}

interface ExternalBaselineFixture {
  id: string;
  enabled: boolean;
  adapter?: AdapterName;
  source: {
    provider: string;
    referenceUrl?: string;
    capturedAt: string;
    notes?: string;
  };
  input: ChartInput;
  settings?: Partial<ChartSettings>;
  tolerance?: ExternalBaselineTolerance;
  expected: {
    planets?: Partial<Record<PlanetName, number>>;
    angles?: Partial<Record<"Ascendant" | "MC", number>>;
    houses?: Partial<Record<`${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12}`, number>>;
    aspects?: ExpectedAspect[];
  };
}

interface ExternalBaselineFile {
  schemaVersion: number;
  fixtures: ExternalBaselineFixture[];
}

const DEFAULT_TOLERANCE: Required<ExternalBaselineTolerance> = {
  planetsDegrees: 0.6,
  anglesDegrees: 1.6,
  housesDegrees: 1.8,
  aspectsOrbDegrees: 0.4,
};

function angleDistance(a: number | undefined, b: number | undefined): number {
  if (typeof a !== "number" || typeof b !== "number") return Number.POSITIVE_INFINITY;
  const delta = Math.abs(a - b);
  return delta > 180 ? 360 - delta : delta;
}

function sortPair(a: PlanetName, b: PlanetName): [PlanetName, PlanetName] {
  return a < b ? [a, b] : [b, a];
}

function aspectKey(input: { a: PlanetName; b: PlanetName; type: AspectName }): string {
  const [left, right] = sortPair(input.a, input.b);
  return `${left}-${right}-${input.type}`;
}

function loadBaselineFile(): ExternalBaselineFile {
  const raw = readFileSync(new URL("./fixtures/external-baselines.json", import.meta.url), "utf8");
  return JSON.parse(raw) as ExternalBaselineFile;
}

function resolveTolerance(tolerance?: ExternalBaselineTolerance): Required<ExternalBaselineTolerance> {
  return {
    planetsDegrees: tolerance?.planetsDegrees ?? DEFAULT_TOLERANCE.planetsDegrees,
    anglesDegrees: tolerance?.anglesDegrees ?? DEFAULT_TOLERANCE.anglesDegrees,
    housesDegrees: tolerance?.housesDegrees ?? DEFAULT_TOLERANCE.housesDegrees,
    aspectsOrbDegrees: tolerance?.aspectsOrbDegrees ?? DEFAULT_TOLERANCE.aspectsOrbDegrees,
  };
}

describe.sequential("external baseline harness", () => {
  it("loads a valid fixture file schema", () => {
    const data = loadBaselineFile();
    expect(data.schemaVersion).toBe(1);
    expect(Array.isArray(data.fixtures)).toBe(true);
    expect(data.fixtures.length).toBeGreaterThan(0);

    const ids = data.fixtures.map((fixture) => fixture.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("validates enabled fixtures against expected values with per-fixture tolerances", async () => {
    const data = loadBaselineFile();
    const enabled = data.fixtures.filter((fixture) => fixture.enabled);
    if (enabled.length === 0) {
      expect(true).toBe(true);
      return;
    }

    for (const fixture of enabled) {
      const tolerance = resolveTolerance(fixture.tolerance);
      const adapter: AdapterName = fixture.adapter ?? "SwissEphemerisAdapter";
      const chart = await generateChartWithAdapter(fixture.input, adapter, fixture.settings);

      for (const [planetName, expectedLongitude] of Object.entries(fixture.expected.planets ?? {})) {
        const actual = chart.planets[planetName as PlanetName]?.longitude;
        const delta = angleDistance(actual, expectedLongitude);
        expect(delta).toBeLessThanOrEqual(tolerance.planetsDegrees);
      }

      if (typeof fixture.expected.angles?.Ascendant === "number") {
        const delta = angleDistance(chart.angles?.ascendant.longitude, fixture.expected.angles.Ascendant);
        expect(delta).toBeLessThanOrEqual(tolerance.anglesDegrees);
      }
      if (typeof fixture.expected.angles?.MC === "number") {
        const delta = angleDistance(chart.angles?.mc?.longitude, fixture.expected.angles.MC);
        expect(delta).toBeLessThanOrEqual(tolerance.anglesDegrees);
      }

      for (const [house, expectedLongitude] of Object.entries(fixture.expected.houses ?? {})) {
        const houseIndex = Number(house) - 1;
        const actual = chart.houses?.[houseIndex]?.longitude;
        const delta = angleDistance(actual, expectedLongitude);
        expect(delta).toBeLessThanOrEqual(tolerance.housesDegrees);
      }

      if ((fixture.expected.aspects?.length ?? 0) > 0) {
        const actualByKey = new Map(
          (chart.aspects ?? []).map((aspect) => [aspectKey(aspect), aspect])
        );
        for (const expectedAspect of fixture.expected.aspects ?? []) {
          const key = aspectKey(expectedAspect);
          const actualAspect = actualByKey.get(key);
          expect(actualAspect).toBeDefined();
          if (typeof expectedAspect.orb === "number") {
            const orbDelta = Math.abs((actualAspect?.orb ?? 0) - expectedAspect.orb);
            expect(orbDelta).toBeLessThanOrEqual(tolerance.aspectsOrbDegrees);
          }
        }
      }
    }
  });
});
