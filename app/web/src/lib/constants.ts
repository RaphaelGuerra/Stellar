import type { AspectName, AstroPointName, ChartSettings, HouseSystem, PlanetName, ZodiacSign } from "./types";

export type ElementName = "fire" | "earth" | "air" | "water";

export const SIGNS: ZodiacSign[] = [
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

export const PLANETS: PlanetName[] = [
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

export const ASTRO_POINTS: AstroPointName[] = [
  ...PLANETS,
  "TrueNode",
  "MeanNode",
  "Chiron",
  "Lilith",
  "Fortune",
  "Ascendant",
  "Descendant",
  "MC",
  "IC",
  "Vertex",
];

export const HOUSE_SYSTEMS: HouseSystem[] = ["Placidus", "WholeSign", "Equal", "Koch"];

export const DEFAULT_CHART_SETTINGS: ChartSettings = {
  zodiac: "tropical",
  houseSystem: "Placidus",
  aspectProfile: "major",
  orbMode: "standard",
  includeMinorAspects: false,
};

export const PLANET_SYMBOL: Record<PlanetName, string> = {
  Sun: "\u2609",
  Moon: "\u263D",
  Mercury: "\u263F",
  Venus: "\u2640",
  Mars: "\u2642",
  Jupiter: "\u2643",
  Saturn: "\u2644",
  Uranus: "\u2645",
  Neptune: "\u2646",
  Pluto: "\u2647",
};

export const POINT_SYMBOL: Record<AstroPointName, string> = {
  ...PLANET_SYMBOL,
  TrueNode: "\u260A",
  MeanNode: "\u260B",
  Chiron: "\u26B7",
  Lilith: "\u26B8",
  Fortune: "\u2297",
  Ascendant: "ASC",
  Descendant: "DSC",
  MC: "MC",
  IC: "IC",
  Vertex: "VTX",
};

export const SIGN_SYMBOL: Record<ZodiacSign, string> = {
  Aries: "\u2648",
  Taurus: "\u2649",
  Gemini: "\u264A",
  Cancer: "\u264B",
  Leo: "\u264C",
  Virgo: "\u264D",
  Libra: "\u264E",
  Scorpio: "\u264F",
  Sagittarius: "\u2650",
  Capricorn: "\u2651",
  Aquarius: "\u2652",
  Pisces: "\u2653",
};

export const ASPECT_SYMBOL: Record<AspectName, string> = {
  Conjunction: "\u260C",
  Opposition: "\u260D",
  Square: "\u25A1",
  Trine: "\u25B3",
  Sextile: "\u2736",
  Quincunx: "\u26BB",
  Semisextile: "\u26BA",
  Semisquare: "\u2220",
  Sesquiquadrate: "\u26BC",
  Quintile: "Q",
  Biquintile: "bQ",
};

export const SIGN_INDEX: Record<ZodiacSign, number> = {
  Aries: 0,
  Taurus: 1,
  Gemini: 2,
  Cancer: 3,
  Leo: 4,
  Virgo: 5,
  Libra: 6,
  Scorpio: 7,
  Sagittarius: 8,
  Capricorn: 9,
  Aquarius: 10,
  Pisces: 11,
};

export const SIGN_ELEMENT: Record<ZodiacSign, ElementName> = {
  Aries: "fire",
  Taurus: "earth",
  Gemini: "air",
  Cancer: "water",
  Leo: "fire",
  Virgo: "earth",
  Libra: "air",
  Scorpio: "water",
  Sagittarius: "fire",
  Capricorn: "earth",
  Aquarius: "air",
  Pisces: "water",
};

export interface AspectDefinition {
  type: AspectName;
  angle: number;
  orb: number;
}

export const MAJOR_ASPECT_DEFS: AspectDefinition[] = [
  { type: "Conjunction", angle: 0, orb: 8 },
  { type: "Opposition", angle: 180, orb: 8 },
  { type: "Square", angle: 90, orb: 6 },
  { type: "Trine", angle: 120, orb: 6 },
  { type: "Sextile", angle: 60, orb: 4 },
];

export const EXPANDED_ASPECT_DEFS: AspectDefinition[] = [
  { type: "Quincunx", angle: 150, orb: 3 },
  { type: "Semisquare", angle: 45, orb: 2 },
  { type: "Sesquiquadrate", angle: 135, orb: 2 },
];

export const MINOR_ASPECT_DEFS: AspectDefinition[] = [
  { type: "Semisextile", angle: 30, orb: 2 },
  { type: "Quintile", angle: 72, orb: 2 },
  { type: "Biquintile", angle: 144, orb: 2 },
];

// Keep legacy export name stable for modules that only need the 5 major definitions.
export const ASPECT_DEFS: AspectDefinition[] = MAJOR_ASPECT_DEFS;

export function allAspectDefinitions(): AspectDefinition[] {
  return [...MAJOR_ASPECT_DEFS, ...EXPANDED_ASPECT_DEFS, ...MINOR_ASPECT_DEFS];
}

export function resolveAspectDefinitions(settings: ChartSettings): AspectDefinition[] {
  const defs: AspectDefinition[] = [...MAJOR_ASPECT_DEFS];
  if (settings.aspectProfile === "expanded") {
    defs.push(...EXPANDED_ASPECT_DEFS);
  }
  if (settings.includeMinorAspects) {
    defs.push(...MINOR_ASPECT_DEFS);
  }
  return defs;
}

export function getOrbMultiplier(mode: ChartSettings["orbMode"]): number {
  if (mode === "tight") return 0.8;
  if (mode === "wide") return 1.2;
  return 1;
}

export function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

export function getPlanetSymbol(planet: PlanetName): string {
  return PLANET_SYMBOL[planet];
}

export function getPointSymbol(point: AstroPointName): string {
  return POINT_SYMBOL[point];
}

export function getSignSymbol(sign: ZodiacSign): string {
  return SIGN_SYMBOL[sign];
}

export function getElement(sign: ZodiacSign): ElementName {
  return SIGN_ELEMENT[sign];
}

export function normalizeChartSettings(settings?: Partial<ChartSettings>): ChartSettings {
  const houseSystem = HOUSE_SYSTEMS.includes((settings?.houseSystem ?? "") as HouseSystem)
    ? (settings?.houseSystem as HouseSystem)
    : DEFAULT_CHART_SETTINGS.houseSystem;
  const aspectProfile = settings?.aspectProfile === "expanded" ? "expanded" : "major";
  const orbMode =
    settings?.orbMode === "tight" || settings?.orbMode === "wide" || settings?.orbMode === "standard"
      ? settings.orbMode
      : DEFAULT_CHART_SETTINGS.orbMode;
  return {
    zodiac: "tropical",
    houseSystem,
    aspectProfile,
    orbMode,
    includeMinorAspects:
      typeof settings?.includeMinorAspects === "boolean"
        ? settings.includeMinorAspects
        : DEFAULT_CHART_SETTINGS.includeMinorAspects,
  };
}

export function serializeSettings(settings: ChartSettings): string {
  return JSON.stringify({
    zodiac: settings.zodiac,
    houseSystem: settings.houseSystem,
    aspectProfile: settings.aspectProfile,
    orbMode: settings.orbMode,
    includeMinorAspects: settings.includeMinorAspects,
  });
}
