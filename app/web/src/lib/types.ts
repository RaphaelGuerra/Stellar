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

export type AstroPointName =
  | PlanetName
  | "TrueNode"
  | "MeanNode"
  | "Chiron"
  | "Lilith"
  | "Fortune"
  | "Ascendant"
  | "Descendant"
  | "MC"
  | "IC"
  | "Vertex";

export type AngleName = "Ascendant" | "Descendant" | "MC" | "IC" | "Vertex";

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

export type HouseSystem = "Placidus" | "WholeSign" | "Equal" | "Koch";
export type AspectProfile = "major" | "expanded";
export type OrbMode = "standard" | "tight" | "wide";
export type PrimaryArea = "chart" | "transits" | "timing" | "relationships" | "atlas" | "library";

export interface ChartSettings {
  zodiac: "tropical";
  houseSystem: HouseSystem;
  aspectProfile: AspectProfile;
  orbMode: OrbMode;
  includeMinorAspects: boolean;
}

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
  unavailableReason?: string;
}

export interface HousePlacement {
  house: HouseNumber;
  sign: ZodiacSign;
  degree?: number; // 0-29.999 within the sign (cusp)
  longitude?: number;
  system?: HouseSystem;
}

// Legacy planet-only aspect (kept for compatibility with the existing app surfaces).
export interface Aspect {
  a: PlanetName;
  b: PlanetName;
  type: AspectName;
  orb?: number; // distance from exact aspect, in degrees
}

export interface AstroAspect {
  a: AstroPointName;
  b: AstroPointName;
  type: AspectName;
  orb?: number;
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

export interface ChartMeta {
  engine: "astronomy-engine" | "swiss-ephemeris";
  adapter: "AstronomyEngineAdapter" | "SwissEphemerisAdapter";
  settingsHash: string;
  warnings: string[];
}

export interface ChartResultV2 {
  // Keep raw inputs for reproducibility, and normalized data for the engine.
  input: ChartInput;
  settings: ChartSettings;
  normalized: ChartInputNormalized;
  points: Partial<Record<AstroPointName, PlanetPlacement>>;
  // Legacy alias surface consumed by existing app modules.
  planets: Record<PlanetName, PlanetPlacement>;
  angles?: {
    ascendant: PlanetPlacement;
    descendant?: PlanetPlacement;
    mc?: PlanetPlacement;
    ic?: PlanetPlacement;
    vertex?: PlanetPlacement;
  };
  houses?: HousePlacement[];
  aspects: Aspect[];
  // Optional expanded aspect list for newer modules.
  pointAspects?: AstroAspect[];
  meta: ChartMeta;
}

export type ChartResult = ChartResultV2;

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
