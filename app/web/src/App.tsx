import { useState, useEffect, useMemo, useCallback, useRef, type ChangeEvent, type FormEvent } from "react";
import { useContentMode } from "./content/useContentMode";
import { ModeToggle } from "./components/ModeToggle";
import { Card } from "./components/Card";
import { Section } from "./components/Section";
import { PlacementsSummary } from "./components/PlacementsSummary";
import { LoadingState } from "./components/LoadingState";
import { PersonForm } from "./components/PersonForm";
import { AstralMapThumbnail } from "./components/AstralMapThumbnail";
import { AstralMapModal } from "./components/AstralMapModal";
import { MatchScorecards } from "./components/MatchScorecards";
import { AstrocartographyMap } from "./components/AstrocartographyMap";
import { buildCards, buildPlacementsSummary, type CardModel, type PlacementSummary } from "./lib/cards";
import type {
  AnnualProfectionResult,
  AstrocartographyLine,
  AstrocartographyResult,
  ReturnChartResult,
  SecondaryProgressionResult,
  TransitRangeResult,
} from "./lib/engine";
import { buildChartComparison } from "./lib/synastry";
import { buildDailyTransitOutlook } from "./lib/transits";
import { buildAstralMapModelCompatibility, buildAstralMapModelSingle } from "./lib/astralMap";
import { buildMatchScorecards } from "./lib/matchScorecards";
import { generateChartInWorker, runAstroWorkerTask } from "./lib/astroWorkerClient";
import {
  ASPECT_SYMBOL,
  ASTRO_POINTS,
  DEFAULT_CHART_SETTINGS,
  HOUSE_SYSTEMS,
  PLANETS,
  POINT_SYMBOL,
  SIGN_SYMBOL,
} from "./lib/constants";
import {
  ADVANCED_OVERLAYS_UNLOCK_XP,
  DEFAULT_PROGRESSION_STATE,
  awardQuestCompletion,
  awardQuestReflection,
  buildRelationshipQuest,
  getAdvancedOverlaysUnlockXp,
  getDetailUnlockCount,
  getLocalDayKey,
  getNextDetailUnlockXp,
  hasCompletedQuest,
  hasReflectedQuest,
  isAdvancedOverlaysUnlocked,
  type RelationshipQuest,
} from "./lib/progression";
import {
  buildAdvancedOverlaySummary,
  buildCompatibilityForecast,
  type ForecastRange,
} from "./lib/phase5";
import {
  APP_STATE_RETENTION_DAYS,
  HISTORY_LIMIT,
  clearPersistedAppState,
  readPersistedAppState,
  readPrivacySettings,
  writePrivacySettings,
  writePersistedAppState,
  type PersistedHistoryEntry,
} from "./lib/appState";
import { validateChartInput, type ValidationErrorCode } from "./lib/validation";
import { useGeoSearch, resolveLocationCandidates, type GeoSuggestion } from "./lib/useGeoSearch";
import { SUPPORTED_CITIES, resolveCity } from "./lib/resolveCity";
import type {
  Aspect,
  AstroPointName,
  ChartInput,
  ChartResult,
  ChartSettings,
  DuoMode,
  LifeArea,
  PlanetName,
  PlanetPlacement,
  PrimaryArea,
  ZodiacSign,
} from "./lib/types";

type AnalysisMode = "single" | "compatibility";

interface AtlasShortlistEntry {
  label: string;
  score: number;
  nearestLines: string[];
}

type AtlasGoalFocus = "career" | "relationships" | "home" | "growth";

interface AtlasCrossingEntry {
  key: string;
  pairLabel: string;
  distance: number;
  interpretation: string;
}

interface AtlasInspectorLineEntry {
  key: string;
  label: string;
  distance: number;
  interpretation: string;
}

interface AtlasInspectorResultEntry {
  locationLabel: string;
  locationLat: number;
  locationLon: number;
  nearestLines: AtlasInspectorLineEntry[];
  strongestCrossing?: AtlasCrossingEntry;
}

type DignityStatus = "domicile" | "exaltation" | "detriment" | "fall" | "neutral";

interface PointTableRow {
  point: AstroPointName;
  symbol: string;
  sign: ZodiacSign | "--";
  degree: string;
  longitude: string;
}

interface HouseTableRow {
  house: number;
  sign: ZodiacSign | "--";
  degree: string;
  longitude: string;
}

interface DignityTableRow {
  planet: PlanetName;
  sign: ZodiacSign;
  status: DignityStatus;
}

interface TransitThemeEntry {
  key: string;
  label: string;
  count: number;
  bestOrb: number;
}

interface TransitExactHitDayGroup {
  date: string;
  hits: TransitRangeResult["exactHits"];
}

interface TarotCardEntry {
  name: string;
  meaningEn: string;
  meaningPt: string;
}

const TRANSIT_PAGE_SIZE = 10;
const DEFAULT_REMINDER_RULES = {
  enabled: false,
  leadDays: 1,
  maxOrb: 0.4,
};

const DIGNITY_RULES: Record<PlanetName, {
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

function formatDegreeValue(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${value.toFixed(1)}deg`;
}

function formatLongitudeValue(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${value.toFixed(2)}deg`;
}

const TAROT_CARDS: TarotCardEntry[] = [
  { name: "The Fool", meaningEn: "New path, leap with trust, stay aware.", meaningPt: "Novo caminho, salta com fe e consciencia." },
  { name: "The Magician", meaningEn: "Focus intention and use what you already have.", meaningPt: "Foca a intencao e usa o que ja ta na mao." },
  { name: "The High Priestess", meaningEn: "Listen to intuition before acting.", meaningPt: "Escuta a intuicao antes de agir." },
  { name: "The Empress", meaningEn: "Nurture growth and body rhythms.", meaningPt: "Nutre crescimento e ritmo do corpo." },
  { name: "The Emperor", meaningEn: "Build structure and hold boundaries.", meaningPt: "Cria estrutura e segura limite." },
  { name: "The Lovers", meaningEn: "Choose alignment over impulse.", meaningPt: "Escolhe alinhamento, nao impulso." },
  { name: "The Chariot", meaningEn: "Move with discipline and direction.", meaningPt: "Avanca com disciplina e direcao." },
  { name: "Strength", meaningEn: "Steady courage beats force.", meaningPt: "Coragem constante vale mais que forca bruta." },
  { name: "The Hermit", meaningEn: "Step back to hear your inner signal.", meaningPt: "Da um passo atras pra ouvir teu sinal interno." },
  { name: "Wheel of Fortune", meaningEn: "Cycle is turning; stay adaptable.", meaningPt: "O ciclo virou; adapta rapido." },
  { name: "Justice", meaningEn: "Consequences are clear; choose cleanly.", meaningPt: "Consequencia ta clara; escolhe com limpidez." },
  { name: "The Star", meaningEn: "Recover hope and long-range vision.", meaningPt: "Recupera esperanca e visao de longo prazo." },
];

function buildMoonPhaseInfo(dateIso: string, isCarioca: boolean): { phaseLabel: string; illuminationLabel: string } {
  const target = Date.parse(`${dateIso}T12:00:00Z`);
  const epoch = Date.parse("2000-01-06T18:14:00Z");
  const synodicMonth = 29.530588853;
  const days = (target - epoch) / 86400000;
  const phase = ((days / synodicMonth) % 1 + 1) % 1;
  const illumination = Math.round((((1 - Math.cos(2 * Math.PI * phase)) / 2) * 100) * 10) / 10;
  let phaseLabel = "New Moon";
  if (phase >= 0.125 && phase < 0.25) phaseLabel = "Waxing Crescent";
  else if (phase >= 0.25 && phase < 0.375) phaseLabel = "First Quarter";
  else if (phase >= 0.375 && phase < 0.5) phaseLabel = "Waxing Gibbous";
  else if (phase >= 0.5 && phase < 0.625) phaseLabel = "Full Moon";
  else if (phase >= 0.625 && phase < 0.75) phaseLabel = "Waning Gibbous";
  else if (phase >= 0.75 && phase < 0.875) phaseLabel = "Last Quarter";
  else if (phase >= 0.875) phaseLabel = "Waning Crescent";
  if (isCarioca) {
    const translated: Record<string, string> = {
      "New Moon": "Lua Nova",
      "Waxing Crescent": "Crescente",
      "First Quarter": "Quarto Crescente",
      "Waxing Gibbous": "Gibosa Crescente",
      "Full Moon": "Lua Cheia",
      "Waning Gibbous": "Gibosa Minguante",
      "Last Quarter": "Quarto Minguante",
      "Waning Crescent": "Minguante",
    };
    phaseLabel = translated[phaseLabel] ?? phaseLabel;
  }
  return {
    phaseLabel,
    illuminationLabel: isCarioca ? `${illumination.toFixed(1)}% iluminada` : `${illumination.toFixed(1)}% illuminated`,
  };
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(value: string): Date {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return new Date();
  return new Date(parsed);
}

function shiftIsoDate(value: string, days: number): string {
  const next = parseIsoDate(value);
  next.setUTCDate(next.getUTCDate() + days);
  return formatIsoDate(next);
}

function dayDistanceFrom(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return Number.NaN;
  return Math.round((end - start) / 86400000);
}

function toLocationLabel(city: string, country: string): string {
  const trimmedCity = city.trim();
  const trimmedCountry = country.trim();
  if (!trimmedCity) return trimmedCountry;
  if (!trimmedCountry) return trimmedCity;
  return `${trimmedCity}, ${trimmedCountry}`;
}

function chartToSuggestion(chart: ChartResult): GeoSuggestion {
  const lat = chart.input.location?.lat ?? chart.normalized.location.lat;
  const lon = chart.input.location?.lon ?? chart.normalized.location.lon;
  const timezone = chart.input.location?.timezone ?? chart.normalized.timezone;
  const label = toLocationLabel(chart.input.city, chart.input.country);
  return {
    id: `history-${chart.input.city}-${chart.input.country}-${lat}-${lon}-${timezone}`,
    label,
    city: chart.input.city,
    country: chart.input.country,
    lat,
    lon,
    timezone,
  };
}

function makeHistorySignature(
  analysisMode: AnalysisMode,
  duoMode: DuoMode,
  chartA: ChartResult,
  chartB: ChartResult | null
): string {
  return [
    analysisMode,
    duoMode,
    chartA.normalized.utcDateTime,
    chartA.normalized.timezone,
    chartB?.normalized.utcDateTime ?? "",
    chartB?.normalized.timezone ?? "",
  ].join("|");
}

function toSignedLongitude(value: number): number {
  const normalized = ((value % 360) + 360) % 360;
  return normalized > 180 ? normalized - 360 : normalized;
}

function longitudeDistanceDegrees(a: number, b: number): number {
  const delta = Math.abs(a - b);
  return delta > 180 ? 360 - delta : delta;
}

function parseSupportedCityLabel(label: string): { city: string; country: string } | null {
  const parts = label.split(",");
  if (parts.length < 2) return null;
  const country = parts[parts.length - 1]?.trim();
  const city = parts.slice(0, -1).join(",").trim();
  if (!city || !country) return null;
  return { city, country };
}

function classifyAtlasPoint(point: AstrocartographyLine["point"]): "supportive" | "intense" | "neutral" {
  if (point === "Venus" || point === "Jupiter" || point === "Sun") return "supportive";
  if (point === "Mars" || point === "Saturn" || point === "Pluto") return "intense";
  return "neutral";
}

function buildCrossingInterpretation(
  left: AstrocartographyLine,
  right: AstrocartographyLine,
  isCarioca: boolean
): string {
  const toneLeft = classifyAtlasPoint(left.point);
  const toneRight = classifyAtlasPoint(right.point);
  const hasCareerAngle = left.angle === "MC" || right.angle === "MC";
  const hasRelationshipAngle = left.angle === "DSC" || right.angle === "DSC";
  const hasIdentityAngle = left.angle === "ASC" || right.angle === "ASC";

  if (toneLeft === "supportive" && toneRight === "supportive") {
    return isCarioca
      ? "Zona boa pra crescimento com apoio natural."
      : "Supportive zone with strong growth potential.";
  }
  if (toneLeft === "intense" || toneRight === "intense") {
    return isCarioca
      ? "Zona de pressao; pede disciplina e ajuste fino."
      : "Pressure zone that rewards discipline and clear boundaries.";
  }
  if (hasCareerAngle) {
    return isCarioca ? "Foco forte em carreira e direcao publica." : "Strong emphasis on career and public direction.";
  }
  if (hasRelationshipAngle) {
    return isCarioca
      ? "Ativa relacoes e pactos com outras pessoas."
      : "Activates relationship dynamics and partnership commitments.";
  }
  if (hasIdentityAngle) {
    return isCarioca ? "Puxa reinvencao pessoal e autonomia." : "Pulls personal reinvention and autonomy.";
  }
  return isCarioca ? "Mistura neutra; observa no dia a dia." : "Mixed neutral crossing; validate through lived experience.";
}

function buildAtlasLineInterpretation(line: AstrocartographyLine, isCarioca: boolean): string {
  const tone = classifyAtlasPoint(line.point);
  if (line.angle === "MC") {
    return isCarioca
      ? "Linha de visibilidade publica e direcao de carreira."
      : "Career and public visibility line.";
  }
  if (line.angle === "ASC") {
    return isCarioca ? "Linha de identidade e reinvencao pessoal." : "Identity and personal reinvention line.";
  }
  if (line.angle === "DSC") {
    return isCarioca ? "Linha de encontros, parceria e espelhamento." : "Partnership and relational mirroring line.";
  }
  if (tone === "supportive") {
    return isCarioca ? "Tom favoravel, com apoio natural." : "Supportive tone with natural ease.";
  }
  if (tone === "intense") {
    return isCarioca ? "Tom intenso, pede estrategia e limite." : "Intense tone that rewards strategy and boundaries.";
  }
  return isCarioca ? "Tom neutro, valida no cotidiano." : "Neutral tone; validate through lived experience.";
}

function buildAtlasCrossings(
  astrocartography: AstrocartographyResult | null,
  isCarioca: boolean
): AtlasCrossingEntry[] {
  if (!astrocartography || astrocartography.lines.length < 2) return [];
  const entries: AtlasCrossingEntry[] = [];
  for (let i = 0; i < astrocartography.lines.length; i++) {
    for (let j = i + 1; j < astrocartography.lines.length; j++) {
      const left = astrocartography.lines[i];
      const right = astrocartography.lines[j];
      if (left.point === right.point && left.angle === right.angle) continue;
      const distance = longitudeDistanceDegrees(left.longitude, right.longitude);
      if (distance > 1.5) continue;
      const pairLabel = `${left.point} ${left.angle} × ${right.point} ${right.angle}`;
      entries.push({
        key: `${left.point}-${left.angle}-${right.point}-${right.angle}`,
        pairLabel,
        distance: Math.round(distance * 10) / 10,
        interpretation: buildCrossingInterpretation(left, right, isCarioca),
      });
    }
  }
  return entries.sort((a, b) => a.distance - b.distance).slice(0, 8);
}

function atlasGoalWeight(line: AstrocartographyLine, goal: AtlasGoalFocus): number {
  if (goal === "career") {
    if (line.angle === "MC" && (line.point === "Sun" || line.point === "Jupiter")) return 2.2;
    if (line.angle === "MC" || line.angle === "ASC") return 1.5;
    if (line.point === "Saturn") return 1.2;
    return 1;
  }
  if (goal === "relationships") {
    if (line.angle === "DSC" && (line.point === "Venus" || line.point === "Moon")) return 2.3;
    if (line.angle === "DSC") return 1.7;
    if (line.point === "Venus" || line.point === "Jupiter") return 1.4;
    return 1;
  }
  if (goal === "home") {
    if (line.angle === "IC" && (line.point === "Moon" || line.point === "Venus")) return 2.3;
    if (line.angle === "IC") return 1.7;
    if (line.point === "Moon") return 1.5;
    return 1;
  }
  if (line.point === "Jupiter" || line.point === "Sun") return 2;
  if (line.angle === "ASC" || line.angle === "MC") return 1.6;
  return 1.1;
}

function buildAtlasShortlist(
  astrocartography: AstrocartographyResult | null,
  goal: AtlasGoalFocus
): AtlasShortlistEntry[] {
  if (!astrocartography || astrocartography.lines.length === 0) return [];
  const candidates: AtlasShortlistEntry[] = [];
  for (const label of SUPPORTED_CITIES) {
    const parsed = parseSupportedCityLabel(label);
    if (!parsed) continue;
    try {
      const resolved = resolveCity(parsed);
      const cityLongitude = toSignedLongitude(resolved.lon);
      const nearest = astrocartography.lines
        .map((line) => ({
          line,
          distance: longitudeDistanceDegrees(cityLongitude, line.longitude),
        }))
        .sort((left, right) => left.distance - right.distance)
        .slice(0, 4);
      if (nearest.length === 0 || nearest[0].distance > 6) continue;
      const score = nearest.reduce(
        (sum, hit) => sum + Math.max(0, 6 - hit.distance) * atlasGoalWeight(hit.line, goal),
        0
      );
      candidates.push({
        label,
        score: Math.round(score * 10) / 10,
        nearestLines: nearest.slice(0, 3).map((hit) => `${hit.line.point} ${hit.line.angle} (${hit.distance.toFixed(1)}deg)`),
      });
    } catch {
      // Skip any malformed fallback labels.
    }
  }
  return candidates.sort((left, right) => right.score - left.score).slice(0, 6);
}

function buildAtlasInspectorResult(
  astrocartography: AstrocartographyResult | null,
  location: GeoSuggestion,
  crossings: AtlasCrossingEntry[],
  isCarioca: boolean
): AtlasInspectorResultEntry | null {
  if (!astrocartography || astrocartography.lines.length === 0) return null;
  const signedLongitude = toSignedLongitude(location.lon);
  const nearestLines = astrocartography.lines
    .map((line) => ({
      line,
      distance: longitudeDistanceDegrees(signedLongitude, line.longitude),
    }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, 5)
    .map((entry) => ({
      key: `${entry.line.point}-${entry.line.angle}-${entry.line.longitude}`,
      label: `${entry.line.point} ${entry.line.angle}`,
      distance: Math.round(entry.distance * 10) / 10,
      interpretation: buildAtlasLineInterpretation(entry.line, isCarioca),
    }));
  const nearestLabels = new Set(nearestLines.map((line) => line.label));
  const strongestCrossing = crossings.find((crossing) => {
    const [left, right] = crossing.pairLabel.split(" × ");
    return nearestLabels.has(left) || nearestLabels.has(right);
  });
  return {
    locationLabel: location.label,
    locationLat: location.lat,
    locationLon: location.lon,
    nearestLines,
    strongestCrossing,
  };
}

const EN_VALIDATION_MESSAGES: Record<ValidationErrorCode, string> = {
  DATE_REQUIRED: "Date is required.",
  DATE_FORMAT_INVALID: "Invalid date format (expected: YYYY-MM-DD).",
  DATE_INVALID: "Invalid calendar date.",
  DATE_TOO_OLD: "Date must be later than 1900.",
  TIME_REQUIRED: "Time is required.",
  TIME_FORMAT_INVALID: "Invalid time format (expected: HH:mm).",
  CITY_REQUIRED: "City and country are required (e.g. New York, US).",
  CITY_TOO_SHORT: "City name must have at least 2 characters.",
  COUNTRY_TOO_SHORT: "Country code must have at least 2 characters.",
  DATE_IN_FUTURE: "Date/time cannot be in the future.",
  TIMEZONE_INVALID: "Invalid timezone for the selected location.",
};

const CARIOCA_VALIDATION_MESSAGES: Record<ValidationErrorCode, string> = {
  DATE_REQUIRED: "Sem data nao rola, porra.",
  DATE_FORMAT_INVALID: "A data ta zoada, mermão. Usa YYYY-MM-DD sem inventar moda.",
  DATE_INVALID: "Essa data ai ta errada pra caralho.",
  DATE_TOO_OLD: "Ta puxando data jurassica demais. Manda depois de 1900.",
  TIME_REQUIRED: "Sem hora nao tem mapa, caralho.",
  TIME_FORMAT_INVALID: "Hora toda cagada. Usa HH:mm certinho.",
  CITY_REQUIRED: "Manda cidade e pais direito, porra. Ex: Rio de Janeiro, BR.",
  CITY_TOO_SHORT: "Nome de cidade com 1 letra e sacanagem. Bota pelo menos 2.",
  COUNTRY_TOO_SHORT: "Codigo do pais ta curto pra cacete. Usa pelo menos 2 letras.",
  DATE_IN_FUTURE: "Nascer no futuro nao da, ne porra.",
  TIMEZONE_INVALID: "Timezone dessa localizacao veio toda errada.",
};

function formatValidationMessages(errors: readonly ValidationErrorCode[], isCarioca: boolean): string[] {
  const dictionary = isCarioca ? CARIOCA_VALIDATION_MESSAGES : EN_VALIDATION_MESSAGES;
  return errors.map((code) => dictionary[code]);
}

function hasErrorName(error: unknown, name: string): boolean {
  if (error instanceof Error && error.name === name) return true;
  if (typeof error === "object" && error !== null && "name" in error) {
    return (error as { name?: unknown }).name === name;
  }
  return false;
}

function formatRuntimeError(error: unknown, isCarioca: boolean): string {
  if (hasErrorName(error, "NonexistentLocalTimeError")) {
    return isCarioca
      ? "Esse horario nem existe nessa cidade, porra. Ajusta a hora e tenta de novo."
      : "That local time does not exist in this timezone. Please adjust the time and try again.";
  }
  if (hasErrorName(error, "AmbiguousLocalTimeError")) {
    return isCarioca
      ? "Esse horario ficou duplicado por causa de horario de verao. Escolhe Sim ou Nao e manda brasa."
      : "That local time is ambiguous due to daylight saving time. Choose Yes or No for daylight saving and try again.";
  }
  if (error instanceof Error && error.message.startsWith("Nominatim error:")) {
    return isCarioca
      ? "A busca de cidade travou aqui. Espera um tiquinho e tenta de novo."
      : "City search is temporarily unavailable. Please try again in a moment.";
  }
  const fallback = error instanceof Error ? error.message : String(error);
  if (!isCarioca) {
    return fallback || "Something went wrong. Please try again.";
  }
  return fallback ? `Deu ruim: ${fallback}` : "Deu merda aqui. Tenta de novo.";
}

function looksLikeChartResult(value: unknown): value is ChartResult {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ChartResult>;
  return (
    typeof candidate.input === "object" &&
    candidate.input !== null &&
    typeof candidate.normalized === "object" &&
    candidate.normalized !== null &&
    typeof candidate.planets === "object" &&
    candidate.planets !== null &&
    Array.isArray(candidate.aspects)
  );
}

function useSuggestionKeyboard(geo: { suggestions: GeoSuggestion[]; selectSuggestion: (s: GeoSuggestion) => void; showSuggestions: boolean }) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const currentIndex =
    activeIndex >= 0 && activeIndex < geo.suggestions.length ? activeIndex : -1;

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!geo.showSuggestions) return;
      const count = geo.suggestions.length;
      if (count === 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => {
          const base = prev >= 0 && prev < count ? prev : -1;
          return (base + 1) % count;
        });
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) => {
          const base = prev >= 0 && prev < count ? prev : 0;
          return base <= 0 ? count - 1 : base - 1;
        });
      } else if (event.key === "Enter" && currentIndex >= 0) {
        event.preventDefault();
        geo.selectSuggestion(geo.suggestions[currentIndex]);
        setActiveIndex(-1);
      } else if (event.key === "Escape") {
        event.preventDefault();
        setActiveIndex(-1);
      }
    },
    [currentIndex, geo]
  );

  return { activeIndex: currentIndex, onKeyDown };
}

