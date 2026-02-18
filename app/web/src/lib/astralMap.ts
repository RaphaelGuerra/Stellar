import {
  ASPECT_DEFS,
  PLANETS,
  SIGN_INDEX,
  SIGNS,
  normalizeAngle,
} from "./constants";
import type {
  AspectName,
  AspectTone,
  AstralMapModel,
  ChartComparison,
  ChartResult,
  MapAspectLine,
  MapHouse,
  MapPlanetPoint,
  PlanetName,
} from "./types";

const MAP_CENTER = 50;
const HOUSE_RING_RADIUS = 43;
const SINGLE_PLANET_RING_RADIUS = 33;
const COMPAT_PLANET_RING_A = 35;
const COMPAT_PLANET_RING_B = 28;

function getAspectTone(type: AspectName): AspectTone {
  switch (type) {
    case "Trine":
    case "Sextile":
      return "harmonious";
    case "Square":
    case "Opposition":
      return "challenging";
    case "Conjunction":
      return "intense";
  }
}

function longitudeToSignDegree(longitude: number): { sign: (typeof SIGNS)[number]; degree: number } {
  const normalized = normalizeAngle(longitude);
  const signIndex = Math.floor(normalized / 30);
  return {
    sign: SIGNS[signIndex] ?? "Aries",
    degree: Math.round((normalized % 30) * 10) / 10,
  };
}

function getPlanetLongitude(chart: ChartResult, planet: PlanetName): number {
  const placement = chart.planets[planet];
  if (typeof placement.longitude === "number" && Number.isFinite(placement.longitude)) {
    return normalizeAngle(placement.longitude);
  }
  const signIndex = SIGN_INDEX[placement.sign] ?? 0;
  return normalizeAngle(signIndex * 30 + (placement.degree ?? 0));
}

function getAscendantLongitude(chart: ChartResult): { longitude: number; usedFallback: boolean } {
  const asc = chart.angles?.ascendant;
  if (asc) {
    if (typeof asc.longitude === "number" && Number.isFinite(asc.longitude)) {
      return { longitude: normalizeAngle(asc.longitude), usedFallback: false };
    }
    const signIndex = SIGN_INDEX[asc.sign] ?? 0;
    return { longitude: normalizeAngle(signIndex * 30 + (asc.degree ?? 0)), usedFallback: false };
  }
  return { longitude: 0, usedFallback: true };
}

function toPoint(longitude: number, radius: number): { x: number; y: number } {
  const angle = ((normalizeAngle(longitude) - 90) * Math.PI) / 180;
  return {
    x: Math.round((MAP_CENTER + Math.cos(angle) * radius) * 1000) / 1000,
    y: Math.round((MAP_CENTER + Math.sin(angle) * radius) * 1000) / 1000,
  };
}

function buildEqualHouses(ascendantLongitude: number): MapHouse[] {
  return Array.from({ length: 12 }, (_, index) => {
    const cuspLongitude = normalizeAngle(ascendantLongitude + index * 30);
    const signPlacement = longitudeToSignDegree(cuspLongitude);
    return {
      house: index + 1,
      cuspLongitude,
      sign: signPlacement.sign,
      degree: signPlacement.degree,
      beta: true,
    };
  });
}

function buildPlanetPoints(chart: ChartResult, chartRef: "A" | "B", radius: number): MapPlanetPoint[] {
  return PLANETS.map((planet) => {
    const longitude = getPlanetLongitude(chart, planet);
    const point = toPoint(longitude, radius);
    return {
      chart: chartRef,
      planet,
      longitude,
      x: point.x,
      y: point.y,
    };
  });
}

function buildSingleAspectLines(
  chart: ChartResult,
  points: readonly MapPlanetPoint[]
): MapAspectLine[] {
  const pointByPlanet = new Map<PlanetName, MapPlanetPoint>();
  for (const point of points) {
    pointByPlanet.set(point.planet, point);
  }

  const lines: Array<MapAspectLine | null> = chart.aspects.map((aspect) => {
      const from = pointByPlanet.get(aspect.a);
      const to = pointByPlanet.get(aspect.b);
      if (!from || !to) return null;
      const line: MapAspectLine = {
        type: aspect.type,
        tone: getAspectTone(aspect.type),
        from,
        to,
      };
      if (aspect.orb != null) {
        line.orb = aspect.orb;
      }
      return line;
    });

  return lines.filter((line): line is MapAspectLine => line !== null);
}

function buildCompatibilityAspectLines(
  comparison: ChartComparison,
  points: readonly MapPlanetPoint[]
): MapAspectLine[] {
  const pointByKey = new Map<string, MapPlanetPoint>();
  for (const point of points) {
    pointByKey.set(`${point.chart}-${point.planet}`, point);
  }

  const lines: Array<MapAspectLine | null> = (comparison.aspects ?? []).map((aspect) => {
      const from = pointByKey.get(`${aspect.a.chart}-${aspect.a.planet}`);
      const to = pointByKey.get(`${aspect.b.chart}-${aspect.b.planet}`);
      if (!from || !to) return null;
      const line: MapAspectLine = {
        type: aspect.type,
        tone: getAspectTone(aspect.type),
        from,
        to,
      };
      if (aspect.orb != null) {
        line.orb = aspect.orb;
      }
      return line;
    });

  return lines.filter((line): line is MapAspectLine => line !== null);
}

export function getAspectFilterTypes(): AspectName[] {
  return ASPECT_DEFS.map((def) => def.type);
}

export function getMapCenter(): number {
  return MAP_CENTER;
}

export function getHouseRingRadius(): number {
  return HOUSE_RING_RADIUS;
}

export function buildAstralMapModelSingle(chart: ChartResult): AstralMapModel {
  const asc = getAscendantLongitude(chart);
  const houses = buildEqualHouses(asc.longitude);
  const planets = buildPlanetPoints(chart, "A", SINGLE_PLANET_RING_RADIUS);
  const lines = buildSingleAspectLines(chart, planets);

  return {
    mode: "single",
    houses,
    planets,
    lines,
    usedAscendantFallback: asc.usedFallback,
  };
}

export function buildAstralMapModelCompatibility(
  chartA: ChartResult,
  chartB: ChartResult,
  comparison: ChartComparison
): AstralMapModel {
  const asc = getAscendantLongitude(chartA);
  const houses = buildEqualHouses(asc.longitude);
  const planetsA = buildPlanetPoints(chartA, "A", COMPAT_PLANET_RING_A);
  const planetsB = buildPlanetPoints(chartB, "B", COMPAT_PLANET_RING_B);
  const planets = [...planetsA, ...planetsB];
  const lines = buildCompatibilityAspectLines(comparison, planets);

  return {
    mode: "compatibility",
    houses,
    planets,
    lines,
    usedAscendantFallback: asc.usedFallback,
  };
}
