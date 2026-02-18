export type PlanetName =
  | "Sun"
  | "Moon"
  | "Mercury"
  | "Venus"
  | "Mars"
  | "Jupiter"
  | "Saturn"
  | "Uranus"
  | "Neptune"
  | "Pluto";

export type AspectName =
  | "Conjunction"
  | "Opposition"
  | "Square"
  | "Trine"
  | "Sextile";

export type ZodiacSign =
  | "Aries"
  | "Taurus"
  | "Gemini"
  | "Cancer"
  | "Leo"
  | "Virgo"
  | "Libra"
  | "Scorpio"
  | "Sagittarius"
  | "Capricorn"
  | "Aquarius"
  | "Pisces";

export type HouseNumber =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12;

export interface ChartInput {
  // Raw strings keep user intent intact and avoid timezone parsing on the UI side.
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:mm"
  city: string;
  country: string;
  location?: CityResolution;
  daylight_saving: boolean | "auto";
}

export interface ChartInputNormalized {
  // Local + UTC are both stored for audit and deterministic replays.
  localDateTime: string; // "YYYY-MM-DDTHH:mm"
  utcDateTime: string; // ISO 8601, with "Z"
  timezone: string; // IANA tz id, e.g. "America/Sao_Paulo"
  offsetMinutes: number; // final offset used to compute UTC
  daylightSaving: boolean; // resolved value after "auto"
  location: {
    lat: number;
    lon: number;
  };
}

export interface PlanetPlacement {
  sign: ZodiacSign;
  degree?: number; // 0-29.999 within the sign
  longitude?: number; // 0-359.999 ecliptic longitude
}

export interface HousePlacement {
  house: HouseNumber;
  sign: ZodiacSign;
  degree?: number; // 0-29.999 within the sign (cusp)
}

export interface Aspect {
  a: PlanetName;
  b: PlanetName;
  type: AspectName;
  orb?: number; // distance from exact aspect, in degrees
}

export interface CityQuery {
  city: string;
  country: string;
}

export interface CityResolution {
  lat: number;
  lon: number;
  timezone: string;
}

export interface ChartResult {
  // Keep raw inputs for reproducibility, and normalized data for the engine.
  input: ChartInput;
  normalized: ChartInputNormalized;
  planets: Record<PlanetName, PlanetPlacement>;
  angles?: {
    ascendant: PlanetPlacement;
  };
  houses?: HousePlacement[]; // optional until house calculation is in place
  aspects: Aspect[]; // can be empty when aspects are not computed
}

export type ComparisonHighlightKind =
  | "synastry-aspect"
  | "synastry-theme"
  | "overlay"
  | "summary";

export type ChartRef = "A" | "B";

export interface PlanetRef {
  chart: ChartRef;
  planet: PlanetName;
}

export interface ComparisonAspect {
  a: PlanetRef;
  b: PlanetRef;
  type: AspectName;
  orb?: number;
}

export type AspectTone = "harmonious" | "challenging" | "intense";
export type DuoMode = "romantic" | "friend";
export type SynastryStatKey = "attraction" | "communication" | "stability" | "growth";
export type LifeArea = "love" | "friends" | "family";

export interface DetailBlock {
  title: string;
  text: string;
}

export interface SynastryStat {
  key: SynastryStatKey;
  label: string;
  score: number; // normalized 0-100
  summary: string;
}

export interface ComparisonHighlight {
  // Card-friendly model for the UI; keep this stable for rendering.
  key: string;
  kind: ComparisonHighlightKind;
  title: string;
  subtitle?: string;
  text: string;
  tags: readonly string[];
  details?: readonly DetailBlock[];
  tone?: AspectTone;
  score?: number; // higher means more prominent
  related?: {
    aspect?: ComparisonAspect;
    planets?: PlanetRef[];
    houses?: HouseNumber[];
  };
}

export interface ChartComparison {
  chartA: ChartResult;
  chartB: ChartResult;
  highlights: ComparisonHighlight[];
  aspects?: ComparisonAspect[]; // optional detailed synastry list
  stats: SynastryStat[];
}

export interface MapHouse {
  house: number;
  cuspLongitude: number;
  sign: ZodiacSign;
  degree: number;
  beta: boolean;
}

export interface MapPlanetPoint {
  chart: "A" | "B";
  planet: PlanetName;
  longitude: number;
  x: number;
  y: number;
}

export interface MapAspectLine {
  type: AspectName;
  tone: AspectTone;
  orb?: number;
  from: MapPlanetPoint;
  to: MapPlanetPoint;
}

export interface AstralMapModel {
  houses: MapHouse[];
  planets: MapPlanetPoint[];
  lines: MapAspectLine[];
  mode: "single" | "compatibility";
  usedAscendantFallback?: boolean;
}

export interface MatchScorecard {
  area: LifeArea;
  score: number;
  status: "good" | "mixed" | "bad";
  summary: string;
  topSupportAspect?: string;
  topTensionAspect?: string;
}
