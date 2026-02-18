import {
  ASTRO_POINTS,
  PLANETS,
  POINT_SYMBOL,
} from "./constants";
import type {
  AstroPointName,
  ChartResult,
  PlanetName,
  PlanetPlacement,
  ZodiacSign,
} from "./types";
import type { Aspect } from "./types";

export type DignityStatus = "domicile" | "exaltation" | "detriment" | "fall" | "neutral";

export interface PointTableRow {
  point: AstroPointName;
  symbol: string;
  sign: ZodiacSign | "--";
  degree: string;
  longitude: string;
}

export interface HouseTableRow {
  house: number;
  sign: ZodiacSign | "--";
  degree: string;
  longitude: string;
}

export interface DignityTableRow {
  planet: PlanetName;
  sign: ZodiacSign;
  status: DignityStatus;
}

export const DIGNITY_RULES: Record<PlanetName, {
  domicile: ZodiacSign[];
  detriment: ZodiacSign[];
  exaltation?: ZodiacSign;
  fall?: ZodiacSign;
}> = {
  Sun: { domicile: ["Leo"], detriment: ["Aquarius"], exaltation: "Aries", fall: "Libra" },
  Moon: { domicile: ["Cancer"], detriment: ["Capricorn"], exaltation: "Taurus", fall: "Scorpio" },
  Mercury: {
    domicile: ["Gemini", "Virgo"],
    detriment: ["Sagittarius", "Pisces"],
    exaltation: "Virgo",
    fall: "Pisces",
  },
  Venus: { domicile: ["Taurus", "Libra"], detriment: ["Scorpio", "Aries"], exaltation: "Pisces", fall: "Virgo" },
  Mars: { domicile: ["Aries", "Scorpio"], detriment: ["Libra", "Taurus"], exaltation: "Capricorn", fall: "Cancer" },
  Jupiter: {
    domicile: ["Sagittarius", "Pisces"],
    detriment: ["Gemini", "Virgo"],
    exaltation: "Cancer",
    fall: "Capricorn",
  },
  Saturn: {
    domicile: ["Capricorn", "Aquarius"],
    detriment: ["Cancer", "Leo"],
    exaltation: "Libra",
    fall: "Aries",
  },
  Uranus: { domicile: ["Aquarius"], detriment: ["Leo"] },
  Neptune: { domicile: ["Pisces"], detriment: ["Virgo"] },
  Pluto: { domicile: ["Scorpio"], detriment: ["Taurus"] },
};

export function formatDegreeValue(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${value.toFixed(1)}deg`;
}

export function formatLongitudeValue(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${value.toFixed(2)}deg`;
}

export function formatPlacementLabel(
  placement: PlanetPlacement | undefined,
  emptyText: string
): string {
  if (!placement) return emptyText;
  if (placement.degree == null) return placement.sign;
  return `${placement.sign} ${placement.degree.toFixed(1)}°`;
}

export function buildPointTableRows(chart: ChartResult): PointTableRow[] {
  const points = chart.points ?? {};
  const resolvePointPlacement = (point: AstroPointName): PlanetPlacement | undefined => {
    if (point in points) {
      return points[point];
    }
    if (point in chart.planets) {
      return chart.planets[point as PlanetName];
    }
    if (point === "Ascendant") return chart.angles?.ascendant;
    if (point === "Descendant") return chart.angles?.descendant;
    if (point === "MC") return chart.angles?.mc;
    if (point === "IC") return chart.angles?.ic;
    if (point === "Vertex") return chart.angles?.vertex;
    return undefined;
  };
  return ASTRO_POINTS.map((point) => {
    const placement = resolvePointPlacement(point);
    return {
      point,
      symbol: POINT_SYMBOL[point],
      sign: placement?.sign ?? "--",
      degree: formatDegreeValue(placement?.degree),
      longitude: formatLongitudeValue(placement?.longitude),
    };
  });
}

export function buildHouseTableRows(chart: ChartResult): HouseTableRow[] {
  if (!chart.houses || chart.houses.length === 0) return [];
  return [...chart.houses]
    .sort((left, right) => left.house - right.house)
    .map((house) => ({
      house: house.house,
      sign: house.sign,
      degree: formatDegreeValue(house.degree),
      longitude: formatLongitudeValue(house.longitude),
    }));
}

export function buildAspectTableRows(chart: ChartResult): Aspect[] {
  return [...chart.aspects].sort((left, right) => (left.orb ?? 0) - (right.orb ?? 0));
}

function resolveDignityStatus(planet: PlanetName, sign: ZodiacSign): DignityStatus {
  const rules = DIGNITY_RULES[planet];
  if (rules.exaltation === sign) return "exaltation";
  if (rules.fall === sign) return "fall";
  if (rules.domicile.includes(sign)) return "domicile";
  if (rules.detriment.includes(sign)) return "detriment";
  return "neutral";
}

export function buildDignityRows(chart: ChartResult): DignityTableRow[] {
  return PLANETS
    .map((planet) => {
      const sign = chart.planets[planet].sign;
      return {
        planet,
        sign,
        status: resolveDignityStatus(planet, sign),
      };
    });
}