function toDaylightSavingValue(ds: boolean | "auto"): string {
  return ds === "auto" ? "auto" : ds ? "true" : "false";
}

function parseDaylightSavingValue(value: string): boolean | "auto" {
  return value === "auto" ? "auto" : value === "true";
}

function formatPlacementLabel(
  placement: PlanetPlacement | undefined,
  emptyText: string
): string {
  if (!placement) return emptyText;
  if (placement.degree == null) return placement.sign;
  return `${placement.sign} ${placement.degree.toFixed(1)}°`;
}

function buildPointTableRows(chart: ChartResult): PointTableRow[] {
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

function buildHouseTableRows(chart: ChartResult): HouseTableRow[] {
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

function buildAspectTableRows(chart: ChartResult): Aspect[] {
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

function buildDignityRows(chart: ChartResult): DignityTableRow[] {
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

function buildTransitThemes(
  feed: TransitRangeResult | null,
  windowDays: number,
  isCarioca: boolean
): TransitThemeEntry[] {
  if (!feed || feed.days.length === 0 || feed.exactHits.length === 0) return [];
  const windowDates = new Set(feed.days.slice(0, Math.max(1, windowDays)).map((day) => day.date));
  const map = new Map<string, TransitThemeEntry>();
  for (const hit of feed.exactHits) {
    if (!windowDates.has(hit.date)) continue;
    const key = `${hit.transitPlanet}-${hit.aspect}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      if (hit.orb < existing.bestOrb) existing.bestOrb = hit.orb;
      continue;
    }
    map.set(key, {
      key,
      label: isCarioca
        ? `${hit.transitPlanet} ${hit.aspect}: foco em ${hit.natalPlanet}`
        : `${hit.transitPlanet} ${hit.aspect}: focus on ${hit.natalPlanet}`,
      count: 1,
      bestOrb: hit.orb,
    });
  }
  return Array.from(map.values())
    .sort((left, right) => right.count - left.count || left.bestOrb - right.bestOrb)
    .slice(0, 4);
}

function groupExactHitsByDate(feed: TransitRangeResult | null): TransitExactHitDayGroup[] {
  if (!feed || feed.exactHits.length === 0) return [];
  const map = new Map<string, TransitRangeResult["exactHits"]>();
  for (const hit of feed.exactHits) {
    const list = map.get(hit.date) ?? [];
    list.push(hit);
    map.set(hit.date, list);
  }
  return Array.from(map.entries())
    .map(([date, hits]) => ({
      date,
      hits: [...hits].sort((left, right) => left.orb - right.orb),
    }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

function App() {
  const { mode, setMode, content } = useContentMode();
  const isCarioca = mode === "carioca";
  const persisted = useMemo(() => readPersistedAppState(), []);
  const todayIso = useMemo(() => formatIsoDate(new Date()), []);
  const sharedImportInputRef = useRef<HTMLInputElement | null>(null);
  const reportExportRef = useRef<HTMLDivElement | null>(null);
  const [persistLocalData, setPersistLocalData] = useState(
    () => readPrivacySettings().persistLocalData
  );
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>(
    () => persisted?.analysisMode ?? "single"
  );
  const [primaryArea, setPrimaryArea] = useState<PrimaryArea>(() => persisted?.primaryArea ?? "chart");
  const [duoMode, setDuoMode] = useState<DuoMode>(() => persisted?.duoMode ?? "romantic");
  const [chartSettings, setChartSettings] = useState<ChartSettings>(
    () => persisted?.chartSettings ?? DEFAULT_CHART_SETTINGS
  );
  const [timeTravelDate, setTimeTravelDate] = useState<string>(
    () => persisted?.timeTravelDate ?? todayIso
  );

  // Person A state
  const [dateA, setDateA] = useState(() => persisted?.personA.date ?? "1990-01-01");
  const [timeA, setTimeA] = useState(() => persisted?.personA.time ?? "12:00");
  const [daylightSavingA, setDaylightSavingA] = useState<boolean | "auto">(
    () => persisted?.personA.daylightSaving ?? "auto"
  );
  const [showDaylightSavingOverrideA, setShowDaylightSavingOverrideA] = useState(false);
  const geoA = useGeoSearch(
    persisted?.personA.locationInput ?? "Rio de Janeiro, BR",
    isCarioca
  );

  // Person B state
  const [dateB, setDateB] = useState(() => persisted?.personB.date ?? "1990-01-01");
  const [timeB, setTimeB] = useState(() => persisted?.personB.time ?? "12:00");
  const [daylightSavingB, setDaylightSavingB] = useState<boolean | "auto">(
    () => persisted?.personB.daylightSaving ?? "auto"
  );
  const [showDaylightSavingOverrideB, setShowDaylightSavingOverrideB] = useState(false);
  const geoB = useGeoSearch(
    persisted?.personB.locationInput ?? "New York, US",
    isCarioca,
    analysisMode === "compatibility"
  );

  // Keyboard nav for suggestion lists
  const kbA = useSuggestionKeyboard(geoA);
  const kbB = useSuggestionKeyboard(geoB);

  // Chart state
  const [chart, setChart] = useState<ChartResult | null>(() => persisted?.lastChartA ?? null);
  const [chartB, setChartB] = useState<ChartResult | null>(() => persisted?.lastChartB ?? null);
  const [cards, setCards] = useState<CardModel[]>([]);
  const [resultVersion, setResultVersion] = useState(0);
  const [history, setHistory] = useState<PersistedHistoryEntry[]>(() => persisted?.history ?? []);
  const [progression, setProgression] = useState(() => persisted?.progression ?? DEFAULT_PROGRESSION_STATE);
  const [forecastRange, setForecastRange] = useState<ForecastRange>(7);
  const [placements, setPlacements] = useState<PlacementSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoRestored, setGeoRestored] = useState(false);
  const [showShootingStar, setShowShootingStar] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [transitRange, setTransitRange] = useState<1 | 7 | 30>(7);
  const [transitDayPage, setTransitDayPage] = useState<number>(() => persisted?.transitDayPage ?? 0);
  const [selectedTransitDate, setSelectedTransitDate] = useState<string>(() => persisted?.selectedTransitDate ?? "");
  const [transitFeed, setTransitFeed] = useState<TransitRangeResult | null>(null);
  const [progressed, setProgressed] = useState<SecondaryProgressionResult | null>(null);
  const [solarReturn, setSolarReturn] = useState<ReturnChartResult | null>(null);
  const [lunarReturn, setLunarReturn] = useState<ReturnChartResult | null>(null);
  const [profections, setProfections] = useState<AnnualProfectionResult | null>(null);
  const [saturnReturnHits, setSaturnReturnHits] = useState<Array<{ date: string; orb: number }> | null>(null);
  const [compositeChart, setCompositeChart] = useState<ChartResult | null>(null);
  const [davisonChart, setDavisonChart] = useState<ChartResult | null>(null);
  const [relationshipTransitFeed, setRelationshipTransitFeed] = useState<TransitRangeResult | null>(null);
  const [relationshipTransitDayPage, setRelationshipTransitDayPage] = useState(0);
  const [selectedRelationshipTransitDate, setSelectedRelationshipTransitDate] = useState("");
  const [astrocartography, setAstrocartography] = useState<AstrocartographyResult | null>(null);
  const [exportMessage, setExportMessage] = useState<string>("");
  const [tarotDraw, setTarotDraw] = useState<TarotCardEntry | null>(null);
  const [remindersEnabled, setRemindersEnabled] = useState<boolean>(
    () => persisted?.reminders.enabled ?? DEFAULT_REMINDER_RULES.enabled
  );
  const [reminderLeadDays, setReminderLeadDays] = useState<number>(
    () => persisted?.reminders.leadDays ?? DEFAULT_REMINDER_RULES.leadDays
  );
  const [reminderMaxOrb, setReminderMaxOrb] = useState<number>(
    () => persisted?.reminders.maxOrb ?? DEFAULT_REMINDER_RULES.maxOrb
  );
  const [lastReminderKey, setLastReminderKey] = useState<string>(
    () => persisted?.reminders.lastSentKey ?? ""
  );
  const [atlasGoalFocus, setAtlasGoalFocus] = useState<AtlasGoalFocus>("career");
  const [atlasInspectorInput, setAtlasInspectorInput] = useState<string>(
    () => persisted?.atlasInspectorInput ?? persisted?.personA.locationInput ?? "Rio de Janeiro, BR"
  );
  const [atlasInspectorResult, setAtlasInspectorResult] = useState<AtlasInspectorResultEntry | null>(null);
  const [atlasInspectorLoading, setAtlasInspectorLoading] = useState(false);
  const [atlasInspectorError, setAtlasInspectorError] = useState<string | null>(null);

  // Clear stale state when switching analysis mode
  useEffect(() => {
    if (analysisMode === "single") {
      setChartB(null);
      setShowDaylightSavingOverrideB(false);
    }
  }, [analysisMode]);

  // Recalculate cards and placements when mode changes
  useEffect(() => {
    if (chart) {
      setCards(buildCards(content, chart, mode));
      setPlacements(buildPlacementsSummary(chart));
    }
  }, [mode, content, chart]);

  useEffect(() => {
    if (geoRestored) return;
    const savedChartA = persisted?.lastChartA ?? chart;
    const savedChartB = persisted?.lastChartB ?? chartB;
    if (savedChartA) {
      geoA.applyResolved(chartToSuggestion(savedChartA));
    }
    if ((persisted?.analysisMode ?? analysisMode) === "compatibility" && savedChartB) {
      geoB.applyResolved(chartToSuggestion(savedChartB));
    }
    setGeoRestored(true);
  }, [
    analysisMode,
    chart,
    chartB,
    geoA,
    geoB,
    geoRestored,
    persisted,
  ]);

  useEffect(() => {
    writePrivacySettings({ persistLocalData });
    if (!persistLocalData) {
      clearPersistedAppState();
    }
  }, [persistLocalData]);

  useEffect(() => {
    if (!persistLocalData) return;
    writePersistedAppState({
      primaryArea,
      analysisMode,
      duoMode,
      chartSettings,
      timeTravelDate,
      transitDayPage,
      selectedTransitDate: selectedTransitDate || undefined,
      reminders: {
        enabled: remindersEnabled,
        leadDays: reminderLeadDays,
        maxOrb: reminderMaxOrb,
        lastSentKey: lastReminderKey || undefined,
      },
      atlasInspectorInput,
      personA: {
        date: dateA,
        time: timeA,
        daylightSaving: daylightSavingA,
        locationInput: geoA.locationInput,
      },
      personB: {
        date: dateB,
        time: timeB,
        daylightSaving: daylightSavingB,
        locationInput: geoB.locationInput,
      },
      lastChartA: chart ?? undefined,
      lastChartB: chartB ?? undefined,
      history: history.slice(0, HISTORY_LIMIT),
      progression,
    });
  }, [
    analysisMode,
    chartSettings,
    chart,
    chartB,
    dateA,
    dateB,
    daylightSavingA,
    daylightSavingB,
    duoMode,
    geoA.locationInput,
    geoB.locationInput,
    history,
    lastReminderKey,
    atlasInspectorInput,
    persistLocalData,
    primaryArea,
    progression,
    reminderLeadDays,
    reminderMaxOrb,
    remindersEnabled,
    selectedTransitDate,
    timeTravelDate,
    transitDayPage,
    timeA,
    timeB,
  ]);

  const { heroCards, planetCards, aspectCards } = useMemo(() => {
    const HERO_PLANETS = new Set(["Sun", "Moon"]);
    const hero: CardModel[] = [];
    const planets: CardModel[] = [];
    const aspects: CardModel[] = [];

    for (const card of cards) {
      if (card.category === "aspect") {
        aspects.push(card);
      } else if (card.planet && HERO_PLANETS.has(card.planet)) {
        hero.push(card);
      } else if (card.planet) {
        planets.push(card);
      }
    }

    return { heroCards: hero, planetCards: planets, aspectCards: aspects };
  }, [cards]);

  const chartLocale = isCarioca ? "pt-BR" : "en-US";

  const formatChartMeta = useCallback(
    (c: ChartResult) => {
      const { city, date, time: t } = c.input;
      const [year, month, day] = date.split("-").map(Number);
      const localDate = new Date(Date.UTC(year, month - 1, day));
      const formattedDate = localDate.toLocaleDateString(chartLocale, {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
      return { location: city, datetime: `${formattedDate}, ${t}` };
    },
    [chartLocale]
  );

  const chartMeta = useMemo(() => (chart ? formatChartMeta(chart) : null), [chart, formatChartMeta]);
  const chartMetaB = useMemo(() => (chartB ? formatChartMeta(chartB) : null), [chartB, formatChartMeta]);

  const placementsB = useMemo(() => {
    if (!chartB) return [];
    return buildPlacementsSummary(chartB);
  }, [chartB]);
  const pointRowsA = useMemo(() => (chart ? buildPointTableRows(chart) : []), [chart]);
  const pointRowsB = useMemo(() => (chartB ? buildPointTableRows(chartB) : []), [chartB]);
  const houseRowsA = useMemo(() => (chart ? buildHouseTableRows(chart) : []), [chart]);
  const houseRowsB = useMemo(() => (chartB ? buildHouseTableRows(chartB) : []), [chartB]);
  const aspectRowsA = useMemo(() => (chart ? buildAspectTableRows(chart) : []), [chart]);
  const aspectRowsB = useMemo(() => (chartB ? buildAspectTableRows(chartB) : []), [chartB]);
  const dignityRowsA = useMemo(() => (chart ? buildDignityRows(chart) : []), [chart]);
  const dignityRowsB = useMemo(() => (chartB ? buildDignityRows(chartB) : []), [chartB]);

  const comparison = useMemo(() => {
    if (analysisMode !== "compatibility" || !chart || !chartB) return null;
    return buildChartComparison(chart, chartB, isCarioca ? "pt" : "en", duoMode);
  }, [analysisMode, chart, chartB, duoMode, isCarioca]);

  const astralMapModel = useMemo(() => {
    if (analysisMode === "single") {
      if (!chart) return null;
      return buildAstralMapModelSingle(chart);
    }
    if (!chart || !chartB || !comparison) return null;
    return buildAstralMapModelCompatibility(chart, chartB, comparison);
  }, [analysisMode, chart, chartB, comparison]);

  const matchScorecards = useMemo(() => {
    if (analysisMode !== "compatibility" || !comparison) return [];
    return buildMatchScorecards(comparison, isCarioca ? "pt" : "en", duoMode);
  }, [analysisMode, comparison, duoMode, isCarioca]);

  const dailyOutlook = useMemo(() => {
    if (analysisMode !== "compatibility" || !chart || !chartB) return null;
    return buildDailyTransitOutlook(chart, chartB, {
      locale: isCarioca ? "pt" : "en",
      duoMode,
    });
  }, [analysisMode, chart, chartB, duoMode, isCarioca]);

  const comparisonCards = useMemo(() => {
    if (!comparison) return [];
    const unlockedDetails = getDetailUnlockCount(progression.xp);
    return comparison.highlights.map((highlight) => ({
      key: highlight.key,
      title: highlight.title,
      subtitle: highlight.subtitle,
      text: highlight.text,
      tags: highlight.tags,
      details: highlight.details ? highlight.details.slice(0, unlockedDetails) : undefined,
      tone: highlight.tone,
      orb: highlight.related?.aspect?.orb,
    }));
  }, [comparison, progression.xp]);

  const unlockedDetailCount = useMemo(
    () => getDetailUnlockCount(progression.xp),
    [progression.xp]
  );
  const nextDetailUnlockXp = useMemo(
    () => getNextDetailUnlockXp(progression.xp),
    [progression.xp]
  );

  const relationshipQuest: RelationshipQuest | null = useMemo(() => {
    if (analysisMode !== "compatibility" || !comparison || !chart) return null;
    return buildRelationshipQuest(comparison, {
      locale: isCarioca ? "pt" : "en",
      duoMode,
      timeZone: chart.normalized.timezone,
    });
  }, [analysisMode, chart, comparison, duoMode, isCarioca]);

  const compatibilityForecast = useMemo(() => {
    if (analysisMode !== "compatibility" || !chart || !chartB) return null;
    return buildCompatibilityForecast(chart, chartB, forecastRange, {
      locale: isCarioca ? "pt" : "en",
      duoMode,
      timeZone: chart.normalized.timezone,
    });
  }, [analysisMode, chart, chartB, duoMode, forecastRange, isCarioca]);

  const advancedOverlays = useMemo(() => {
    if (analysisMode !== "compatibility" || !chart || !chartB) return null;
    return buildAdvancedOverlaySummary(chart, chartB, isCarioca ? "pt" : "en");
  }, [analysisMode, chart, chartB, isCarioca]);

  const atlasShortlist = useMemo(
    () => buildAtlasShortlist(astrocartography, atlasGoalFocus),
    [astrocartography, atlasGoalFocus]
  );
  const atlasCrossings = useMemo(
    () => buildAtlasCrossings(astrocartography, isCarioca),
    [astrocartography, isCarioca]
  );
  const atlasHighlightedLabels = useMemo(
    () => atlasInspectorResult?.nearestLines.map((line) => line.label) ?? [],
    [atlasInspectorResult]
  );
  const moonPhaseInfo = useMemo(
    () => buildMoonPhaseInfo(timeTravelDate, isCarioca),
    [isCarioca, timeTravelDate]
  );
  const transitPageCount = useMemo(() => {
    if (!transitFeed || transitFeed.days.length === 0) return 1;
    return Math.max(1, Math.ceil(transitFeed.days.length / TRANSIT_PAGE_SIZE));
  }, [transitFeed]);
  const pagedTransitDays = useMemo(() => {
    if (!transitFeed) return [];
    const safePage = Math.max(0, Math.min(transitDayPage, transitPageCount - 1));
    const start = safePage * TRANSIT_PAGE_SIZE;
    return transitFeed.days.slice(start, start + TRANSIT_PAGE_SIZE);
  }, [transitDayPage, transitFeed, transitPageCount]);
  const selectedTransitDay = useMemo(() => {
    if (!transitFeed || transitFeed.days.length === 0) return null;
    const exact = transitFeed.days.find((day) => day.date === selectedTransitDate);
    return exact ?? pagedTransitDays[0] ?? transitFeed.days[0] ?? null;
  }, [pagedTransitDays, selectedTransitDate, transitFeed]);
  const selectedTransitExactHits = useMemo(() => {
    if (!transitFeed || !selectedTransitDay) return [];
    return transitFeed.exactHits.filter((hit) => hit.date === selectedTransitDay.date);
  }, [selectedTransitDay, transitFeed]);
  const transitShortThemes = useMemo(
    () => buildTransitThemes(transitFeed, 3, isCarioca),
    [isCarioca, transitFeed]
  );
  const transitLongThemes = useMemo(
    () => buildTransitThemes(transitFeed, transitRange === 1 ? 1 : transitRange === 7 ? 7 : 30, isCarioca),
    [isCarioca, transitFeed, transitRange]
  );
  const transitExactHitCalendar = useMemo(
    () => groupExactHitsByDate(transitFeed),
    [transitFeed]
  );
  const upcomingReminderHits = useMemo(() => {
    if (!transitFeed) return [];
    return transitFeed.exactHits.filter((hit) => {
      if (hit.orb > reminderMaxOrb) return false;
      const deltaDays = dayDistanceFrom(timeTravelDate, hit.date);
      return Number.isFinite(deltaDays) && deltaDays >= 0 && deltaDays <= reminderLeadDays;
    });
  }, [reminderLeadDays, reminderMaxOrb, timeTravelDate, transitFeed]);
  const relationshipTransitPageCount = useMemo(() => {
    if (!relationshipTransitFeed || relationshipTransitFeed.days.length === 0) return 1;
    return Math.max(1, Math.ceil(relationshipTransitFeed.days.length / TRANSIT_PAGE_SIZE));
  }, [relationshipTransitFeed]);
  const pagedRelationshipTransitDays = useMemo(() => {
    if (!relationshipTransitFeed) return [];
    const safePage = Math.max(0, Math.min(relationshipTransitDayPage, relationshipTransitPageCount - 1));
    const start = safePage * TRANSIT_PAGE_SIZE;
    return relationshipTransitFeed.days.slice(start, start + TRANSIT_PAGE_SIZE);
  }, [relationshipTransitDayPage, relationshipTransitFeed, relationshipTransitPageCount]);
  const selectedRelationshipTransitDay = useMemo(() => {
    if (!relationshipTransitFeed || relationshipTransitFeed.days.length === 0) return null;
    const exact = relationshipTransitFeed.days.find((day) => day.date === selectedRelationshipTransitDate);
    return exact ?? pagedRelationshipTransitDays[0] ?? relationshipTransitFeed.days[0] ?? null;
  }, [pagedRelationshipTransitDays, relationshipTransitFeed, selectedRelationshipTransitDate]);
  const selectedRelationshipExactHits = useMemo(() => {
    if (!relationshipTransitFeed || !selectedRelationshipTransitDay) return [];
    return relationshipTransitFeed.exactHits.filter((hit) => hit.date === selectedRelationshipTransitDay.date);
  }, [relationshipTransitFeed, selectedRelationshipTransitDay]);

  useEffect(() => {
    if (astralMapModel) return;
    setIsMapModalOpen(false);
  }, [astralMapModel]);

  useEffect(() => {
    if (!chart) {
      setTransitFeed(null);
      setProgressed(null);
      setSolarReturn(null);
      setLunarReturn(null);
      setProfections(null);
      setSaturnReturnHits(null);
      setAstrocartography(null);
      return;
    }
    if (primaryArea !== "transits" && primaryArea !== "timing" && primaryArea !== "atlas") {
      return;
    }
    let canceled = false;
    const anchorDate = parseIsoDate(timeTravelDate);
    const start = timeTravelDate;
    const end = shiftIsoDate(timeTravelDate, transitRange - 1);
    const progressionDate = shiftIsoDate(timeTravelDate, 30);
    const lunarMonth = `${anchorDate.getUTCFullYear()}-${String(anchorDate.getUTCMonth() + 1).padStart(2, "0")}`;
    if (primaryArea === "transits") {
      runAstroWorkerTask<TransitRangeResult>({
        type: "generateTransits",
        baseChart: chart,
        range: { from: start, to: end },
        settings: chartSettings,
      })
        .then((nextTransitFeed) => {
          if (canceled) return;
          setTransitFeed(nextTransitFeed);
        })
        .catch(() => {
          if (canceled) return;
          setTransitFeed(null);
        });
    }
    if (primaryArea === "timing") {
      Promise.all([
        runAstroWorkerTask<SecondaryProgressionResult>({
          type: "generateSecondaryProgressions",
          baseChart: chart,
          date: progressionDate,
          settings: chartSettings,
        }),
        runAstroWorkerTask<ReturnChartResult>({
          type: "generateSolarReturn",
          baseChart: chart,
          year: anchorDate.getUTCFullYear(),
          settings: chartSettings,
        }),
        runAstroWorkerTask<ReturnChartResult>({
          type: "generateLunarReturn",
          baseChart: chart,
          month: lunarMonth,
          settings: chartSettings,
        }),
        runAstroWorkerTask<AnnualProfectionResult>({
          type: "generateAnnualProfections",
          baseChart: chart,
          date: timeTravelDate,
        }),
      ])
        .then(([nextProgressed, nextSolarReturn, nextLunarReturn, nextProfections]) => {
          if (canceled) return;
          setProgressed(nextProgressed);
          setSolarReturn(nextSolarReturn);
          setLunarReturn(nextLunarReturn);
          setProfections(nextProfections);
        })
        .catch(() => {
          if (canceled) return;
          setProgressed(null);
          setSolarReturn(null);
          setLunarReturn(null);
          setProfections(null);
        });
      runAstroWorkerTask<Array<{ date: string; orb: number }>>({
        type: "generateSaturnReturnTracker",
        baseChart: chart,
        settings: chartSettings,
      })
        .then((nextSaturnHits) => {
          if (canceled) return;
          setSaturnReturnHits(nextSaturnHits);
        })
        .catch(() => {
          if (canceled) return;
          setSaturnReturnHits(null);
        });
    }
    if (primaryArea === "atlas") {
      runAstroWorkerTask<AstrocartographyResult>({
        type: "generateAstrocartography",
        baseChart: chart,
        settings: chartSettings,
      })
        .then((nextAstrocartography) => {
          if (canceled) return;
          setAstrocartography(nextAstrocartography);
        })
        .catch(() => {
          if (canceled) return;
          setAstrocartography(null);
        });
    }

    return () => {
      canceled = true;
    };
  }, [chart, chartSettings, primaryArea, timeTravelDate, transitRange]);

  useEffect(() => {
    if (analysisMode !== "compatibility" || !chart || !chartB) {
      setCompositeChart(null);
      setDavisonChart(null);
      return;
    }
    let canceled = false;
    Promise.all([
      runAstroWorkerTask<ChartResult>({
        type: "generateComposite",
        chartA: chart,
        chartB,
        method: "midpoint",
        settings: chartSettings,
      }),
      runAstroWorkerTask<ChartResult>({
        type: "generateComposite",
        chartA: chart,
        chartB,
        method: "davison",
        settings: chartSettings,
      }),
    ])
      .then(([midpoint, davison]) => {
        if (canceled) return;
        setCompositeChart(midpoint);
        setDavisonChart(davison);
      })
      .catch(() => {
        if (canceled) return;
        setCompositeChart(null);
        setDavisonChart(null);
      });
    return () => {
      canceled = true;
    };
  }, [analysisMode, chart, chartB, chartSettings]);

  useEffect(() => {
    if (analysisMode !== "compatibility" || !compositeChart || primaryArea !== "relationships") {
      setRelationshipTransitFeed(null);
      return;
    }
    let canceled = false;
    const start = timeTravelDate;
    const end = shiftIsoDate(timeTravelDate, 29);
    runAstroWorkerTask<TransitRangeResult>({
      type: "generateTransits",
      baseChart: compositeChart,
      range: { from: start, to: end },
      settings: chartSettings,
    })
      .then((nextFeed) => {
        if (canceled) return;
        setRelationshipTransitFeed(nextFeed);
      })
      .catch(() => {
        if (canceled) return;
        setRelationshipTransitFeed(null);
      });
    return () => {
      canceled = true;
    };
  }, [analysisMode, chartSettings, compositeChart, primaryArea, timeTravelDate]);

  useEffect(() => {
    if (!transitFeed || transitFeed.days.length === 0) {
      if (selectedTransitDate !== "") setSelectedTransitDate("");
      if (transitDayPage !== 0) setTransitDayPage(0);
      return;
    }
    const maxPage = Math.max(0, Math.ceil(transitFeed.days.length / TRANSIT_PAGE_SIZE) - 1);
    if (transitDayPage > maxPage) {
      setTransitDayPage(maxPage);
      return;
    }
    const selectedIndex = transitFeed.days.findIndex((day) => day.date === selectedTransitDate);
    if (selectedIndex === -1) {
      setSelectedTransitDate(transitFeed.days[0].date);
      return;
    }
    const selectedPage = Math.floor(selectedIndex / TRANSIT_PAGE_SIZE);
    if (selectedPage !== transitDayPage) {
      setTransitDayPage(selectedPage);
    }
  }, [selectedTransitDate, transitDayPage, transitFeed]);

  useEffect(() => {
    if (!relationshipTransitFeed || relationshipTransitFeed.days.length === 0) {
      if (selectedRelationshipTransitDate !== "") setSelectedRelationshipTransitDate("");
      if (relationshipTransitDayPage !== 0) setRelationshipTransitDayPage(0);
      return;
    }
    const maxPage = Math.max(0, Math.ceil(relationshipTransitFeed.days.length / TRANSIT_PAGE_SIZE) - 1);
    if (relationshipTransitDayPage > maxPage) {
      setRelationshipTransitDayPage(maxPage);
      return;
    }
    const selectedIndex = relationshipTransitFeed.days.findIndex(
      (day) => day.date === selectedRelationshipTransitDate
    );
    if (selectedIndex === -1) {
      setSelectedRelationshipTransitDate(relationshipTransitFeed.days[0].date);
      return;
    }
    const selectedPage = Math.floor(selectedIndex / TRANSIT_PAGE_SIZE);
    if (selectedPage !== relationshipTransitDayPage) {
      setRelationshipTransitDayPage(selectedPage);
    }
  }, [
    relationshipTransitDayPage,
    relationshipTransitFeed,
    selectedRelationshipTransitDate,
  ]);

  useEffect(() => {
    setAtlasInspectorResult(null);
    setAtlasInspectorError(null);
  }, [astrocartography, chart?.normalized.utcDateTime]);

  useEffect(() => {
    if (!remindersEnabled) return;
    if (typeof window === "undefined" || typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;
    void Notification.requestPermission().catch(() => undefined);
  }, [remindersEnabled]);

  useEffect(() => {
    if (!remindersEnabled || upcomingReminderHits.length === 0) return;
    const next = upcomingReminderHits[0];
    const reminderKey = [
      timeTravelDate,
      next.date,
      next.transitPlanet,
      next.aspect,
      next.natalPlanet,
      reminderLeadDays,
      reminderMaxOrb.toFixed(1),
    ].join("|");
    if (reminderKey === lastReminderKey) return;
    if (typeof window !== "undefined" && typeof Notification !== "undefined" && Notification.permission === "granted") {
      const title = isCarioca ? "Lembrete de transito" : "Transit reminder";
      const body = `${next.date}: ${next.transitPlanet} ${next.aspect} ${next.natalPlanet} (orb ${next.orb.toFixed(1)}deg)`;
      new Notification(title, { body });
    }
    setLastReminderKey(reminderKey);
  }, [
    isCarioca,
    lastReminderKey,
    reminderLeadDays,
    reminderMaxOrb,
    remindersEnabled,
    timeTravelDate,
    upcomingReminderHits,
  ]);

  const advancedUnlocked = isAdvancedOverlaysUnlocked(progression.xp);
  const advancedUnlockTarget = getAdvancedOverlaysUnlockXp(progression.xp);

  const questCompleted = relationshipQuest
    ? hasCompletedQuest(progression, relationshipQuest.id)
    : false;
  const questReflected = relationshipQuest
    ? hasReflectedQuest(progression, relationshipQuest.id)
    : false;

  function handleQuestComplete() {
    if (!relationshipQuest || !chart) return;
    const dayKey = getLocalDayKey(new Date(), chart.normalized.timezone);
    setProgression((current) => awardQuestCompletion(current, relationshipQuest.id, dayKey));
  }

  function handleQuestReflection() {
    if (!relationshipQuest || !questCompleted) return;
    setProgression((current) => awardQuestReflection(current, relationshipQuest.id));
  }

  function handleClearLocalData() {
    clearPersistedAppState();
    setPrimaryArea("chart");
    setAnalysisMode("single");
    setDuoMode("romantic");
    setChartSettings(DEFAULT_CHART_SETTINGS);
    setDateA("1990-01-01");
    setTimeA("12:00");
    setDaylightSavingA("auto");
    geoA.setLocationInput("Rio de Janeiro, BR");
    geoA.setSuggestions([]);
    geoA.setSearchError(null);
    setDateB("1990-01-01");
    setTimeB("12:00");
    setDaylightSavingB("auto");
    geoB.setLocationInput("New York, US");
    geoB.setSuggestions([]);
    geoB.setSearchError(null);
    setShowDaylightSavingOverrideA(false);
    setShowDaylightSavingOverrideB(false);
    setChart(null);
    setChartB(null);
    setCards([]);
    setPlacements([]);
    setHistory([]);
    setProgression(DEFAULT_PROGRESSION_STATE);
    setTimeTravelDate(todayIso);
    setForecastRange(7);
    setTransitRange(7);
    setTransitDayPage(0);
    setSelectedTransitDate("");
    setTransitFeed(null);
    setProgressed(null);
    setSolarReturn(null);
    setLunarReturn(null);
    setProfections(null);
    setSaturnReturnHits(null);
    setCompositeChart(null);
    setDavisonChart(null);
    setRelationshipTransitFeed(null);
    setRelationshipTransitDayPage(0);
    setSelectedRelationshipTransitDate("");
    setAstrocartography(null);
    setRemindersEnabled(DEFAULT_REMINDER_RULES.enabled);
    setReminderLeadDays(DEFAULT_REMINDER_RULES.leadDays);
    setReminderMaxOrb(DEFAULT_REMINDER_RULES.maxOrb);
    setLastReminderKey("");
    setAtlasGoalFocus("career");
    setAtlasInspectorInput("Rio de Janeiro, BR");
    setAtlasInspectorResult(null);
    setAtlasInspectorLoading(false);
    setAtlasInspectorError(null);
    setExportMessage("");
    setTarotDraw(null);
    setError(null);
    setResultVersion((prev) => prev + 1);
  }

  function buildChartInput(
    date: string,
    time: string,
    daylightSaving: boolean | "auto",
    geo: { city: string; country: string; location: { lat: number; lon: number; timezone: string } | undefined }
  ): ChartInput {
    return {
      date,
      time,
      city: geo.city,
      country: geo.country,
      location: geo.location,
      daylight_saving: daylightSaving,
    };
  }

  async function ensureResolvedInput(
    date: string,
    time: string,
    daylightSaving: boolean | "auto",
    geo: {
      city: string;
      country: string;
      location: { lat: number; lon: number; timezone: string } | undefined;
      locationInput: string;
      applyResolved: (s: GeoSuggestion) => void;
      setSuggestions: (s: GeoSuggestion[]) => void;
      setSearchError: (e: string | null) => void;
    },
    personLabel?: string
  ): Promise<ChartInput | null> {
    const withPrefix = (message: string) =>
      personLabel ? `${personLabel}: ${message}` : message;

    let chartInput = buildChartInput(date, time, daylightSaving, geo);

    if (!geo.location) {
      const normalized = geo.locationInput.trim().toLowerCase().replace(/\s+/g, " ");
      if (normalized.length < 3) {
        setError(
          withPrefix(
            isCarioca
              ? "Manda pelo menos 3 letras da cidade, porra."
              : "Type at least 3 characters to search for a city."
          )
        );
        return null;
      }
      const candidates = await resolveLocationCandidates(geo.locationInput, isCarioca, 6);
      if (candidates === null) {
        setError(
          withPrefix(
            isCarioca
              ? "Nao deu pra buscar cidade agora, mermão. Tenta de novo ja ja."
              : "Could not search cities right now."
          )
        );
        return null;
      }
      if (candidates.length === 0) {
        setError(
          withPrefix(
            isCarioca
              ? "Nao achei essa cidade nem fudendo. Tenta botar cidade + pais certinho."
              : "Couldn't find that city. Try including the country code."
          )
        );
        return null;
      }
      if (candidates.length > 1) {
        geo.setSuggestions(candidates);
        geo.setSearchError(null);
        setError(
          withPrefix(
            isCarioca
              ? "Cidade ambigua pra caralho. Escolhe uma opcao da lista ai."
              : "Ambiguous city. Please select one option from the city suggestions list."
          )
        );
        return null;
      }
      const fallback = candidates[0];
      geo.applyResolved(fallback);
      chartInput = {
        ...chartInput,
        city: fallback.city,
        country: fallback.country,
        location: { lat: fallback.lat, lon: fallback.lon, timezone: fallback.timezone },
      };
    }

    const validation = validateChartInput(chartInput);
    if (!validation.valid) {
      setError(withPrefix(formatValidationMessages(validation.errors, isCarioca).join(". ")));
      return null;
    }
    return chartInput;
  }

  function appendHistoryEntry(nextChartA: ChartResult, nextChartB: ChartResult | null) {
    const entry: PersistedHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      createdAt: new Date().toISOString(),
      analysisMode: nextChartB ? "compatibility" : "single",
      duoMode,
      chartA: nextChartA,
      chartB: nextChartB ?? undefined,
    };
    const signature = makeHistorySignature(entry.analysisMode, entry.duoMode, entry.chartA, nextChartB);
    setHistory((prev) => {
      const deduped = prev.filter(
        (saved) =>
          makeHistorySignature(
            saved.analysisMode,
            saved.duoMode,
            saved.chartA,
            saved.chartB ?? null
          ) !== signature
      );
      return [entry, ...deduped].slice(0, HISTORY_LIMIT);
    });
  }

  function applyChartToForm(
    chartValue: ChartResult,
    person: "A" | "B"
  ) {
    const suggestion = chartToSuggestion(chartValue);
    if (person === "A") {
      setDateA(chartValue.input.date);
      setTimeA(chartValue.input.time);
      setDaylightSavingA(chartValue.input.daylight_saving);
      geoA.applyResolved(suggestion);
      return;
    }
    setDateB(chartValue.input.date);
    setTimeB(chartValue.input.time);
    setDaylightSavingB(chartValue.input.daylight_saving);
    geoB.applyResolved(suggestion);
  }

  function handleLoadHistory(entry: PersistedHistoryEntry) {
    setError(null);
    setExportMessage("");
    setShowDaylightSavingOverrideA(false);
    setShowDaylightSavingOverrideB(false);
    setAnalysisMode(entry.analysisMode);
    setDuoMode(entry.duoMode);
    applyChartToForm(entry.chartA, "A");
    setChart(entry.chartA);

    if (entry.analysisMode === "compatibility" && entry.chartB) {
      applyChartToForm(entry.chartB, "B");
      setChartB(entry.chartB);
    } else {
      setChartB(null);
    }

    setResultVersion((prev) => prev + 1);
  }

  async function handleGenerateChart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setExportMessage("");
    setShowDaylightSavingOverrideA(false);
    setShowDaylightSavingOverrideB(false);
    setLoading(true);

    try {
      const inputA = await ensureResolvedInput(
        dateA,
        timeA,
        daylightSavingA,
        geoA,
        analysisMode === "compatibility" ? (isCarioca ? "Pessoa A" : "Person A") : undefined
      );
      if (!inputA) return;

      if (analysisMode === "single") {
        const newChart = await generateChartInWorker(inputA, chartSettings);
        setChart(newChart);
        setChartB(null);
        setCards(buildCards(content, newChart, mode));
        setPlacements(buildPlacementsSummary(newChart));
        setShowDaylightSavingOverrideA(false);
        appendHistoryEntry(newChart, null);
        setResultVersion((prev) => prev + 1);
        return;
      }

      const inputResolvedB = await ensureResolvedInput(
        dateB,
        timeB,
        daylightSavingB,
        geoB,
        isCarioca ? "Pessoa B" : "Person B"
      );
      if (!inputResolvedB) return;

      const personALabel = isCarioca ? "Pessoa A" : "Person A";
      const personBLabel = isCarioca ? "Pessoa B" : "Person B";
      const [resultA, resultB] = await Promise.allSettled([
        generateChartInWorker(inputA, chartSettings),
        generateChartInWorker(inputResolvedB, chartSettings),
      ]);

      const ambiguousA =
        resultA.status === "rejected" && hasErrorName(resultA.reason, "AmbiguousLocalTimeError");
      const ambiguousB =
        resultB.status === "rejected" && hasErrorName(resultB.reason, "AmbiguousLocalTimeError");
      setShowDaylightSavingOverrideA(ambiguousA);
      setShowDaylightSavingOverrideB(ambiguousB);

      const errors: string[] = [];
      if (resultA.status === "rejected") {
        errors.push(`${personALabel}: ${formatRuntimeError(resultA.reason, isCarioca)}`);
      }
      if (resultB.status === "rejected") {
        errors.push(`${personBLabel}: ${formatRuntimeError(resultB.reason, isCarioca)}`);
      }
      if (errors.length > 0) {
        setError(errors.join(" "));
        return;
      }

      const chartAValue = (resultA as PromiseFulfilledResult<ChartResult>).value;
      const chartBValue = (resultB as PromiseFulfilledResult<ChartResult>).value;
      setChart(chartAValue);
      setChartB(chartBValue);
      setCards(buildCards(content, chartAValue, mode));
      setPlacements(buildPlacementsSummary(chartAValue));
      setShowDaylightSavingOverrideA(false);
      setShowDaylightSavingOverrideB(false);
      appendHistoryEntry(chartAValue, chartBValue);
      setShowShootingStar(false);
      requestAnimationFrame(() => {
        setShowShootingStar(true);
        setTimeout(() => setShowShootingStar(false), 2000);
      });
      setResultVersion((prev) => prev + 1);
    } catch (err) {
      if (hasErrorName(err, "AmbiguousLocalTimeError")) {
        setShowDaylightSavingOverrideA(true);
      }
      setError(formatRuntimeError(err, isCarioca));
    } finally {
      setLoading(false);
    }
  }

  function handleExportJson() {
    if (!chart) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      primaryArea,
      analysisMode,
      duoMode,
      chartSettings,
      chartA: chart,
      chartB: analysisMode === "compatibility" ? chartB : null,
      transits: transitFeed,
      timing: {
        progressed,
        solarReturn,
        lunarReturn,
        profections,
        saturnReturnHits,
      },
      relationships: {
        compositeChart,
        davisonChart,
      },
      atlas: astrocartography,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const now = new Date();
    const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
    const link = document.createElement("a");
    link.href = url;
    link.download = `stellar-export-${day}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function captureReportCanvas(): Promise<HTMLCanvasElement | null> {
    if (!reportExportRef.current) return null;
    const html2canvas = (await import("html2canvas")).default;
    return html2canvas(reportExportRef.current, {
      backgroundColor: "#090f1f",
      scale: 2,
      useCORS: true,
    });
  }

  function buildReportFileName(): string {
    const now = new Date();
    return `stellar-report-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  async function handleExportReportPng() {
    if (!chart) return;
    try {
      const canvas = await captureReportCanvas();
      if (!canvas) throw new Error("Missing capture canvas");
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `${buildReportFileName()}.png`;
      link.click();
      setExportMessage(t.exportReportDonePng);
    } catch {
      setExportMessage(t.exportReportError);
    }
  }

  async function handleExportReportPdf() {
    if (!chart) return;
    try {
      const canvas = await captureReportCanvas();
      if (!canvas) throw new Error("Missing capture canvas");
      const image = canvas.toDataURL("image/png");
      const [{ jsPDF }] = await Promise.all([import("jspdf")]);
      const ratio = canvas.width / canvas.height;
      const width = 820;
      const height = Math.round(width / ratio);
      const pdf = new jsPDF({
        orientation: width > height ? "landscape" : "portrait",
        unit: "pt",
        format: [width, height],
      });
      pdf.addImage(image, "PNG", 0, 0, width, height);
      pdf.save(`${buildReportFileName()}.pdf`);
      setExportMessage(t.exportReportDonePdf);
    } catch {
      setExportMessage(t.exportReportError);
    }
  }

  function handleOpenSharedImport() {
    sharedImportInputRef.current?.click();
  }

  async function handleSharedImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as unknown;
      let imported: ChartResult | null = null;
      if (looksLikeChartResult(parsed)) {
        imported = parsed;
      } else if (typeof parsed === "object" && parsed !== null) {
        const payload = parsed as { chartA?: unknown; chartB?: unknown };
        if (looksLikeChartResult(payload.chartB)) {
          imported = payload.chartB;
        } else if (looksLikeChartResult(payload.chartA)) {
          imported = payload.chartA;
        }
      }

      if (!imported) {
        setError(
          isCarioca
            ? "Arquivo invalido. Importa um JSON de chart/export do Stellar."
            : "Invalid file. Import a Stellar chart/export JSON."
        );
        return;
      }

      setError(null);
      setExportMessage("");
      setShowDaylightSavingOverrideA(false);
      setShowDaylightSavingOverrideB(false);

      if (!chart) {
        setAnalysisMode("single");
        setChart(imported);
        setChartB(null);
        applyChartToForm(imported, "A");
        setCards(buildCards(content, imported, mode));
        setPlacements(buildPlacementsSummary(imported));
        appendHistoryEntry(imported, null);
      } else {
        setAnalysisMode("compatibility");
        setChartB(imported);
        applyChartToForm(imported, "B");
        appendHistoryEntry(chart, imported);
      }
      setPrimaryArea("relationships");
      setResultVersion((prev) => prev + 1);
    } catch {
      setError(
        isCarioca
          ? "Nao deu pra ler esse arquivo. Confere o JSON."
          : "Could not read this file. Check the JSON content."
      );
    }
  }

  function handleTimeTravelShift(days: number) {
    setTimeTravelDate((current) => shiftIsoDate(current, days));
  }

  function handleTimeTravelReset() {
    setTimeTravelDate(todayIso);
  }

  async function handleInspectAtlasLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAtlasInspectorError(null);
    if (!astrocartography) {
      setAtlasInspectorResult(null);
      setAtlasInspectorError(
        isCarioca
          ? "Gera o atlas primeiro pra inspecionar local."
          : "Generate atlas lines first to inspect a location."
      );
      return;
    }
    const query = atlasInspectorInput.trim();
    if (query.length < 3) {
      setAtlasInspectorResult(null);
      setAtlasInspectorError(
        isCarioca
          ? "Manda pelo menos 3 letras da cidade."
          : "Type at least 3 characters to search a location."
      );
      return;
    }
    setAtlasInspectorLoading(true);
    try {
      const candidates = await resolveLocationCandidates(query, isCarioca, 6);
      if (candidates === null) {
        setAtlasInspectorResult(null);
        setAtlasInspectorError(
          isCarioca
            ? "Busca de cidade indisponivel agora."
            : "Location search is temporarily unavailable."
        );
        return;
      }
      if (candidates.length === 0) {
        setAtlasInspectorResult(null);
        setAtlasInspectorError(
          isCarioca
            ? "Nao achei essa localizacao. Tenta cidade + pais."
            : "Location not found. Try city + country."
        );
        return;
      }
      if (candidates.length > 1) {
        setAtlasInspectorResult(null);
        setAtlasInspectorError(
          isCarioca
            ? "Localizacao ambigua. Especifica melhor com pais."
            : "Ambiguous location. Add country for a specific result."
        );
        return;
      }
      const resolved = candidates[0];
      const nextResult = buildAtlasInspectorResult(astrocartography, resolved, atlasCrossings, isCarioca);
      if (!nextResult) {
        setAtlasInspectorResult(null);
        setAtlasInspectorError(
          isCarioca
            ? "Nao foi possivel analisar esse ponto."
            : "Could not analyze this location right now."
        );
        return;
      }
      setAtlasInspectorInput(resolved.label);
      setAtlasInspectorResult(nextResult);
    } finally {
      setAtlasInspectorLoading(false);
    }
  }

  function handleDrawTarot() {
    const seed = Date.now() + (chart?.normalized.utcDateTime ? Date.parse(chart.normalized.utcDateTime) : 0);
    const index = Math.abs(seed) % TAROT_CARDS.length;
    setTarotDraw(TAROT_CARDS[index]);
  }

  const formLabels = {
    date: isCarioca ? "Data" : "Date",
    time: isCarioca ? "Hora" : "Time",
    cityAndCountry: isCarioca ? "Cidade e pais, sem caozada" : "City & country",
    searchPlaceholder: isCarioca ? "Ex: Rio de Janeiro, BR" : "e.g. New York, US",
    searching: isCarioca ? "Caçando cidade..." : "Searching cities...",
    noResults: isCarioca ? "Nao achei porra nenhuma." : "No cities found.",
    cityHint: isCarioca
      ? `Manda a cidade com pais certinho, mermão. Ou usa um exemplo: ${SUPPORTED_CITIES.join(", ")}`
      : `Type to search cities worldwide or try: ${SUPPORTED_CITIES.join(", ")}`,
    datePickerDialog: isCarioca ? "Escolher data" : "Choose date",
    datePickerYear: isCarioca ? "Ano" : "Year",
    datePickerPreviousMonth: isCarioca ? "Mes anterior" : "Previous month",
    datePickerNextMonth: isCarioca ? "Proximo mes" : "Next month",
    daylightSaving: isCarioca ? "Horario de verao" : "Daylight saving",
    daylightSavingAuto: isCarioca ? "Auto (recomendado)" : "Auto (recommended)",
    daylightSavingManual: isCarioca ? "Ajuste manual de horario de verao" : "Manual daylight saving override",
    daylightSavingManualHint: isCarioca
      ? "Deixa no auto na maior parte dos casos. So abre isso se o horario nascer duplicado."
      : "Keep Auto for most cases. Use manual only when a birth time is duplicated by DST fallback.",
    yes: isCarioca ? "Sim, porra" : "Yes",
    no: isCarioca ? "Nao, porra" : "No",
  };

  const libraryGlossaryEntries = isCarioca
    ? [
        { term: "Ascendente", text: "Como tu chega no mundo e no primeiro impacto." },
        { term: "MC", text: "Direcao publica, carreira e reputacao." },
        { term: "Casa 7", text: "Parcerias, namoro, casamento e contratos." },
        { term: "Retorno Solar", text: "Mapa do ano pessoal entre aniversarios." },
      ]
    : [
        { term: "Ascendant", text: "Your outward style and first-impression interface." },
        { term: "MC", text: "Public direction, vocation, and reputation axis." },
        { term: "7th House", text: "Partnerships, commitment, and relational contracts." },
        { term: "Solar Return", text: "Yearly chart from birthday to birthday." },
      ];

  const libraryTemplateEntries = isCarioca
    ? [
        "Template de transito: o que ativou, como senti no corpo, acao concreta hoje.",
        "Template de sinastria: ponto forte, ponto sensivel, acordo pratico da semana.",
        "Template de atlas: cidade, linhas proximas, objetivo de vida ligado ao lugar.",
      ]
    : [
        "Transit template: what was activated, body signal, one concrete action today.",
        "Synastry template: strongest bond, friction point, practical agreement for the week.",
        "Atlas template: city, nearest lines, life-goal hypothesis tied to place.",
      ];

  const t = {
    modeLabel: isCarioca ? "Carioca raiz, porra" : "English",
    areaChart: isCarioca ? "Mapa" : "Chart",
    areaTransits: isCarioca ? "Transitos" : "Transits",
    areaTiming: isCarioca ? "Timing" : "Timing",
    areaRelationships: isCarioca ? "Relacoes" : "Relationships",
    areaAtlas: isCarioca ? "Atlas" : "Atlas",
    areaLibrary: isCarioca ? "Biblioteca" : "Library",
    settingsTitle: isCarioca ? "Configuracoes do mapa" : "Chart settings",
    settingsHouseSystem: isCarioca ? "Sistema de casas" : "House system",
    settingsAspectProfile: isCarioca ? "Perfil de aspectos" : "Aspect profile",
    settingsOrbMode: isCarioca ? "Modo de orb" : "Orb mode",
    settingsMinorAspects: isCarioca ? "Incluir aspectos menores" : "Include minor aspects",
    settingsAspectMajor: isCarioca ? "Maiores" : "Major",
    settingsAspectExpanded: isCarioca ? "Expandido" : "Expanded",
    orbStandard: isCarioca ? "Padrao" : "Standard",
    orbTight: isCarioca ? "Apertado" : "Tight",
    orbWide: isCarioca ? "Amplo" : "Wide",
    singleMode: isCarioca ? "Mapa solo bolado" : "Single chart",
    compatibilityMode: isCarioca ? "Sinastria braba" : "Compatibility",
    personA: isCarioca ? "Pessoa A (tu)" : "Person A",
    personB: isCarioca ? "Pessoa B (o outro)" : "Person B",
    generating: isCarioca ? "Gerando essa porra..." : "Generating...",
    generateNew: isCarioca ? "Gerar outro mapa, caralho" : "New chart",
    generate: isCarioca ? "Gerar mapa, porra" : "Generate chart",
    error: isCarioca ? "Deu merda no mapa" : "Error generating chart",
    normalizedTitle: isCarioca ? "Dados no papo reto" : "Normalized data",
    timezoneLabel: isCarioca ? "Fuso" : "Timezone",
    utcLabel: "UTC",
    localLabel: isCarioca ? "Local" : "Local",
    offsetLabel: isCarioca ? "Offset" : "Offset",
    latLonLabel: "Lat/Lon",
    dstLabel: isCarioca ? "Horario de verao" : "Daylight saving",
    emptyState: isCarioca
      ? 'Clica em "Gerar mapa, porra" pra ver os cards desse mapa.'
      : 'Click "Generate chart" to see your birth chart cards.',
    loading: isCarioca ? "Calculando os planetas nessa porra" : "Calculating planetary positions",
    planetsTitle: isCarioca ? "Posicoes planetarias" : "Planet placements",
    aspectsTitle: isCarioca ? "Aspectos planetarios" : "Planetary aspects",
    aspectsBadge: (n: number) => isCarioca ? `${n} conexoes brabas` : `${n} connections`,
    chartPointsTitle: isCarioca ? "Tabela completa de pontos" : "Full points table",
    chartPointsBadge: (n: number) => isCarioca ? `${n} pontos` : `${n} points`,
    chartHousesTitle: isCarioca ? "Tabela de casas" : "House table",
    chartHousesBadge: (n: number) => isCarioca ? `${n} casas` : `${n} houses`,
    chartAspectsTableTitle: isCarioca ? "Tabela de aspectos" : "Aspects table",
    chartAspectsTableBadge: (n: number) => isCarioca ? `${n} aspectos` : `${n} aspects`,
    chartDignitiesTitle: isCarioca ? "Resumo de dignidades" : "Dignities summary",
    chartDignitiesBadge: (n: number) => isCarioca ? `${n} planetas` : `${n} planets`,
    colPoint: isCarioca ? "Ponto" : "Point",
    colHouse: isCarioca ? "Casa" : "House",
    colAspect: isCarioca ? "Aspecto" : "Aspect",
    colSign: isCarioca ? "Signo" : "Sign",
    colDegree: isCarioca ? "Grau" : "Degree",
    colLongitude: isCarioca ? "Longitude" : "Longitude",
    colOrb: "Orb",
    colStatus: isCarioca ? "Status" : "Status",
    emptyTable: isCarioca ? "Sem dados para mostrar." : "No data available.",
    dignityDomicile: isCarioca ? "Domicilio" : "Domicile",
    dignityExaltation: isCarioca ? "Exaltacao" : "Exaltation",
    dignityDetriment: isCarioca ? "Detrimento" : "Detriment",
    dignityFall: isCarioca ? "Queda" : "Fall",
    dignityNeutral: isCarioca ? "Neutro" : "Neutral",
    sunMoonInsightsTitle: isCarioca ? "Insights de Sol e Lua" : "Sun and Moon insights",
    housesStatus: isCarioca
      ? "Casas calculadas no sistema selecionado."
      : "House cusps calculated using the selected system.",
    astralMapTitle: isCarioca ? "Mapa astral visual" : "Astral map",
    astralMapBadge:
      analysisMode === "compatibility"
        ? isCarioca
          ? "duplo + conexoes"
          : "combined + connections"
        : isCarioca
          ? "solo + conexoes"
          : "single + connections",
    astralMapThumbTitle:
      analysisMode === "compatibility"
        ? isCarioca
          ? "Visao combinada das energias"
          : "Combined energy map"
        : isCarioca
          ? "Visao completa do mapa"
          : "Full chart map",
    astralMapThumbSubtitle:
      analysisMode === "compatibility"
        ? `${isCarioca ? "Pessoa A" : "Person A"} + ${isCarioca ? "Pessoa B" : "Person B"}`
        : isCarioca
          ? "Planetas, casas e aspectos"
          : "Planets, houses, and aspects",
    astralMapOpen: isCarioca ? "Abrir mapa em resolucao total" : "Open full-resolution map",
    astralMapModalTitle: isCarioca ? "Mapa astral em alta resolucao" : "Full-resolution astral map",
    astralMapClose: isCarioca ? "Fechar" : "Close",
    astralMapDownloadPng: isCarioca ? "Baixar PNG" : "Download PNG",
    astralMapDownloadPdf: isCarioca ? "Baixar PDF" : "Download PDF",
    astralMapDownloadDonePng: isCarioca ? "PNG baixado com sucesso." : "PNG downloaded successfully.",
    astralMapDownloadDonePdf: isCarioca ? "PDF baixado com sucesso." : "PDF downloaded successfully.",
    astralMapDownloadError: isCarioca ? "Nao foi possivel gerar o arquivo." : "Could not generate file.",
    astralMapFilters: isCarioca ? "Filtro de aspectos" : "Aspect filters",
    astralMapAllAspects: isCarioca ? "Todos" : "All",
    astralMapLegendOuterA: isCarioca ? "anel externo" : "outer ring",
    astralMapLegendInnerB: isCarioca ? "anel interno" : "inner ring",
    astralMapLegendFlow: isCarioca ? "fluxo" : "flow",
    astralMapLegendTension: isCarioca ? "tensao" : "tension",
    astralMapLegendIntense: isCarioca ? "intenso" : "intense",
    astralMapHouseBeta: isCarioca
      ? "Casas seguem o sistema selecionado; fallback equal-house so se faltar dado."
      : "Houses follow the selected system; equal-house is only a fallback when data is missing.",
    astralMapAscFallback: isCarioca
      ? "Ascendente ausente no dado salvo. Usando fallback em 0 deg Aries."
      : "Ascendant missing in saved data. Using fallback at 0deg Aries.",
    matchScorecardsTitle: isCarioca ? "Resumo rapido dos matches" : "Best and worst match summary",
    matchScorecardsBadge: isCarioca ? "amor, amizade, familia" : "love, friendship, family",
    matchAreaLove: duoMode === "friend" ? (isCarioca ? "Vibe" : "Bond") : isCarioca ? "Amor" : "Love",
    matchAreaFriends: isCarioca ? "Amizade" : "Friendship",
    matchAreaFamily: isCarioca ? "Familia" : "Family",
    matchSupportLabel: isCarioca ? "Melhor apoio" : "Best support",
    matchTensionLabel: isCarioca ? "Maior tensao" : "Biggest tension",
    matchAspectEmpty: isCarioca ? "Sem aspecto dominante" : "No dominant aspect",
    compatibilityTitle: isCarioca ? "Sinastria de cria" : "Synastry",
    compatibilityBadge: (n: number) => isCarioca ? `${n} aspectos brabos` : `${n} aspects`,
    compatibilityEmpty: isCarioca
      ? 'Clica em "Gerar mapa, porra" pra ver a treta entre Pessoa A e Pessoa B.'
      : 'Click "Generate chart" to see aspects between Person A and Person B.',
    compatibilityStatsTitle:
      duoMode === "friend"
        ? isCarioca
          ? "Stats da amizade"
          : "Friendship stats"
        : isCarioca
          ? "Stats da relacao"
          : "Relationship stats",
    compatibilityStatsBadge: isCarioca ? "modo RPG" : "RPG mode",
    coreTriadTitle: isCarioca ? "Sol, Lua e Ascendente" : "Sun, Moon, Ascendant",
    coreTriadBadge: isCarioca ? "base do mapa" : "chart core",
    coreSun: isCarioca ? "Sol (identidade)" : "Sun (identity)",
    coreMoon: isCarioca ? "Lua (emocional)" : "Moon (emotions)",
    coreAsc: isCarioca ? "Ascendente (estilo externo)" : "Ascendant (outer style)",
    coreAscMissing: isCarioca ? "Ascendente indisponivel" : "Ascendant unavailable",
    questTitle:
      duoMode === "friend"
        ? isCarioca
          ? "Missao da amizade"
          : "Friendship quest"
        : isCarioca
          ? "Missao da dupla"
          : "Relationship quest",
    questBadge: (label: string) => isCarioca ? `foco em ${label}` : `${label} focus`,
    questXpLabel: isCarioca ? "XP total" : "Total XP",
    questStreakLabel: isCarioca ? "Streak" : "Streak",
    questUnlockLabel: (count: number) =>
      isCarioca ? `Blocos destravados: ${count}/4` : `Unlocked detail blocks: ${count}/4`,
    questNextUnlockLabel: (xp: number) =>
      isCarioca ? `Proximo unlock em ${xp} XP` : `Next unlock at ${xp} XP`,
    questComplete: isCarioca ? `Concluir missao (+40 XP)` : "Complete quest (+40 XP)",
    questCompleted: isCarioca ? "Missao concluida" : "Quest completed",
    questReflect: isCarioca ? "Registrar reflexao (+20 XP)" : "Log reflection (+20 XP)",
    questReflected: isCarioca ? "Reflexao registrada" : "Reflection logged",
    forecastTitle: isCarioca ? "Timeline de compatibilidade" : "Compatibility timeline",
    forecastBadge: (days: number) => isCarioca ? `proximos ${days} dias` : `next ${days} days`,
    forecastBest: isCarioca ? "Melhor janela" : "Best window",
    forecastTough: isCarioca ? "Dia mais sensivel" : "Toughest day",
    forecastVibe: isCarioca ? "Vibe" : "Vibe",
    forecastRisk: isCarioca ? "Risco" : "Risk",
    advancedTitle: isCarioca ? "Overlays avancados" : "Advanced overlays",
    advancedBadge: isCarioca ? "composite + midpoints" : "composite + midpoints",
    advancedLocked: isCarioca
      ? `Desbloqueia com ${ADVANCED_OVERLAYS_UNLOCK_XP} XP`
      : `Unlocks at ${ADVANCED_OVERLAYS_UNLOCK_XP} XP`,
    advancedLockedHint: (xp: number) =>
      isCarioca
        ? `Faltam ${Math.max(0, xp - progression.xp)} XP para liberar.`
        : `${Math.max(0, xp - progression.xp)} XP to unlock.`,
    advancedCompositeTitle: isCarioca ? "Composite core" : "Composite core",
    advancedMidpointTitle: isCarioca ? "Midpoints-chave" : "Key midpoints",
    todayForUsTitle:
      duoMode === "friend"
        ? isCarioca
          ? "Hoje pra amizade"
          : "Today for Friends"
        : isCarioca
          ? "Hoje pra dupla"
          : "Today for Us",
    todayForUsBadge: isCarioca ? "transitos ativos" : "live transits",
    duoModeLabel: isCarioca ? "Tipo de dupla" : "Duo mode",
    duoModeRomantic: isCarioca ? "Romantico" : "Romantic",
    duoModeFriend: isCarioca ? "Amizade" : "Friend",
    historyTitle: isCarioca ? "Historico salvo" : "Saved history",
    historyLoad: isCarioca ? "Carregar" : "Load",
    exportJson: isCarioca ? "Exportar JSON" : "Export JSON",
    exportReportPng: isCarioca ? "Exportar PNG (relatorio)" : "Export PNG report",
    exportReportPdf: isCarioca ? "Exportar PDF (relatorio)" : "Export PDF report",
    exportReportDonePng: isCarioca ? "Relatorio PNG exportado." : "PNG report exported.",
    exportReportDonePdf: isCarioca ? "Relatorio PDF exportado." : "PDF report exported.",
    exportReportError: isCarioca ? "Nao foi possivel exportar o relatorio." : "Could not export report.",
    importSharedJson: isCarioca ? "Importar perfil compartilhado" : "Import shared profile",
    historySingle: isCarioca ? "Solo" : "Single",
    historyCompatibility: isCarioca ? "Sinastria" : "Compatibility",
    transitsTitle: isCarioca ? "Feed de transitos" : "Transit feed",
    timeTravelTitle: isCarioca ? "Navegador de data" : "Time travel date",
    timeTravelBack: isCarioca ? "-7 dias" : "-7 days",
    timeTravelForward: isCarioca ? "+7 dias" : "+7 days",
    timeTravelToday: isCarioca ? "Hoje" : "Today",
    transitsExactHits: isCarioca ? "Aspectos exatos" : "Exact hits",
    transitsStrongest: isCarioca ? "Mais fortes do dia" : "Strongest today",
    transitsRangeToday: isCarioca ? "Hoje" : "Today",
    transitsRangeWeek: isCarioca ? "Semana" : "Week",
    transitsRangeMonth: isCarioca ? "Mes" : "Month",
    transitsPage: (page: number, total: number) =>
      isCarioca ? `Pagina ${page}/${total}` : `Page ${page}/${total}`,
    transitsPrev: isCarioca ? "Anterior" : "Prev",
    transitsNext: isCarioca ? "Proximo" : "Next",
    transitsSelectedDay: isCarioca ? "Dia selecionado" : "Selected day",
    transitsNoHitsDay: isCarioca ? "Sem hits relevantes nesse dia." : "No strong hits on this day.",
    transitsThemeShort: isCarioca ? "Temas de curto prazo" : "Short-term themes",
    transitsThemeLong: isCarioca ? "Temas de longo prazo" : "Long-term themes",
    transitsThemeCount: isCarioca ? "ocorrencias" : "occurrences",
    transitsExactCalendar: isCarioca ? "Calendario de exatos" : "Exact-hit calendar",
    transitsReminderTitle: isCarioca ? "Regras de lembrete local" : "Local reminder rules",
    transitsReminderLeadDays: isCarioca ? "Antecedencia" : "Lead time",
    transitsReminderOrb: isCarioca ? "Orb maximo" : "Max orb",
    transitsReminderStatus: isCarioca ? "Status de notificacao" : "Notification status",
    transitsReminderPermissionMissing: isCarioca ? "Notificacoes nao permitidas no navegador." : "Notifications are not allowed in this browser.",
    transitsReminderPermissionPrompt: isCarioca ? "Ativa o lembrete pra solicitar permissao." : "Enable reminders to request permission.",
    transitsReminderPermissionDenied: isCarioca ? "Permissao negada; o lembrete fica so no feed." : "Permission denied; reminders stay in-app only.",
    transitsReminderPermissionGranted: isCarioca ? "Permissao ativa; alertas locais habilitados." : "Permission granted; local alerts enabled.",
    transitsReminderUpcoming: isCarioca ? "Proximos alertas pela regra" : "Upcoming rule matches",
    timingTitle: isCarioca ? "Timing astrologico" : "Astrology timing",
    timingAsOf: isCarioca ? "Referencia" : "Reference date",
    timingProgressed: isCarioca ? "Progressoes secundarias" : "Secondary progression",
    timingSolarReturn: isCarioca ? "Retorno solar" : "Solar return",
    timingLunarReturn: isCarioca ? "Retorno lunar" : "Lunar return",
    timingProfection: isCarioca ? "Profeccao anual" : "Annual profection",
    timingSaturnReturn: isCarioca ? "Saturn return tracker" : "Saturn return tracker",
    relationshipsComposite: isCarioca ? "Mapa composto" : "Composite chart",
    relationshipsDavison: isCarioca ? "Mapa Davison" : "Davison chart",
    relationshipsTransitTimeline: isCarioca ? "Timeline de transitos da relacao" : "Relationship transit timeline",
    relationshipsTransitExact: isCarioca ? "Aspectos exatos da relacao" : "Relationship exact hits",
    relationshipsTransitSelectedDay: isCarioca ? "Dia da relacao" : "Relationship day",
    relationshipsTransitNoHits: isCarioca
      ? "Sem hits de relacao nesse dia."
      : "No relationship hits on this day.",
    atlasTitle: isCarioca ? "Astrocartografia" : "Astrocartography",
    atlasMapTitle: isCarioca ? "Mapa global de linhas" : "Global line map",
    atlasMapBadge: isCarioca ? "MC/IC/ASC/DSC" : "MC/IC/ASC/DSC",
    atlasMapHint: isCarioca
      ? "Linhas verticais mostram onde cada ponto angular fica mais forte."
      : "Vertical lines show where each angle expression is strongest globally.",
    atlasShortlistTitle: isCarioca ? "Melhores cidades por linhas" : "Best-fit location shortlist",
    atlasShortlistBadge: isCarioca ? "proximidade de linhas" : "line proximity",
    atlasGoalFocusTitle: isCarioca ? "Objetivo principal" : "Primary goal",
    atlasGoalCareer: isCarioca ? "Carreira" : "Career",
    atlasGoalRelationships: isCarioca ? "Relacoes" : "Relationships",
    atlasGoalHome: isCarioca ? "Casa/Familia" : "Home/Family",
    atlasGoalGrowth: isCarioca ? "Crescimento" : "Growth",
    atlasShortlistEmpty: isCarioca
      ? "Sem matches fortes por enquanto. Tenta mudar data ou sistema de casas."
      : "No strong matches yet. Try another date or house system.",
    atlasCrossingsTitle: isCarioca ? "Cruzamentos de linhas" : "Line crossings",
    atlasCrossingsBadge: isCarioca ? "zonas de sobreposicao" : "overlap zones",
    atlasCrossingsEmpty: isCarioca
      ? "Sem cruzamentos fortes no momento."
      : "No strong crossings detected right now.",
    atlasInspectorTitle: isCarioca ? "Inspecionar localizacao" : "Inspect location",
    atlasInspectorHint: isCarioca
      ? "Busca uma cidade e ve as linhas mais proximas."
      : "Search a location and inspect the nearest lines.",
    atlasInspectorButton: isCarioca ? "Inspecionar" : "Inspect",
    atlasInspectorLoading: isCarioca ? "Inspecionando..." : "Inspecting...",
    atlasInspectorCrossing: isCarioca ? "Cruzamento dominante" : "Strongest crossing",
    atlasInspectorEmpty: isCarioca
      ? "Sem leitura ainda. Escolhe uma cidade e clica em inspecionar."
      : "No location analysis yet. Enter a city and inspect.",
    libraryTitle: isCarioca ? "Biblioteca astrologica" : "Astrology library",
    libraryGlossary: isCarioca ? "Glossario base para consulta rapida." : "Core glossary for quick reference.",
    libraryTemplates: isCarioca ? "Templates de interpretacao e journal." : "Interpretation and journaling templates.",
    libraryMoonTitle: isCarioca ? "Ciclo lunar (data atual)" : "Moon cycle (current date)",
    libraryMoonPhase: isCarioca ? "Fase" : "Phase",
    libraryMoonIllumination: isCarioca ? "Iluminacao" : "Illumination",
    libraryTarotTitle: isCarioca ? "Tarot opcional" : "Optional tarot pull",
    libraryTarotDraw: isCarioca ? "Puxar carta" : "Draw card",
    libraryTarotHint: isCarioca
      ? "Usa como prompt de journaling, nao como verdade absoluta."
      : "Use as a journaling prompt, not absolute truth.",
    privacyTitle: isCarioca ? "Privacidade local" : "Local privacy",
    privacyPersist: isCarioca
      ? "Salvar dados neste dispositivo"
      : "Save data on this device",
    privacyHint: (days: number) =>
      isCarioca
        ? `Dados locais expiram automaticamente em ${days} dias.`
        : `Local data expires automatically after ${days} days.`,
    privacyDisabledHint: isCarioca
      ? "Salvamento local desligado."
      : "Local persistence is disabled.",
    privacyClear: isCarioca ? "Limpar dados locais agora" : "Clear local data now",
  };
  const ariaLabels = {
    chartInfo: isCarioca ? "Dados atuais do mapa" : "Current chart info",
    chartGenerator: isCarioca ? "Gerador de mapa astral" : "Birth chart generator",
    birthDataForm: isCarioca ? "Formulario de dados de nascimento" : "Birth data form",
    analysisMode: isCarioca ? "Modo de analise" : "Analysis mode",
    contentMode: isCarioca ? "Modo de conteudo" : "Content mode",
    duoMode: isCarioca ? "Modo de dupla" : "Duo mode",
    privacyControls: isCarioca ? "Controles de privacidade local" : "Local privacy controls",
    primaryArea: isCarioca ? "Area principal" : "Primary area",
  };
  const cardExpandLabels = isCarioca
    ? { more: "Abrir mais", less: "Fechar" }
    : { more: "Show more", less: "Show less" };
  const formatDignityStatusLabel = useCallback(
    (status: DignityStatus) => {
      if (status === "domicile") return t.dignityDomicile;
      if (status === "exaltation") return t.dignityExaltation;
      if (status === "detriment") return t.dignityDetriment;
      if (status === "fall") return t.dignityFall;
      return t.dignityNeutral;
    },
    [t.dignityDetriment, t.dignityDomicile, t.dignityExaltation, t.dignityFall, t.dignityNeutral]
  );
  const matchAreaLabels: Record<LifeArea, string> = {
    love: t.matchAreaLove,
    friends: t.matchAreaFriends,
    family: t.matchAreaFamily,
  };
  const hasResults =
    (analysisMode === "single" && chart != null) ||
    (analysisMode === "compatibility" && chart != null && chartB != null);
  const isChartArea = primaryArea === "chart";
  const isTransitsArea = primaryArea === "transits";
  const isTimingArea = primaryArea === "timing";
  const isRelationshipsArea = primaryArea === "relationships";
  const isAtlasArea = primaryArea === "atlas";
  const isLibraryArea = primaryArea === "library";
  const primaryAreas: Array<{ key: PrimaryArea; label: string }> = [
    { key: "chart", label: t.areaChart },
    { key: "transits", label: t.areaTransits },
    { key: "timing", label: t.areaTiming },
    { key: "relationships", label: t.areaRelationships },
    { key: "atlas", label: t.areaAtlas },
    { key: "library", label: t.areaLibrary },
  ];
  const notificationStatus =
    typeof window === "undefined" || typeof Notification === "undefined"
      ? t.transitsReminderPermissionMissing
      : Notification.permission === "granted"
        ? t.transitsReminderPermissionGranted
        : Notification.permission === "denied"
          ? t.transitsReminderPermissionDenied
          : t.transitsReminderPermissionPrompt;

  return (
    <>
      <div className="starfield" aria-hidden="true">
        <div className="starfield__layer starfield__layer--1" />
        <div className="starfield__layer starfield__layer--2" />
        <div className="starfield__layer starfield__layer--3" />
        {showShootingStar && <div className="shooting-star" />}
      </div>
      <div className="app">
      <div className="container">
        <header className="header" role="banner">
          <div className="header__brand">
            <h1 className="header__title">Stellar</h1>
            <p className="header__tagline">"City of stars, are you shining just for me?"</p>
            <div
              className="header__meta"
              aria-label={ariaLabels.chartInfo}
              aria-live="polite"
              aria-atomic="true"
            >
              <span>{t.modeLabel}</span>
              {chartMeta && (
                <>
                  <span className="header__meta-divider" />
                  <span>{chartMeta.location}</span>
                  <span className="header__meta-divider" />
                  <span>{chartMeta.datetime}</span>
                </>
              )}
            </div>
          </div>
          <ModeToggle mode={mode} setMode={setMode} ariaLabel={ariaLabels.contentMode} />
        </header>

        <main role="main" aria-label={ariaLabels.chartGenerator} ref={reportExportRef}>
          <section className={`action-section ${hasResults ? "action-section--compact" : ""}`}>
            <form className="form" onSubmit={handleGenerateChart} aria-label={ariaLabels.birthDataForm}>
              <div className="analysis-mode" role="group" aria-label={ariaLabels.primaryArea}>
                {primaryAreas.map((area) => (
                  <button
                    key={area.key}
                    type="button"
                    className={`analysis-mode__btn ${primaryArea === area.key ? "analysis-mode__btn--active" : ""}`}
                    onClick={() => setPrimaryArea(area.key)}
                  >
                    {area.label}
                  </button>
                ))}
              </div>

              <div className="analysis-mode" role="group" aria-label={ariaLabels.analysisMode}>
                <button
                  type="button"
                  className={`analysis-mode__btn ${analysisMode === "single" ? "analysis-mode__btn--active" : ""}`}
                  onClick={() => {
                    setError(null);
                    setAnalysisMode("single");
                  }}
                >
                  {t.singleMode}
                </button>
                <button
                  type="button"
                  className={`analysis-mode__btn ${analysisMode === "compatibility" ? "analysis-mode__btn--active" : ""}`}
                  onClick={() => {
                    setError(null);
                    setAnalysisMode("compatibility");
                  }}
                >
                  {t.compatibilityMode}
                </button>
              </div>

              <div className="privacy-controls" role="group" aria-label={t.settingsTitle}>
                <p className="privacy-controls__title">{t.settingsTitle}</p>
                <label className="privacy-controls__toggle">
                  <span>{t.settingsHouseSystem}</span>
                  <select
                    value={chartSettings.houseSystem}
                    onChange={(event) =>
                      setChartSettings((current) => ({
                        ...current,
                        houseSystem: event.target.value as ChartSettings["houseSystem"],
                      }))
                    }
                  >
                    {HOUSE_SYSTEMS.map((system) => (
                      <option key={system} value={system}>
                        {system}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="privacy-controls__toggle">
                  <span>{t.settingsAspectProfile}</span>
                  <select
                    value={chartSettings.aspectProfile}
                    onChange={(event) =>
                      setChartSettings((current) => ({
                        ...current,
                        aspectProfile: event.target.value as ChartSettings["aspectProfile"],
                      }))
                    }
                  >
                    <option value="major">{t.settingsAspectMajor}</option>
                    <option value="expanded">{t.settingsAspectExpanded}</option>
                  </select>
                </label>
                <label className="privacy-controls__toggle">
                  <span>{t.settingsOrbMode}</span>
                  <select
                    value={chartSettings.orbMode}
                    onChange={(event) =>
                      setChartSettings((current) => ({
                        ...current,
                        orbMode: event.target.value as ChartSettings["orbMode"],
                      }))
                    }
                  >
                    <option value="standard">{t.orbStandard}</option>
                    <option value="tight">{t.orbTight}</option>
                    <option value="wide">{t.orbWide}</option>
                  </select>
                </label>
                <label className="privacy-controls__toggle">
                  <input
                    type="checkbox"
                    checked={chartSettings.includeMinorAspects}
                    onChange={(event) =>
                      setChartSettings((current) => ({
                        ...current,
                        includeMinorAspects: event.target.checked,
                      }))
                    }
                  />
                  <span>{t.settingsMinorAspects}</span>
                </label>
              </div>

              {analysisMode === "compatibility" && (
                <div className="duo-mode" role="group" aria-label={ariaLabels.duoMode}>
                  <button
                    type="button"
                    className={`duo-mode__btn ${duoMode === "romantic" ? "duo-mode__btn--active" : ""}`}
                    data-duo="romantic"
                    onClick={() => setDuoMode("romantic")}
                  >
                    {t.duoModeRomantic}
                  </button>
                  <button
                    type="button"
                    className={`duo-mode__btn ${duoMode === "friend" ? "duo-mode__btn--active" : ""}`}
                    data-duo="friend"
                    onClick={() => setDuoMode("friend")}
                  >
                    {t.duoModeFriend}
                  </button>
                </div>
              )}

              <PersonForm
                title={analysisMode === "compatibility" ? t.personA : undefined}
                framed={analysisMode === "compatibility"}
                locale={isCarioca ? "pt-BR" : "en-US"}
                date={dateA}
                time={timeA}
                daylightSavingValue={toDaylightSavingValue(daylightSavingA)}
                onDateChange={setDateA}
                onTimeChange={setTimeA}
                onDaylightSavingChange={(v) => setDaylightSavingA(parseDaylightSavingValue(v))}
                geo={geoA}
                labels={formLabels}
                hintId="city-hint-a"
                suggestionsId="city-suggestions-a"
                namePrefix="birth"
                activeIndex={kbA.activeIndex}
                onKeyDown={kbA.onKeyDown}
                showDaylightSavingOverride={showDaylightSavingOverrideA}
              />

              {analysisMode === "single" && (
                <div className="form__row form__row--actions">
                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? t.generating : chart ? t.generateNew : t.generate}
                  </button>
                </div>
              )}

              {analysisMode === "compatibility" && (
                <>
                  <PersonForm
                    title={t.personB}
                    framed
                    locale={isCarioca ? "pt-BR" : "en-US"}
                    date={dateB}
                    time={timeB}
                    daylightSavingValue={toDaylightSavingValue(daylightSavingB)}
                    onDateChange={setDateB}
                    onTimeChange={setTimeB}
                    onDaylightSavingChange={(v) => setDaylightSavingB(parseDaylightSavingValue(v))}
                    geo={geoB}
                    labels={formLabels}
                    hintId="city-hint-b"
                    suggestionsId="city-suggestions-b"
                    namePrefix="birth-b"
                    activeIndex={kbB.activeIndex}
                    onKeyDown={kbB.onKeyDown}
                    showDaylightSavingOverride={showDaylightSavingOverrideB}
                  />
                  <div className="form__row form__row--actions">
                    <button type="submit" className="btn-primary" disabled={loading}>
                      {loading ? t.generating : chart && chartB ? t.generateNew : t.generate}
                    </button>
                  </div>
                </>
              )}

              <div className="form__row form__row--actions">
                <button type="button" className="btn-ghost" onClick={handleOpenSharedImport}>
                  {t.importSharedJson}
                </button>
                {hasResults && (
                  <>
                    <button type="button" className="btn-ghost" onClick={handleExportJson}>
                      {t.exportJson}
                    </button>
                    <button type="button" className="btn-ghost" onClick={handleExportReportPng}>
                      {t.exportReportPng}
                    </button>
                    <button type="button" className="btn-ghost" onClick={handleExportReportPdf}>
                      {t.exportReportPdf}
                    </button>
                  </>
                )}
                <input
                  ref={sharedImportInputRef}
                  type="file"
                  accept="application/json"
                  onChange={handleSharedImportFile}
                  style={{ display: "none" }}
                />
              </div>
              {exportMessage && <p className="privacy-controls__hint">{exportMessage}</p>}

              <div className="privacy-controls" role="group" aria-label={ariaLabels.privacyControls}>
                <p className="privacy-controls__title">{t.privacyTitle}</p>
                <label className="privacy-controls__toggle">
                  <input
                    type="checkbox"
                    checked={persistLocalData}
                    onChange={(event) => setPersistLocalData(event.target.checked)}
                  />
                  <span>{t.privacyPersist}</span>
                </label>
                <p className="privacy-controls__hint">
                  {persistLocalData
                    ? t.privacyHint(APP_STATE_RETENTION_DAYS)
                    : t.privacyDisabledHint}
                </p>
                <button
                  type="button"
                  className="privacy-controls__clear"
                  onClick={handleClearLocalData}
                >
                  {t.privacyClear}
                </button>
              </div>

              {error && (
                <p className="form__error" role="alert">
                  {t.error}: {error}
                </p>
              )}
            </form>
          </section>

          {!loading && history.length > 0 && (
            <Section icon="🗂️" title={t.historyTitle} badge={`${history.length}`}>
              <div className="history-list">
                {history.map((entry) => {
                  const when = new Date(entry.createdAt);
                  const modeLabel =
                    entry.analysisMode === "compatibility"
                      ? `${t.historyCompatibility} · ${entry.duoMode === "friend" ? t.duoModeFriend : t.duoModeRomantic}`
                      : t.historySingle;
                  const cities =
                    entry.analysisMode === "compatibility" && entry.chartB
                      ? `${entry.chartA.input.city} + ${entry.chartB.input.city}`
                      : entry.chartA.input.city;
                  return (
                    <div key={entry.id} className="history-item">
                      <div className="history-item__meta">
                        <p className="history-item__title">{cities}</p>
                        <p className="history-item__subtitle">
                          {modeLabel} · {when.toLocaleString(isCarioca ? "pt-BR" : "en-US")}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="history-item__load"
                        onClick={() => handleLoadHistory(entry)}
                      >
                        {t.historyLoad}
                      </button>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {!loading && isChartArea && astralMapModel && (
            <Section icon="🗺️" title={t.astralMapTitle} badge={t.astralMapBadge}>
              <AstralMapThumbnail
                model={astralMapModel}
                title={t.astralMapThumbTitle}
                subtitle={t.astralMapThumbSubtitle}
                openLabel={t.astralMapOpen}
                onOpen={() => setIsMapModalOpen(true)}
              />
              <p className="astral-map-note">{t.astralMapHouseBeta}</p>
              {astralMapModel.usedAscendantFallback && (
                <p className="astral-map-note astral-map-note--warning">{t.astralMapAscFallback}</p>
              )}
            </Section>
          )}

          {!loading && isRelationshipsArea && analysisMode === "compatibility" && matchScorecards.length > 0 && (
            <Section icon="⚖️" title={t.matchScorecardsTitle} badge={t.matchScorecardsBadge}>
              <MatchScorecards
                cards={matchScorecards}
                areaLabels={matchAreaLabels}
                supportLabel={t.matchSupportLabel}
                tensionLabel={t.matchTensionLabel}
                emptyAspectLabel={t.matchAspectEmpty}
              />
            </Section>
          )}

          {!loading && isChartArea && analysisMode === "single" && chart && (
            <Section icon="🧭" title={t.normalizedTitle}>
              <div className="normalized">
                <p>{t.timezoneLabel}: {chart.normalized.timezone}</p>
                <p>{t.utcLabel}: {chart.normalized.utcDateTime}</p>
                <p>{t.localLabel}: {chart.normalized.localDateTime}</p>
                <p>{t.offsetLabel}: {chart.normalized.offsetMinutes} min</p>
                <p>
                  {t.latLonLabel}: {chart.normalized.location.lat},{" "}
                  {chart.normalized.location.lon}
                </p>
                <p>
                  {t.dstLabel}: {chart.normalized.daylightSaving ? formLabels.yes : formLabels.no}
                </p>
                <p>{t.settingsHouseSystem}: {chart.settings?.houseSystem ?? chartSettings.houseSystem}</p>
                <p>{t.housesStatus}</p>
              </div>
            </Section>
          )}

          {!loading && isChartArea && analysisMode === "single" && chart && (
            <Section icon="🧬" title={t.coreTriadTitle} badge={t.coreTriadBadge}>
              <div className="core-triad">
                <p><strong>{t.coreSun}:</strong> {formatPlacementLabel(chart.planets.Sun, t.coreAscMissing)}</p>
                <p><strong>{t.coreMoon}:</strong> {formatPlacementLabel(chart.planets.Moon, t.coreAscMissing)}</p>
                <p><strong>{t.coreAsc}:</strong> {formatPlacementLabel(chart.angles?.ascendant, t.coreAscMissing)}</p>
              </div>
            </Section>
          )}

          {!loading && isChartArea && analysisMode === "compatibility" && chart && chartB && (
            <Section icon="🧭" title={t.normalizedTitle}>
              <div className="normalized normalized--comparison">
                <div className="normalized__card">
                  <h3 className="normalized__title">{t.personA}</h3>
                  <p>{chartMeta?.location}</p>
                  <p>{chartMeta?.datetime}</p>
                  <p>{t.timezoneLabel}: {chart.normalized.timezone}</p>
                  <p>{t.utcLabel}: {chart.normalized.utcDateTime}</p>
                  <p>{t.dstLabel}: {chart.normalized.daylightSaving ? formLabels.yes : formLabels.no}</p>
                  <p>{t.settingsHouseSystem}: {chart.settings?.houseSystem ?? chartSettings.houseSystem}</p>
                  <p>{t.housesStatus}</p>
                </div>
                <div className="normalized__card">
                  <h3 className="normalized__title">{t.personB}</h3>
                  <p>{chartMetaB?.location}</p>
                  <p>{chartMetaB?.datetime}</p>
                  <p>{t.timezoneLabel}: {chartB.normalized.timezone}</p>
                  <p>{t.utcLabel}: {chartB.normalized.utcDateTime}</p>
                  <p>{t.dstLabel}: {chartB.normalized.daylightSaving ? formLabels.yes : formLabels.no}</p>
                  <p>{t.settingsHouseSystem}: {chartB.settings?.houseSystem ?? chartSettings.houseSystem}</p>
                  <p>{t.housesStatus}</p>
                </div>
              </div>
              <div className="comparison-placements">
                <div>
                  <h3 className="comparison-placements__title">{t.personA}</h3>
                  <PlacementsSummary placements={placements} />
                </div>
                <div>
                  <h3 className="comparison-placements__title">{t.personB}</h3>
                  <PlacementsSummary placements={placementsB} />
                </div>
              </div>
            </Section>
          )}

          {!loading && isChartArea && analysisMode === "compatibility" && chart && chartB && (
            <Section icon="🧬" title={t.coreTriadTitle} badge={t.coreTriadBadge}>
              <div className="core-triad core-triad--comparison">
                <div className="core-triad__card">
                  <h3 className="core-triad__title">{t.personA}</h3>
                  <p><strong>{t.coreSun}:</strong> {formatPlacementLabel(chart.planets.Sun, t.coreAscMissing)}</p>
                  <p><strong>{t.coreMoon}:</strong> {formatPlacementLabel(chart.planets.Moon, t.coreAscMissing)}</p>
                  <p><strong>{t.coreAsc}:</strong> {formatPlacementLabel(chart.angles?.ascendant, t.coreAscMissing)}</p>
                </div>
                <div className="core-triad__card">
                  <h3 className="core-triad__title">{t.personB}</h3>
                  <p><strong>{t.coreSun}:</strong> {formatPlacementLabel(chartB.planets.Sun, t.coreAscMissing)}</p>
                  <p><strong>{t.coreMoon}:</strong> {formatPlacementLabel(chartB.planets.Moon, t.coreAscMissing)}</p>
                  <p><strong>{t.coreAsc}:</strong> {formatPlacementLabel(chartB.angles?.ascendant, t.coreAscMissing)}</p>
                </div>
              </div>
            </Section>
          )}

          {!loading && isChartArea && analysisMode === "single" && chart && (
            <Section icon="📐" title={t.chartPointsTitle} badge={t.chartPointsBadge(pointRowsA.length)}>
              <div className="table-block">
                <table className="chart-table">
                  <thead>
                    <tr>
                      <th>{t.colPoint}</th>
                      <th>{t.colSign}</th>
                      <th>{t.colDegree}</th>
                      <th>{t.colLongitude}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pointRowsA.map((row) => (
                      <tr key={`point-a-${row.point}`}>
                        <td>{row.symbol} {row.point}</td>
                        <td>{row.sign === "--" ? "--" : `${SIGN_SYMBOL[row.sign]} ${row.sign}`}</td>
                        <td>{row.degree}</td>
                        <td>{row.longitude}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="timeline-day__summary">{t.chartHousesTitle}</p>
              {houseRowsA.length === 0 ? (
                <p className="timeline-day__summary">{t.emptyTable}</p>
              ) : (
                <div className="table-block">
                  <table className="chart-table">
                    <thead>
                      <tr>
                        <th>{t.colHouse}</th>
                        <th>{t.colSign}</th>
                        <th>{t.colDegree}</th>
                        <th>{t.colLongitude}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {houseRowsA.map((row) => (
                        <tr key={`house-a-${row.house}`}>
                          <td>{row.house}</td>
                          <td>{row.sign === "--" ? "--" : `${SIGN_SYMBOL[row.sign]} ${row.sign}`}</td>
                          <td>{row.degree}</td>
                          <td>{row.longitude}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          )}

          {!loading && isChartArea && analysisMode === "single" && chart && (
            <Section icon="📎" title={t.chartAspectsTableTitle} badge={t.chartAspectsTableBadge(aspectRowsA.length)}>
              {aspectRowsA.length === 0 ? (
                <p className="timeline-day__summary">{t.emptyTable}</p>
              ) : (
                <div className="table-block">
                  <table className="chart-table">
                    <thead>
                      <tr>
                        <th>{t.colAspect}</th>
                        <th>{t.colOrb}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aspectRowsA.map((aspect, index) => (
                        <tr key={`aspect-a-${aspect.a}-${aspect.type}-${aspect.b}-${index}`}>
                          <td>{aspect.a} {ASPECT_SYMBOL[aspect.type]} {aspect.type} {aspect.b}</td>
                          <td>{aspect.orb?.toFixed(1) ?? "--"}deg</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          )}

          {!loading && isChartArea && analysisMode === "single" && chart && (
            <Section icon="🏛️" title={t.chartDignitiesTitle} badge={t.chartDignitiesBadge(dignityRowsA.length)}>
              <div className="table-block">
                <table className="chart-table">
                  <thead>
                    <tr>
                      <th>{t.colPoint}</th>
                      <th>{t.colSign}</th>
                      <th>{t.colStatus}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dignityRowsA.map((row) => (
                      <tr key={`dignity-a-${row.planet}`}>
                        <td>{row.planet}</td>
                        <td>{SIGN_SYMBOL[row.sign]} {row.sign}</td>
                        <td>{formatDignityStatusLabel(row.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {!loading && isChartArea && analysisMode === "compatibility" && chart && chartB && (
            <Section icon="📐" title={t.chartPointsTitle} badge={`${t.personA} + ${t.personB}`}>
              <div className="timeline-grid">
                <div className="timeline-day">
                  <p className="timeline-day__date">{t.personA}</p>
                  <div className="table-block">
                    <table className="chart-table">
                      <thead>
                        <tr>
                          <th>{t.colPoint}</th>
                          <th>{t.colSign}</th>
                          <th>{t.colDegree}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pointRowsA.map((row) => (
                          <tr key={`point-compat-a-${row.point}`}>
                            <td>{row.symbol} {row.point}</td>
                            <td>{row.sign === "--" ? "--" : `${SIGN_SYMBOL[row.sign]} ${row.sign}`}</td>
                            <td>{row.degree}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="timeline-day">
                  <p className="timeline-day__date">{t.personB}</p>
                  <div className="table-block">
                    <table className="chart-table">
                      <thead>
                        <tr>
                          <th>{t.colPoint}</th>
                          <th>{t.colSign}</th>
                          <th>{t.colDegree}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pointRowsB.map((row) => (
                          <tr key={`point-compat-b-${row.point}`}>
                            <td>{row.symbol} {row.point}</td>
                            <td>{row.sign === "--" ? "--" : `${SIGN_SYMBOL[row.sign]} ${row.sign}`}</td>
                            <td>{row.degree}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </Section>
          )}

          {!loading && isChartArea && analysisMode === "compatibility" && chart && chartB && (
            <Section icon="🏠" title={t.chartHousesTitle} badge={`${t.personA} + ${t.personB}`}>
              <div className="timeline-grid">
                <div className="timeline-day">
                  <p className="timeline-day__date">{t.personA}</p>
                  {houseRowsA.length === 0 ? (
                    <p className="timeline-day__summary">{t.emptyTable}</p>
                  ) : (
                    <div className="table-block">
                      <table className="chart-table">
                        <thead>
                          <tr>
                            <th>{t.colHouse}</th>
                            <th>{t.colSign}</th>
                            <th>{t.colDegree}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {houseRowsA.map((row) => (
                            <tr key={`house-compat-a-${row.house}`}>
                              <td>{row.house}</td>
                              <td>{row.sign === "--" ? "--" : `${SIGN_SYMBOL[row.sign]} ${row.sign}`}</td>
                              <td>{row.degree}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="timeline-day">
                  <p className="timeline-day__date">{t.personB}</p>
                  {houseRowsB.length === 0 ? (
                    <p className="timeline-day__summary">{t.emptyTable}</p>
                  ) : (
                    <div className="table-block">
                      <table className="chart-table">
                        <thead>
                          <tr>
                            <th>{t.colHouse}</th>
                            <th>{t.colSign}</th>
                            <th>{t.colDegree}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {houseRowsB.map((row) => (
                            <tr key={`house-compat-b-${row.house}`}>
                              <td>{row.house}</td>
                              <td>{row.sign === "--" ? "--" : `${SIGN_SYMBOL[row.sign]} ${row.sign}`}</td>
                              <td>{row.degree}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </Section>
          )}

          {!loading && isChartArea && analysisMode === "compatibility" && chart && chartB && (
            <Section icon="📎" title={t.chartAspectsTableTitle} badge={`${t.personA} + ${t.personB}`}>
              <div className="timeline-grid">
                <div className="timeline-day">
                  <p className="timeline-day__date">{t.personA}</p>
                  {aspectRowsA.length === 0 ? (
                    <p className="timeline-day__summary">{t.emptyTable}</p>
                  ) : (
                    <div className="table-block">
                      <table className="chart-table">
                        <thead>
                          <tr>
                            <th>{t.colAspect}</th>
                            <th>{t.colOrb}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aspectRowsA.slice(0, 20).map((aspect, index) => (
                            <tr key={`aspect-compat-a-${aspect.a}-${aspect.type}-${aspect.b}-${index}`}>
                              <td>{aspect.a} {ASPECT_SYMBOL[aspect.type]} {aspect.b}</td>
                              <td>{aspect.orb?.toFixed(1) ?? "--"}deg</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="timeline-day">
                  <p className="timeline-day__date">{t.personB}</p>
                  {aspectRowsB.length === 0 ? (
                    <p className="timeline-day__summary">{t.emptyTable}</p>
                  ) : (
                    <div className="table-block">
                      <table className="chart-table">
                        <thead>
                          <tr>
                            <th>{t.colAspect}</th>
                            <th>{t.colOrb}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aspectRowsB.slice(0, 20).map((aspect, index) => (
                            <tr key={`aspect-compat-b-${aspect.a}-${aspect.type}-${aspect.b}-${index}`}>
                              <td>{aspect.a} {ASPECT_SYMBOL[aspect.type]} {aspect.b}</td>
                              <td>{aspect.orb?.toFixed(1) ?? "--"}deg</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </Section>
          )}

          {!loading && isChartArea && analysisMode === "compatibility" && chart && chartB && (
            <Section icon="🏛️" title={t.chartDignitiesTitle} badge={`${t.personA} + ${t.personB}`}>
              <div className="timeline-grid">
                <div className="timeline-day">
                  <p className="timeline-day__date">{t.personA}</p>
                  <div className="table-block">
                    <table className="chart-table">
                      <thead>
                        <tr>
                          <th>{t.colPoint}</th>
                          <th>{t.colSign}</th>
                          <th>{t.colStatus}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dignityRowsA.map((row) => (
                          <tr key={`dignity-compat-a-${row.planet}`}>
                            <td>{row.planet}</td>
                            <td>{SIGN_SYMBOL[row.sign]} {row.sign}</td>
                            <td>{formatDignityStatusLabel(row.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="timeline-day">
                  <p className="timeline-day__date">{t.personB}</p>
                  <div className="table-block">
                    <table className="chart-table">
                      <thead>
                        <tr>
                          <th>{t.colPoint}</th>
                          <th>{t.colSign}</th>
                          <th>{t.colStatus}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dignityRowsB.map((row) => (
                          <tr key={`dignity-compat-b-${row.planet}`}>
                            <td>{row.planet}</td>
                            <td>{SIGN_SYMBOL[row.sign]} {row.sign}</td>
                            <td>{formatDignityStatusLabel(row.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </Section>
          )}

          {loading && <LoadingState label={t.loading} />}

          {!loading && isChartArea && analysisMode === "single" && cards.length === 0 && (
            <p className="empty-state">
              {t.emptyState}
            </p>
          )}

          {!loading && isRelationshipsArea && analysisMode === "compatibility" && !comparison && (
            <p className="empty-state">
              {t.compatibilityEmpty}
            </p>
          )}

          {!loading && isChartArea && analysisMode === "single" && placements.length > 0 && (
            <PlacementsSummary placements={placements} />
          )}

          {!loading && isChartArea && analysisMode === "single" && heroCards.length > 0 && (
            <Section icon="☀️" title={t.sunMoonInsightsTitle} badge={`${heroCards.length} cards`}>
              <div className="cards-grid--hero">
                {heroCards.map((card) => (
                  <Card
                    key={`${resultVersion}-${card.key}`}
                    title={card.title}
                    subtitle={card.subtitle}
                    text={card.text}
                    tags={card.tags}
                    details={card.details}
                    element={card.element}
                    variant="hero"
                    degree={card.degree}
                    expandLabels={cardExpandLabels}
                  />
                ))}
              </div>
            </Section>
          )}

          {!loading && isChartArea && analysisMode === "single" && planetCards.length > 0 && (
            <Section
              icon="🪐"
              title={t.planetsTitle}
              badge={`${planetCards.length} cards`}
            >
              <div className="cards-grid--planets">
                {planetCards.map((card) => (
                  <Card
                    key={`${resultVersion}-${card.key}`}
                    title={card.title}
                    subtitle={card.subtitle}
                    text={card.text}
                    tags={card.tags}
                    details={card.details}
                    element={card.element}
                    variant="planet"
                    degree={card.degree}
                    expandLabels={cardExpandLabels}
                  />
                ))}
              </div>
            </Section>
          )}

          {!loading && isChartArea && analysisMode === "single" && aspectCards.length > 0 && (
            <Section
              icon="🔗"
              title={t.aspectsTitle}
              badge={t.aspectsBadge(aspectCards.length)}
              badgeAccent
            >
              <div className="cards-grid--aspects">
                {aspectCards.map((card) => (
                  <Card
                    key={`${resultVersion}-${card.key}`}
                    title={card.title}
                    subtitle={card.subtitle}
                    text={card.text}
                    tags={card.tags}
                    details={card.details}
                    variant="aspect"
                    orb={card.orb}
                    expandLabels={cardExpandLabels}
                  />
                ))}
              </div>
            </Section>
          )}

          {!loading && isRelationshipsArea && analysisMode === "compatibility" && comparison && comparison.stats.length > 0 && (
            <Section icon="🎮" title={t.compatibilityStatsTitle} badge={t.compatibilityStatsBadge}>
              <div className={`synastry-stats${duoMode === "romantic" ? " synastry-stats--romantic" : ""}`}>
                {comparison.stats.map((stat) => (
                  <div key={stat.key} className="synastry-stats__item">
                    <div className="synastry-stats__head">
                      <h3 className="synastry-stats__label">{stat.label}</h3>
                      <span className="synastry-stats__value">{stat.score}%</span>
                    </div>
                    <p className="synastry-stats__summary">{stat.summary}</p>
                    <div className="synastry-stats__track" aria-hidden="true">
                      <div
                        className={`synastry-stats__bar synastry-stats__bar--${stat.key}`}
                        style={{ width: `${stat.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {!loading && isRelationshipsArea && analysisMode === "compatibility" && relationshipQuest && (
            <Section icon="🎯" title={t.questTitle} badge={t.questBadge(relationshipQuest.focusStatLabel)}>
              <div className="quest-panel">
                <div className="quest-panel__stats">
                  <p>{t.questXpLabel}: {progression.xp}</p>
                  <p>{t.questStreakLabel}: {progression.streak}</p>
                  <p>{t.questUnlockLabel(unlockedDetailCount)}</p>
                  {nextDetailUnlockXp != null && (
                    <p>{t.questNextUnlockLabel(nextDetailUnlockXp)}</p>
                  )}
                </div>
                <div className="quest-panel__actions">
                  <button
                    type="button"
                    className="quest-action"
                    onClick={handleQuestComplete}
                    disabled={questCompleted}
                  >
                    {questCompleted ? t.questCompleted : t.questComplete}
                  </button>
                  <button
                    type="button"
                    className="quest-action"
                    onClick={handleQuestReflection}
                    disabled={!questCompleted || questReflected}
                  >
                    {questReflected ? t.questReflected : t.questReflect}
                  </button>
                </div>
              </div>
              <div className="cards-grid--quest">
                <Card
                  key={`${resultVersion}-${relationshipQuest.id}`}
                  title={relationshipQuest.title}
                  subtitle={relationshipQuest.subtitle}
                  text={relationshipQuest.text}
                  tags={relationshipQuest.tags}
                  details={relationshipQuest.details.slice(0, unlockedDetailCount)}
                  tone={relationshipQuest.tone}
                  variant="synastry"
                  orb={relationshipQuest.sourceAspect.orb}
                  expandLabels={cardExpandLabels}
                />
              </div>
            </Section>
          )}

          {!loading && isTransitsArea && analysisMode === "compatibility" && dailyOutlook && (
            <Section icon="📆" title={t.todayForUsTitle} badge={`${t.todayForUsBadge} · ${dailyOutlook.dateLabel}`}>
              <div className="cards-grid--today">
                <Card
                  key={`${resultVersion}-${dailyOutlook.opportunity.key}`}
                  title={dailyOutlook.opportunity.title}
                  subtitle={dailyOutlook.opportunity.subtitle}
                  text={dailyOutlook.opportunity.text}
                  tags={dailyOutlook.opportunity.tags}
                  details={dailyOutlook.opportunity.details.slice(0, unlockedDetailCount)}
                  tone={dailyOutlook.opportunity.tone}
                  variant="synastry"
                  orb={dailyOutlook.opportunity.orb}
                  expandLabels={cardExpandLabels}
                />
                <Card
                  key={`${resultVersion}-${dailyOutlook.watchout.key}`}
                  title={dailyOutlook.watchout.title}
                  subtitle={dailyOutlook.watchout.subtitle}
                  text={dailyOutlook.watchout.text}
                  tags={dailyOutlook.watchout.tags}
                  details={dailyOutlook.watchout.details.slice(0, unlockedDetailCount)}
                  tone={dailyOutlook.watchout.tone}
                  variant="synastry"
                  orb={dailyOutlook.watchout.orb}
                  expandLabels={cardExpandLabels}
                />
              </div>
            </Section>
          )}

          {!loading && isTransitsArea && analysisMode === "compatibility" && compatibilityForecast && (
            <Section icon="🗓️" title={t.forecastTitle} badge={t.forecastBadge(forecastRange)}>
              <div className="timeline-controls" role="group" aria-label={t.forecastTitle}>
                <button
                  type="button"
                  className={`timeline-controls__btn ${forecastRange === 7 ? "timeline-controls__btn--active" : ""}`}
                  onClick={() => setForecastRange(7)}
                >
                  7d
                </button>
                <button
                  type="button"
                  className={`timeline-controls__btn ${forecastRange === 14 ? "timeline-controls__btn--active" : ""}`}
                  onClick={() => setForecastRange(14)}
                >
                  14d
                </button>
              </div>
              <div className="timeline-meta">
                <p><strong>{t.forecastBest}:</strong> {compatibilityForecast.bestDay.dateLabel}</p>
                <p><strong>{t.forecastTough}:</strong> {compatibilityForecast.toughestDay.dateLabel}</p>
              </div>
              <div className="timeline-grid">
                {compatibilityForecast.days.map((day) => (
                  <div key={day.dayKey} className="timeline-day">
                    <p className="timeline-day__date">{day.dateLabel}</p>
                    <p className="timeline-day__score">{t.forecastVibe}: {day.vibeScore}%</p>
                    <p className="timeline-day__score">{t.forecastRisk}: {day.riskScore}%</p>
                    <p className="timeline-day__summary">{day.summary}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {!loading && isTransitsArea && chart && transitFeed && (
            <Section icon="🌗" title={t.transitsTitle} badge={`${transitRange}d · ${timeTravelDate}`}>
              <div className="timeline-controls" role="group" aria-label={t.timeTravelTitle}>
                <button
                  type="button"
                  className="timeline-controls__btn"
                  onClick={() => handleTimeTravelShift(-7)}
                >
                  {t.timeTravelBack}
                </button>
                <input
                  type="date"
                  value={timeTravelDate}
                  onChange={(event) => setTimeTravelDate(event.target.value)}
                />
                <button
                  type="button"
                  className="timeline-controls__btn"
                  onClick={handleTimeTravelReset}
                >
                  {t.timeTravelToday}
                </button>
                <button
                  type="button"
                  className="timeline-controls__btn"
                  onClick={() => handleTimeTravelShift(7)}
                >
                  {t.timeTravelForward}
                </button>
              </div>
              <div className="timeline-controls" role="group" aria-label={t.transitsTitle}>
                <button
                  type="button"
                  className={`timeline-controls__btn ${transitRange === 1 ? "timeline-controls__btn--active" : ""}`}
                  onClick={() => {
                    setTransitRange(1);
                    setTransitDayPage(0);
                  }}
                >
                  {t.transitsRangeToday}
                </button>
                <button
                  type="button"
                  className={`timeline-controls__btn ${transitRange === 7 ? "timeline-controls__btn--active" : ""}`}
                  onClick={() => {
                    setTransitRange(7);
                    setTransitDayPage(0);
                  }}
                >
                  {t.transitsRangeWeek}
                </button>
                <button
                  type="button"
                  className={`timeline-controls__btn ${transitRange === 30 ? "timeline-controls__btn--active" : ""}`}
                  onClick={() => {
                    setTransitRange(30);
                    setTransitDayPage(0);
                  }}
                >
                  {t.transitsRangeMonth}
                </button>
                <button
                  type="button"
                  className="timeline-controls__btn"
                  disabled={transitDayPage <= 0}
                  onClick={() => setTransitDayPage((page) => Math.max(0, page - 1))}
                >
                  {t.transitsPrev}
                </button>
                <span className="timeline-day__summary">
                  {t.transitsPage(Math.min(transitDayPage + 1, transitPageCount), transitPageCount)}
                </span>
                <button
                  type="button"
                  className="timeline-controls__btn"
                  disabled={transitDayPage >= transitPageCount - 1}
                  onClick={() => setTransitDayPage((page) => Math.min(transitPageCount - 1, page + 1))}
                >
                  {t.transitsNext}
                </button>
              </div>
              <div className="timeline-meta">
                <p><strong>{t.transitsExactHits}:</strong> {transitFeed.exactHits.length}</p>
                <p><strong>{t.transitsSelectedDay}:</strong> {selectedTransitDay?.date ?? "--"}</p>
                <p><strong>{t.transitsThemeShort}:</strong> {transitShortThemes.length}</p>
                <p><strong>{t.transitsThemeLong}:</strong> {transitLongThemes.length}</p>
              </div>
              <div className="timeline-grid">
                {pagedTransitDays.map((day) => (
                  <div key={day.date} className="timeline-day">
                    <button
                      type="button"
                      className={`timeline-controls__btn ${selectedTransitDay?.date === day.date ? "timeline-controls__btn--active" : ""}`}
                      onClick={() => setSelectedTransitDate(day.date)}
                    >
                      {day.date}
                    </button>
                    <p className="timeline-day__summary">{t.transitsStrongest}</p>
                    {day.strongestHits.slice(0, 3).map((hit) => (
                      <p key={`${day.date}-${hit.transitPlanet}-${hit.natalPlanet}-${hit.aspect}`} className="timeline-day__summary">
                        {hit.transitPlanet} {hit.aspect} {hit.natalPlanet} (orb {hit.orb.toFixed(1)}deg)
                      </p>
                    ))}
                  </div>
                ))}
              </div>
              <div className="timeline-grid">
                <div className="timeline-day">
                  <p className="timeline-day__date">{selectedTransitDay?.date ?? "--"}</p>
                  {selectedTransitDay?.strongestHits.length ? (
                    selectedTransitDay.strongestHits.map((hit) => (
                      <p key={`${selectedTransitDay.date}-detail-${hit.transitPlanet}-${hit.aspect}-${hit.natalPlanet}`} className="timeline-day__summary">
                        {hit.transitPlanet} {hit.aspect} {hit.natalPlanet} (orb {hit.orb.toFixed(1)}deg)
                      </p>
                    ))
                  ) : (
                    <p className="timeline-day__summary">{t.transitsNoHitsDay}</p>
                  )}
                  {selectedTransitExactHits.length > 0 && (
                    <>
                      <p className="timeline-day__summary"><strong>{t.transitsExactHits}:</strong> {selectedTransitExactHits.length}</p>
                      {selectedTransitExactHits.slice(0, 5).map((hit) => (
                        <p key={`exact-${hit.date}-${hit.transitPlanet}-${hit.aspect}-${hit.natalPlanet}`} className="timeline-day__summary">
                          {hit.transitPlanet} {hit.aspect} {hit.natalPlanet} (orb {hit.orb.toFixed(1)}deg)
                        </p>
                      ))}
                    </>
                  )}
                </div>
                <div className="timeline-day">
                  <p className="timeline-day__date">{t.transitsThemeShort}</p>
                  {transitShortThemes.length === 0 ? (
                    <p className="timeline-day__summary">{t.transitsNoHitsDay}</p>
                  ) : (
                    transitShortThemes.map((theme) => (
                      <p key={`short-theme-${theme.key}`} className="timeline-day__summary">
                        {theme.label} ({theme.count} {t.transitsThemeCount}, orb {theme.bestOrb.toFixed(1)}deg)
                      </p>
                    ))
                  )}
                  <p className="timeline-day__date">{t.transitsThemeLong}</p>
                  {transitLongThemes.length === 0 ? (
                    <p className="timeline-day__summary">{t.transitsNoHitsDay}</p>
                  ) : (
                    transitLongThemes.map((theme) => (
                      <p key={`long-theme-${theme.key}`} className="timeline-day__summary">
                        {theme.label} ({theme.count} {t.transitsThemeCount}, orb {theme.bestOrb.toFixed(1)}deg)
                      </p>
                    ))
                  )}
                </div>
                <div className="timeline-day">
                  <p className="timeline-day__date">{t.transitsExactCalendar}</p>
                  {transitExactHitCalendar.length === 0 ? (
                    <p className="timeline-day__summary">{t.transitsNoHitsDay}</p>
                  ) : (
                    transitExactHitCalendar.slice(0, 10).map((entry) => (
                      <p key={`calendar-${entry.date}`} className="timeline-day__summary">
                        {entry.date}: {entry.hits.length} hits
                      </p>
                    ))
                  )}
                </div>
                <div className="timeline-day">
                  <p className="timeline-day__date">{t.transitsReminderTitle}</p>
                  <label className="privacy-controls__toggle">
                    <input
                      type="checkbox"
                      checked={remindersEnabled}
                      onChange={(event) => setRemindersEnabled(event.target.checked)}
                    />
                    <span>{t.transitsReminderTitle}</span>
                  </label>
                  <label className="privacy-controls__toggle">
                    <span>{t.transitsReminderLeadDays}</span>
                    <select
                      value={reminderLeadDays}
                      onChange={(event) => setReminderLeadDays(Number(event.target.value))}
                    >
                      <option value={0}>0d</option>
                      <option value={1}>1d</option>
                      <option value={2}>2d</option>
                      <option value={3}>3d</option>
                    </select>
                  </label>
                  <label className="privacy-controls__toggle">
                    <span>{t.transitsReminderOrb}</span>
                    <select
                      value={reminderMaxOrb}
                      onChange={(event) => setReminderMaxOrb(Number(event.target.value))}
                    >
                      <option value={0.3}>0.3deg</option>
                      <option value={0.5}>0.5deg</option>
                      <option value={1}>1.0deg</option>
                    </select>
                  </label>
                  <p className="timeline-day__summary"><strong>{t.transitsReminderStatus}:</strong> {notificationStatus}</p>
                  <p className="timeline-day__summary"><strong>{t.transitsReminderUpcoming}:</strong> {upcomingReminderHits.length}</p>
                  {upcomingReminderHits.slice(0, 3).map((hit) => (
                    <p key={`reminder-${hit.date}-${hit.transitPlanet}-${hit.aspect}-${hit.natalPlanet}`} className="timeline-day__summary">
                      {hit.date}: {hit.transitPlanet} {hit.aspect} {hit.natalPlanet} (orb {hit.orb.toFixed(1)}deg)
                    </p>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {!loading && isTimingArea && chart && (
            <Section icon="⏳" title={t.timingTitle} badge={`${chartSettings.houseSystem} · ${timeTravelDate}`}>
              <div className="timeline-controls" role="group" aria-label={t.timeTravelTitle}>
                <button
                  type="button"
                  className="timeline-controls__btn"
                  onClick={() => handleTimeTravelShift(-7)}
                >
                  {t.timeTravelBack}
                </button>
                <input
                  type="date"
                  value={timeTravelDate}
                  onChange={(event) => setTimeTravelDate(event.target.value)}
                />
                <button
                  type="button"
                  className="timeline-controls__btn"
                  onClick={handleTimeTravelReset}
                >
                  {t.timeTravelToday}
                </button>
                <button
                  type="button"
                  className="timeline-controls__btn"
                  onClick={() => handleTimeTravelShift(7)}
                >
                  {t.timeTravelForward}
                </button>
              </div>
              <div className="timeline-meta">
                <p><strong>{t.timingAsOf}:</strong> {timeTravelDate}</p>
              </div>
              <div className="timeline-grid">
                {progressed && (
                  <div className="timeline-day">
                    <p className="timeline-day__date">{t.timingProgressed}</p>
                    <p className="timeline-day__summary">{progressed.progressedDate}</p>
                    <p className="timeline-day__summary">Age: {progressed.ageYears}</p>
                  </div>
                )}
                {solarReturn && (
                  <div className="timeline-day">
                    <p className="timeline-day__date">{t.timingSolarReturn}</p>
                    <p className="timeline-day__summary">{solarReturn.exactDateTimeUtc}</p>
                  </div>
                )}
                {lunarReturn && (
                  <div className="timeline-day">
                    <p className="timeline-day__date">{t.timingLunarReturn}</p>
                    <p className="timeline-day__summary">{lunarReturn.exactDateTimeUtc}</p>
                  </div>
                )}
                {profections && (
                  <div className="timeline-day">
                    <p className="timeline-day__date">{t.timingProfection}</p>
                    <p className="timeline-day__summary">Age {profections.age}</p>
                    <p className="timeline-day__summary">House {profections.profectedHouse} · {profections.profectedSign}</p>
                  </div>
                )}
                {saturnReturnHits && (
                  <div className="timeline-day">
                    <p className="timeline-day__date">{t.timingSaturnReturn}</p>
                    <p className="timeline-day__summary">{saturnReturnHits.length} hits</p>
                    {saturnReturnHits.slice(0, 3).map((hit) => (
                      <p key={`${hit.date}-${hit.orb}`} className="timeline-day__summary">
                        {hit.date} (orb {hit.orb.toFixed(1)}deg)
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </Section>
          )}

          {!loading && isRelationshipsArea && analysisMode === "compatibility" && (compositeChart || davisonChart) && (
            <Section icon="🧩" title={t.relationshipsComposite} badge="midpoint + davison">
              <div className="timeline-grid">
                {compositeChart && (
                  <div className="timeline-day">
                    <p className="timeline-day__date">{t.relationshipsComposite}</p>
                    <p className="timeline-day__summary">{compositeChart.normalized.utcDateTime}</p>
                    <p className="timeline-day__summary">{compositeChart.meta.engine}</p>
                  </div>
                )}
                {davisonChart && (
                  <div className="timeline-day">
                    <p className="timeline-day__date">{t.relationshipsDavison}</p>
                    <p className="timeline-day__summary">{davisonChart.normalized.utcDateTime}</p>
                    <p className="timeline-day__summary">{davisonChart.meta.engine}</p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {!loading && isRelationshipsArea && analysisMode === "compatibility" && relationshipTransitFeed && (
            <Section icon="🌠" title={t.relationshipsTransitTimeline} badge={`30d · ${timeTravelDate}`}>
              <div className="timeline-controls" role="group" aria-label={t.relationshipsTransitTimeline}>
                <button
                  type="button"
                  className="timeline-controls__btn"
                  disabled={relationshipTransitDayPage <= 0}
                  onClick={() => setRelationshipTransitDayPage((page) => Math.max(0, page - 1))}
                >
                  {t.transitsPrev}
                </button>
                <span className="timeline-day__summary">
                  {t.transitsPage(
                    Math.min(relationshipTransitDayPage + 1, relationshipTransitPageCount),
                    relationshipTransitPageCount
                  )}
                </span>
                <button
                  type="button"
                  className="timeline-controls__btn"
                  disabled={relationshipTransitDayPage >= relationshipTransitPageCount - 1}
                  onClick={() =>
                    setRelationshipTransitDayPage((page) => Math.min(relationshipTransitPageCount - 1, page + 1))
                  }
                >
                  {t.transitsNext}
                </button>
              </div>
              <div className="timeline-meta">
                <p><strong>{t.relationshipsTransitExact}:</strong> {relationshipTransitFeed.exactHits.length}</p>
                <p><strong>{t.relationshipsTransitSelectedDay}:</strong> {selectedRelationshipTransitDay?.date ?? "--"}</p>
              </div>
              <div className="timeline-grid">
                {pagedRelationshipTransitDays.map((day) => (
                  <div key={`relationship-${day.date}`} className="timeline-day">
                    <button
                      type="button"
                      className={`timeline-controls__btn ${selectedRelationshipTransitDay?.date === day.date ? "timeline-controls__btn--active" : ""}`}
                      onClick={() => setSelectedRelationshipTransitDate(day.date)}
                    >
                      {day.date}
                    </button>
                    {day.strongestHits.slice(0, 3).map((hit) => (
                      <p key={`${day.date}-${hit.transitPlanet}-${hit.natalPlanet}-${hit.aspect}`} className="timeline-day__summary">
                        {hit.transitPlanet} {hit.aspect} {hit.natalPlanet} (orb {hit.orb.toFixed(1)}deg)
                      </p>
                    ))}
                  </div>
                ))}
              </div>
              <div className="timeline-grid">
                <div className="timeline-day">
                  <p className="timeline-day__date">{selectedRelationshipTransitDay?.date ?? "--"}</p>
                  {selectedRelationshipTransitDay?.strongestHits.length ? (
                    selectedRelationshipTransitDay.strongestHits.map((hit) => (
                      <p key={`relationship-detail-${hit.date}-${hit.transitPlanet}-${hit.aspect}-${hit.natalPlanet}`} className="timeline-day__summary">
                        {hit.transitPlanet} {hit.aspect} {hit.natalPlanet} (orb {hit.orb.toFixed(1)}deg)
                      </p>
                    ))
                  ) : (
                    <p className="timeline-day__summary">{t.relationshipsTransitNoHits}</p>
                  )}
                  {selectedRelationshipExactHits.length > 0 && (
                    <>
                      <p className="timeline-day__summary"><strong>{t.relationshipsTransitExact}:</strong> {selectedRelationshipExactHits.length}</p>
                      {selectedRelationshipExactHits.slice(0, 5).map((hit) => (
                        <p key={`relationship-exact-${hit.date}-${hit.transitPlanet}-${hit.aspect}-${hit.natalPlanet}`} className="timeline-day__summary">
                          {hit.transitPlanet} {hit.aspect} {hit.natalPlanet} (orb {hit.orb.toFixed(1)}deg)
                        </p>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </Section>
          )}

          {!loading && isAtlasArea && chart && astrocartography && (
            <Section icon="🧭" title={t.atlasTitle} badge={`${astrocartography.lines.length} lines · ${t.atlasMapBadge}`}>
              <p className="timeline-day__summary">{t.atlasMapHint}</p>
              <AstrocartographyMap
                lines={astrocartography.lines}
                highlightedLabels={atlasHighlightedLabels}
                location={
                  atlasInspectorResult
                    ? {
                        label: atlasInspectorResult.locationLabel,
                        lat: atlasInspectorResult.locationLat,
                        lon: atlasInspectorResult.locationLon,
                      }
                    : null
                }
                label={t.atlasMapTitle}
              />
              <p className="timeline-day__summary">{t.atlasMapTitle}</p>
              <div className="timeline-grid">
                {astrocartography.lines.slice(0, 24).map((line, index) => (
                  <div key={`${line.point}-${line.angle}-${index}`} className="timeline-day">
                    <p className="timeline-day__date">{line.point} {line.angle}</p>
                    <p className="timeline-day__summary">Lon {line.longitude.toFixed(1)}deg</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {!loading && isAtlasArea && chart && (
            <Section icon="📍" title={t.atlasShortlistTitle} badge={t.atlasShortlistBadge}>
              <div className="timeline-controls" role="group" aria-label={t.atlasGoalFocusTitle}>
                <button
                  type="button"
                  className={`timeline-controls__btn ${atlasGoalFocus === "career" ? "timeline-controls__btn--active" : ""}`}
                  onClick={() => setAtlasGoalFocus("career")}
                >
                  {t.atlasGoalCareer}
                </button>
                <button
                  type="button"
                  className={`timeline-controls__btn ${atlasGoalFocus === "relationships" ? "timeline-controls__btn--active" : ""}`}
                  onClick={() => setAtlasGoalFocus("relationships")}
                >
                  {t.atlasGoalRelationships}
                </button>
                <button
                  type="button"
                  className={`timeline-controls__btn ${atlasGoalFocus === "home" ? "timeline-controls__btn--active" : ""}`}
                  onClick={() => setAtlasGoalFocus("home")}
                >
                  {t.atlasGoalHome}
                </button>
                <button
                  type="button"
                  className={`timeline-controls__btn ${atlasGoalFocus === "growth" ? "timeline-controls__btn--active" : ""}`}
                  onClick={() => setAtlasGoalFocus("growth")}
                >
                  {t.atlasGoalGrowth}
                </button>
              </div>
              {atlasShortlist.length === 0 ? (
                <p className="timeline-day__summary">{t.atlasShortlistEmpty}</p>
              ) : (
                <div className="timeline-grid">
                  {atlasShortlist.map((entry) => (
                    <div key={entry.label} className="timeline-day">
                      <p className="timeline-day__date">{entry.label}</p>
                      <p className="timeline-day__summary">Score {entry.score.toFixed(1)}</p>
                      {entry.nearestLines.map((line) => (
                        <p key={`${entry.label}-${line}`} className="timeline-day__summary">{line}</p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {!loading && isAtlasArea && chart && (
            <Section icon="🧷" title={t.atlasCrossingsTitle} badge={t.atlasCrossingsBadge}>
              {atlasCrossings.length === 0 ? (
                <p className="timeline-day__summary">{t.atlasCrossingsEmpty}</p>
              ) : (
                <div className="timeline-grid">
                  {atlasCrossings.map((entry) => (
                    <div key={entry.key} className="timeline-day">
                      <p className="timeline-day__date">{entry.pairLabel}</p>
                      <p className="timeline-day__summary">Delta {entry.distance.toFixed(1)}deg</p>
                      <p className="timeline-day__summary">{entry.interpretation}</p>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {!loading && isAtlasArea && chart && (
            <Section icon="📌" title={t.atlasInspectorTitle}>
              <p className="timeline-day__summary">{t.atlasInspectorHint}</p>
              <form className="timeline-controls" onSubmit={handleInspectAtlasLocation}>
                <input
                  type="text"
                  value={atlasInspectorInput}
                  placeholder={formLabels.searchPlaceholder}
                  onChange={(event) => setAtlasInspectorInput(event.target.value)}
                />
                <button type="submit" className="timeline-controls__btn" disabled={atlasInspectorLoading}>
                  {atlasInspectorLoading ? t.atlasInspectorLoading : t.atlasInspectorButton}
                </button>
              </form>
              {atlasInspectorError && (
                <p className="form__error" role="alert">
                  {atlasInspectorError}
                </p>
              )}
              {!atlasInspectorError && !atlasInspectorResult && (
                <p className="timeline-day__summary">{t.atlasInspectorEmpty}</p>
              )}
              {atlasInspectorResult && (
                <div className="timeline-grid">
                  <div className="timeline-day">
                    <p className="timeline-day__date">{atlasInspectorResult.locationLabel}</p>
                    {atlasInspectorResult.nearestLines.map((line) => (
                      <p key={line.key} className="timeline-day__summary">
                        {line.label} ({line.distance.toFixed(1)}deg): {line.interpretation}
                      </p>
                    ))}
                  </div>
                  {atlasInspectorResult.strongestCrossing && (
                    <div className="timeline-day">
                      <p className="timeline-day__date">{t.atlasInspectorCrossing}</p>
                      <p className="timeline-day__summary">{atlasInspectorResult.strongestCrossing.pairLabel}</p>
                      <p className="timeline-day__summary">
                        Delta {atlasInspectorResult.strongestCrossing.distance.toFixed(1)}deg
                      </p>
                      <p className="timeline-day__summary">{atlasInspectorResult.strongestCrossing.interpretation}</p>
                    </div>
                  )}
                </div>
              )}
            </Section>
          )}

          {!loading && isLibraryArea && (
            <Section icon="📚" title={t.libraryTitle}>
              <div className="timeline-grid">
                <div className="timeline-day">
                  <p className="timeline-day__summary">{t.libraryGlossary}</p>
                  {libraryGlossaryEntries.map((entry) => (
                    <p key={entry.term} className="timeline-day__summary"><strong>{entry.term}:</strong> {entry.text}</p>
                  ))}
                </div>
                <div className="timeline-day">
                  <p className="timeline-day__summary">{t.libraryTemplates}</p>
                  {libraryTemplateEntries.map((template) => (
                    <p key={template} className="timeline-day__summary">{template}</p>
                  ))}
                </div>
                <div className="timeline-day">
                  <p className="timeline-day__date">{t.libraryMoonTitle}</p>
                  <p className="timeline-day__summary"><strong>{t.libraryMoonPhase}:</strong> {moonPhaseInfo.phaseLabel}</p>
                  <p className="timeline-day__summary"><strong>{t.libraryMoonIllumination}:</strong> {moonPhaseInfo.illuminationLabel}</p>
                  <p className="timeline-day__date">{t.libraryTarotTitle}</p>
                  <button type="button" className="timeline-controls__btn" onClick={handleDrawTarot}>
                    {t.libraryTarotDraw}
                  </button>
                  <p className="timeline-day__summary">{t.libraryTarotHint}</p>
                  {tarotDraw && (
                    <>
                      <p className="timeline-day__summary"><strong>{tarotDraw.name}</strong></p>
                      <p className="timeline-day__summary">{isCarioca ? tarotDraw.meaningPt : tarotDraw.meaningEn}</p>
                    </>
                  )}
                </div>
              </div>
            </Section>
          )}

          {!loading && isRelationshipsArea && analysisMode === "compatibility" && advancedOverlays && (
            <Section icon="🧠" title={t.advancedTitle} badge={t.advancedBadge}>
              {!advancedUnlocked && (
                <div className="advanced-lock">
                  <p>{t.advancedLocked}</p>
                  {advancedUnlockTarget != null && (
                    <p>{t.advancedLockedHint(advancedUnlockTarget)}</p>
                  )}
                </div>
              )}
              {advancedUnlocked && (
                <div className="advanced-grid">
                  <div className="advanced-card">
                    <h3>{t.advancedCompositeTitle}</h3>
                    {advancedOverlays.compositeCore.map((item) => (
                      <p key={item.key}><strong>{item.label}:</strong> {item.value}</p>
                    ))}
                  </div>
                  <div className="advanced-card">
                    <h3>{t.advancedMidpointTitle}</h3>
                    {advancedOverlays.midpointHighlights.map((item) => (
                      <p key={item.key}><strong>{item.label}:</strong> {item.value}</p>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          )}

          {!loading && isRelationshipsArea && analysisMode === "compatibility" && comparison && comparisonCards.length > 0 && (
            <Section
              icon="🤝"
              title={t.compatibilityTitle}
              badge={t.compatibilityBadge(comparisonCards.length)}
              badgeAccent
            >
              <div className={`cards-grid--synastry cards-grid--${duoMode}`}>
                {comparisonCards.map((card) => (
                  <Card
                    key={`${resultVersion}-${card.key}`}
                    title={card.title}
                    subtitle={card.subtitle}
                    text={card.text}
                    tags={card.tags}
                    details={card.details}
                    tone={card.tone}
                    variant="synastry"
                    orb={card.orb}
                    expandLabels={cardExpandLabels}
                  />
                ))}
              </div>
            </Section>
          )}

          {!loading && isTransitsArea && !chart && (
            <p className="empty-state">{t.emptyState}</p>
          )}
          {!loading && isTimingArea && !chart && (
            <p className="empty-state">{t.emptyState}</p>
          )}
          {!loading && isAtlasArea && !chart && (
            <p className="empty-state">{t.emptyState}</p>
          )}
          {!loading && isRelationshipsArea && analysisMode !== "compatibility" && (
            <p className="empty-state">
              {isCarioca
                ? "Muda pra Sinastria braba pra liberar a area de relacoes."
                : "Switch to Compatibility mode to use Relationships."}
            </p>
          )}
        </main>
      </div>
      <AstralMapModal
        key={`${analysisMode}-${resultVersion}-${isMapModalOpen ? "open" : "closed"}`}
        isOpen={isMapModalOpen}
        model={astralMapModel}
        title={t.astralMapModalTitle}
        onClose={() => setIsMapModalOpen(false)}
        labels={{
          close: t.astralMapClose,
          downloadPng: t.astralMapDownloadPng,
          downloadPdf: t.astralMapDownloadPdf,
          downloadDonePng: t.astralMapDownloadDonePng,
          downloadDonePdf: t.astralMapDownloadDonePdf,
          downloadError: t.astralMapDownloadError,
          filters: t.astralMapFilters,
          allAspects: t.astralMapAllAspects,
          legendOuterA: t.astralMapLegendOuterA,
          legendInnerB: t.astralMapLegendInnerB,
          legendFlow: t.astralMapLegendFlow,
          legendTension: t.astralMapLegendTension,
          legendIntense: t.astralMapLegendIntense,
        }}
      />
    </div>
    </>
  );
}

export default App;
