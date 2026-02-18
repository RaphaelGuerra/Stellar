import { Body, Ecliptic, GeoVector, MakeTime, SiderealTime, e_tilt } from "astronomy-engine";
import type {
  Aspect,
  AstroPointName,
  ChartInput,
  ChartResult,
  ChartSettings,
  HousePlacement,
  PlanetName,
  PlanetPlacement,
  ZodiacSign,
} from "./types";
import {
  ASPECT_DEFS,
  DEFAULT_CHART_SETTINGS,
  PLANETS,
  SIGNS,
  normalizeAngle,
  normalizeChartSettings,
  serializeSettings,
} from "./constants";
import { resolveCity } from "./resolveCity";

interface LocalDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

interface UtcCandidate {
  utcMillis: number;
  offsetMinutes: number;
}

interface OffsetStats {
  standardOffset: number;
  dstOffset: number;
  hasSeasonalDst: boolean;
  offsets: number[];
}

interface NormalizedTimeResult {
  localDateTime: string;
  utcDateTime: string;
  observationTime: Date;
  offsetMinutes: number;
  daylightSaving: boolean;
}

export interface AstroEngineAdapter {
  readonly name: "AstronomyEngineAdapter" | "SwissEphemerisAdapter";
  readonly engine: "astronomy-engine" | "swiss-ephemeris";
  generateChart(input: ChartInput, settings: ChartSettings): Promise<ChartResult>;
}

const PLANET_BODIES: Record<PlanetName, Body> = {
  Sun: Body.Sun,
  Moon: Body.Moon,
  Mercury: Body.Mercury,
  Venus: Body.Venus,
  Mars: Body.Mars,
  Jupiter: Body.Jupiter,
  Saturn: Body.Saturn,
  Uranus: Body.Uranus,
  Neptune: Body.Neptune,
  Pluto: Body.Pluto,
};

const FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();
const OFFSET_STATS_CACHE = new Map<string, OffsetStats>();

function getFormatter(timeZone: string) {
  const cached = FORMATTER_CACHE.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  FORMATTER_CACHE.set(timeZone, formatter);
  return formatter;
}

function parseLocalDateTime(date: string, time: string): LocalDateTimeParts {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return { year, month, day, hour, minute, second: 0 };
}

function getZonedParts(date: Date, timeZone: string): LocalDateTimeParts {
  const parts = getFormatter(timeZone).formatToParts(date);
  const map: Partial<LocalDateTimeParts> = {};
  for (const part of parts) {
    if (part.type === "year") map.year = Number(part.value);
    if (part.type === "month") map.month = Number(part.value);
    if (part.type === "day") map.day = Number(part.value);
    if (part.type === "hour") map.hour = Number(part.value);
    if (part.type === "minute") map.minute = Number(part.value);
    if (part.type === "second") map.second = Number(part.value);
  }
  return {
    year: map.year ?? 0,
    month: map.month ?? 0,
    day: map.day ?? 0,
    hour: map.hour ?? 0,
    minute: map.minute ?? 0,
    second: map.second ?? 0,
  };
}

function baseUtcMillis(parts: LocalDateTimeParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

function isSameLocalDateTime(left: LocalDateTimeParts, right: LocalDateTimeParts): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.second === right.second
  );
}

function findMatchingUtcCandidates(
  timeZone: string,
  localParts: LocalDateTimeParts,
  candidateOffsets: readonly number[]
): UtcCandidate[] {
  const deduped = new Map<number, UtcCandidate>();
  const localBaseUtc = baseUtcMillis(localParts);
  for (const offsetMinutes of candidateOffsets) {
    const utcMillis = localBaseUtc + offsetMinutes * 60000;
    const zonedParts = getZonedParts(new Date(utcMillis), timeZone);
    if (!isSameLocalDateTime(zonedParts, localParts)) continue;
    deduped.set(utcMillis, { utcMillis, offsetMinutes });
  }
  return Array.from(deduped.values()).sort((left, right) => left.utcMillis - right.utcMillis);
}

export class NonexistentLocalTimeError extends Error {
  constructor(localDateTime: string, timeZone: string) {
    super(`Horario local inexistente: ${localDateTime} em ${timeZone}. Escolha outro horario.`);
    this.name = "NonexistentLocalTimeError";
  }
}

export class AmbiguousLocalTimeError extends Error {
  constructor(localDateTime: string, timeZone: string) {
    super(
      `Horario local ambiguo: ${localDateTime} em ${timeZone}. Selecione horario de verao como Sim ou Nao.`
    );
    this.name = "AmbiguousLocalTimeError";
  }
}

function getOffsetMinutes(timeZone: string, localParts: LocalDateTimeParts): number {
  const utcGuess = baseUtcMillis(localParts);
  const zonedParts = getZonedParts(new Date(utcGuess), timeZone);
  const zonedAsUtc = baseUtcMillis(zonedParts);
  return Math.round((utcGuess - zonedAsUtc) / 60000);
}

function pickMostFrequentOffset(offsetCounts: Map<number, number>): number {
  const ranked = Array.from(offsetCounts.entries()).sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return right[0] - left[0];
  });
  return ranked[0]?.[0] ?? 0;
}

function getOffsetStats(timeZone: string, year: number) {
  const cacheKey = `${timeZone}|${year}`;
  const cached = OFFSET_STATS_CACHE.get(cacheKey);
  if (cached) return cached;

  const offsetsByDay: number[] = [];
  const offsetCounts = new Map<number, number>();
  for (let month = 1; month <= 12; month++) {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const offset = getOffsetMinutes(timeZone, {
        year,
        month,
        day,
        hour: 12,
        minute: 0,
        second: 0,
      });
      offsetsByDay.push(offset);
      offsetCounts.set(offset, (offsetCounts.get(offset) ?? 0) + 1);
    }
  }

  const offsets = Array.from(new Set(offsetsByDay.values()));
  const januaryOffset = offsetsByDay[0] ?? 0;
  const decemberOffset = offsetsByDay[offsetsByDay.length - 1] ?? 0;
  const hasSeasonalDst = offsets.length >= 2 && januaryOffset === decemberOffset;

  let standardOffset: number;
  let dstOffset: number;
  if (hasSeasonalDst) {
    standardOffset = Math.max(...offsets);
    dstOffset = Math.min(...offsets);
  } else {
    standardOffset = pickMostFrequentOffset(offsetCounts);
    dstOffset = standardOffset;
  }

  const result: OffsetStats = {
    standardOffset,
    dstOffset,
    hasSeasonalDst,
    offsets,
  };
  OFFSET_STATS_CACHE.set(cacheKey, result);
  return result;
}

function formatUtcIso(utcMillis: number): string {
  return new Date(utcMillis).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function longitudeToSign(longitude: number): { sign: ZodiacSign; degree: number } {
  const normalized = normalizeAngle(longitude);
  const index = Math.floor(normalized / 30);
  const degree = Math.round((normalized % 30) * 10) / 10;
  return { sign: SIGNS[index] ?? "Aries", degree };
}

function getPlanetLongitude(body: Body, time: Date): number {
  const vector = GeoVector(body, MakeTime(time), true);
  return normalizeAngle(Ecliptic(vector).elon);
}

function computeNormalizedTime(input: ChartInput, resolvedTimezone: string): NormalizedTimeResult {
  const localParts = parseLocalDateTime(input.date, input.time);
  const localDateTime = `${input.date}T${input.time}`;
  const { standardOffset, dstOffset, hasSeasonalDst, offsets } = getOffsetStats(
    resolvedTimezone,
    localParts.year
  );
  const autoOffsetMinutes = getOffsetMinutes(resolvedTimezone, localParts);
  const candidates = findMatchingUtcCandidates(resolvedTimezone, localParts, [
    ...offsets,
    standardOffset,
    dstOffset,
    autoOffsetMinutes,
  ]);
  if (candidates.length === 0) {
    throw new NonexistentLocalTimeError(localDateTime, resolvedTimezone);
  }
  if (input.daylight_saving === "auto" && candidates.length > 1) {
    throw new AmbiguousLocalTimeError(localDateTime, resolvedTimezone);
  }

  let offsetMinutes: number;
  let daylightSaving: boolean;
  let utcMillis: number;
  if (input.daylight_saving === "auto") {
    const selected =
      candidates.find((candidate) => candidate.offsetMinutes === autoOffsetMinutes) ?? candidates[0];
    offsetMinutes = selected.offsetMinutes;
    daylightSaving = hasSeasonalDst && offsetMinutes === dstOffset;
    utcMillis = selected.utcMillis;
  } else {
    const preferredOffset = input.daylight_saving && hasSeasonalDst ? dstOffset : standardOffset;
    const selected = candidates.find((candidate) => candidate.offsetMinutes === preferredOffset);
    if (selected) {
      offsetMinutes = selected.offsetMinutes;
      daylightSaving = hasSeasonalDst && offsetMinutes === dstOffset;
      utcMillis = selected.utcMillis;
    } else {
      const fallback =
        candidates.find((candidate) => candidate.offsetMinutes === autoOffsetMinutes) ?? candidates[0];
      offsetMinutes = fallback.offsetMinutes;
      daylightSaving = hasSeasonalDst && offsetMinutes === dstOffset;
      utcMillis = fallback.utcMillis;
    }
  }

  return {
    localDateTime,
    utcDateTime: formatUtcIso(utcMillis),
    observationTime: new Date(utcMillis),
    offsetMinutes,
    daylightSaving,
  };
}

function buildPlanetMap(time: Date): Record<PlanetName, PlanetPlacement> {
  const result = {} as Record<PlanetName, PlanetPlacement>;
  for (const planet of PLANETS) {
    const longitude = getPlanetLongitude(PLANET_BODIES[planet], time);
    const placement = longitudeToSign(longitude);
    result[planet] = {
      sign: placement.sign,
      degree: placement.degree,
      longitude,
    };
  }
  return result;
}

function buildAspects(time: Date, settings: ChartSettings): Aspect[] {
  const aspects: Aspect[] = [];
  const longitudes = new Map<PlanetName, number>();
  for (const planet of PLANETS) {
    longitudes.set(planet, getPlanetLongitude(PLANET_BODIES[planet], time));
  }
  const orbMultiplier =
    settings.orbMode === "tight" ? 0.8 : settings.orbMode === "wide" ? 1.2 : 1;

  for (let i = 0; i < PLANETS.length; i++) {
    const a = PLANETS[i];
    const lonA = longitudes.get(a);
    if (lonA === undefined) continue;
    for (let j = i + 1; j < PLANETS.length; j++) {
      const b = PLANETS[j];
      const lonB = longitudes.get(b);
      if (lonB === undefined) continue;
      const delta = Math.abs(lonA - lonB);
      const separation = delta > 180 ? 360 - delta : delta;
      for (const aspect of ASPECT_DEFS) {
        const adjustedOrb = aspect.orb * orbMultiplier;
        const orb = Math.abs(separation - aspect.angle);
        if (orb <= adjustedOrb) {
          aspects.push({
            a,
            b,
            type: aspect.type,
            orb: Math.round(orb * 10) / 10,
          });
        }
      }
    }
  }
  aspects.sort((left, right) => (left.orb ?? 0) - (right.orb ?? 0));
  return aspects;
}

function calculateAscendantLongitude(time: Date, latitudeDegrees: number, longitudeDegrees: number): number {
  const siderealHours = SiderealTime(time);
  const localSiderealDegrees = normalizeAngle(siderealHours * 15 + longitudeDegrees);
  const obliquityDegrees = e_tilt(MakeTime(time)).tobl;
  const theta = (localSiderealDegrees * Math.PI) / 180;
  const phi = (latitudeDegrees * Math.PI) / 180;
  const epsilon = (obliquityDegrees * Math.PI) / 180;

  const numerator = -Math.cos(theta);
  const denominator = Math.sin(theta) * Math.cos(epsilon) + Math.tan(phi) * Math.sin(epsilon);
  const westernHorizonLongitude = normalizeAngle((Math.atan2(numerator, denominator) * 180) / Math.PI);
  return normalizeAngle(westernHorizonLongitude + 180);
}

function calculateMcLongitude(time: Date, longitudeDegrees: number): number {
  const siderealHours = SiderealTime(time);
  const localSiderealDegrees = normalizeAngle(siderealHours * 15 + longitudeDegrees);
  const obliquityDegrees = e_tilt(MakeTime(time)).tobl;

  const theta = (localSiderealDegrees * Math.PI) / 180;
  const epsilon = (obliquityDegrees * Math.PI) / 180;
  let lambda = (Math.atan2(Math.sin(theta), Math.cos(theta) * Math.cos(epsilon)) * 180) / Math.PI;
  lambda = normalizeAngle(lambda);
  return lambda;
}

function houseFromCusp(index: number): HousePlacement["house"] {
  return (index + 1) as HousePlacement["house"];
}

function buildHouses(settings: ChartSettings, ascendantLongitude: number, warnings: string[]): HousePlacement[] {
  let house1Longitude = ascendantLongitude;
  if (settings.houseSystem === "WholeSign") {
    house1Longitude = Math.floor(normalizeAngle(ascendantLongitude) / 30) * 30;
  } else if (settings.houseSystem === "Placidus" || settings.houseSystem === "Koch") {
    warnings.push(
      `${settings.houseSystem} currently falls back to Equal house cusps in this engine adapter.`
    );
  }

  return Array.from({ length: 12 }, (_, index) => {
    const cuspLongitude = normalizeAngle(house1Longitude + index * 30);
    const signPlacement = longitudeToSign(cuspLongitude);
    return {
      house: houseFromCusp(index),
      sign: signPlacement.sign,
      degree: signPlacement.degree,
      longitude: cuspLongitude,
      system: settings.houseSystem,
    };
  });
}

function julianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

function buildDerivedPoints(
  time: Date,
  planets: Record<PlanetName, PlanetPlacement>,
  ascendantLongitude: number,
  mcLongitude: number,
  warnings: string[]
): Partial<Record<AstroPointName, PlanetPlacement>> {
  const points: Partial<Record<AstroPointName, PlanetPlacement>> = {};
  for (const planet of PLANETS) {
    points[planet] = planets[planet];
  }

  const jd = julianDay(time);
  const t = (jd - 2451545.0) / 36525;

  const meanNodeLongitude = normalizeAngle(
    125.04452 - 1934.136261 * t + 0.0020708 * t * t + (t * t * t) / 450000
  );
  const lilithLongitude = normalizeAngle(
    83.3532465 + 4069.0137287 * t - 0.01032 * t * t - (t * t * t) / 80053
  );

  const sunLongitude = planets.Sun.longitude ?? 0;
  const moonLongitude = planets.Moon.longitude ?? 0;
  const fortuneLongitude = normalizeAngle(ascendantLongitude + moonLongitude - sunLongitude);

  const trueNodeLongitude = meanNodeLongitude;
  warnings.push("True Node currently approximated by Mean Node in this adapter.");
  warnings.push("Chiron and Vertex are currently heuristic placeholders in this adapter.");

  const derivedLongitudes: Partial<Record<AstroPointName, number>> = {
    TrueNode: trueNodeLongitude,
    MeanNode: meanNodeLongitude,
    Lilith: lilithLongitude,
    Fortune: fortuneLongitude,
    Ascendant: ascendantLongitude,
    Descendant: normalizeAngle(ascendantLongitude + 180),
    MC: mcLongitude,
    IC: normalizeAngle(mcLongitude + 180),
    Vertex: normalizeAngle(ascendantLongitude + 90),
    Chiron: normalizeAngle((planets.Saturn.longitude ?? 0) + 120),
  };

  for (const [point, longitude] of Object.entries(derivedLongitudes) as Array<[AstroPointName, number]>) {
    const placement = longitudeToSign(longitude);
    points[point] = {
      sign: placement.sign,
      degree: placement.degree,
      longitude,
    };
  }

  return points;
}

class AstronomyEngineAdapter implements AstroEngineAdapter {
  readonly name = "AstronomyEngineAdapter" as const;
  readonly engine = "astronomy-engine" as const;

  async generateChart(input: ChartInput, settings: ChartSettings): Promise<ChartResult> {
    const resolvedCity = input.location ?? resolveCity({ city: input.city, country: input.country });
    const warnings: string[] = [];
    const normalizedTime = computeNormalizedTime(input, resolvedCity.timezone);
    const planets = buildPlanetMap(normalizedTime.observationTime);
    const aspects = buildAspects(normalizedTime.observationTime, settings);

    const ascendantLongitude = calculateAscendantLongitude(
      normalizedTime.observationTime,
      resolvedCity.lat,
      resolvedCity.lon
    );
    const mcLongitude = calculateMcLongitude(normalizedTime.observationTime, resolvedCity.lon);

    const points = buildDerivedPoints(
      normalizedTime.observationTime,
      planets,
      ascendantLongitude,
      mcLongitude,
      warnings
    );

    const houses = buildHouses(settings, ascendantLongitude, warnings);
    const ascendant = longitudeToSign(ascendantLongitude);
    const descendant = longitudeToSign(normalizeAngle(ascendantLongitude + 180));
    const mc = longitudeToSign(mcLongitude);
    const ic = longitudeToSign(normalizeAngle(mcLongitude + 180));

    return {
      input,
      settings,
      normalized: {
        localDateTime: normalizedTime.localDateTime,
        utcDateTime: normalizedTime.utcDateTime,
        timezone: resolvedCity.timezone,
        offsetMinutes: normalizedTime.offsetMinutes,
        daylightSaving: normalizedTime.daylightSaving,
        location: {
          lat: resolvedCity.lat,
          lon: resolvedCity.lon,
        },
      },
      points,
      planets,
      angles: {
        ascendant: {
          sign: ascendant.sign,
          degree: ascendant.degree,
          longitude: ascendantLongitude,
        },
        descendant: {
          sign: descendant.sign,
          degree: descendant.degree,
          longitude: normalizeAngle(ascendantLongitude + 180),
        },
        mc: {
          sign: mc.sign,
          degree: mc.degree,
          longitude: mcLongitude,
        },
        ic: {
          sign: ic.sign,
          degree: ic.degree,
          longitude: normalizeAngle(mcLongitude + 180),
        },
        vertex: points.Vertex,
      },
      houses,
      aspects,
      pointAspects: undefined,
      meta: {
        engine: this.engine,
        adapter: this.name,
        settingsHash: serializeSettings(settings),
        warnings,
      },
    };
  }
}

class SwissEphemerisAdapter implements AstroEngineAdapter {
  readonly name = "SwissEphemerisAdapter" as const;
  readonly engine = "swiss-ephemeris" as const;
  private readonly fallback = new AstronomyEngineAdapter();

  async generateChart(input: ChartInput, settings: ChartSettings): Promise<ChartResult> {
    const base = await this.fallback.generateChart(input, settings);
    return {
      ...base,
      meta: {
        ...base.meta,
        engine: this.engine,
        adapter: this.name,
        warnings: [
          "Swiss Ephemeris adapter currently uses astronomy-engine fallback in this build.",
          ...base.meta.warnings,
        ],
      },
    };
  }
}

const ADAPTERS: Record<AstroEngineAdapter["name"], AstroEngineAdapter> = {
  AstronomyEngineAdapter: new AstronomyEngineAdapter(),
  SwissEphemerisAdapter: new SwissEphemerisAdapter(),
};

let activeAdapterName: AstroEngineAdapter["name"] = "SwissEphemerisAdapter";

export function setActiveAstroAdapter(name: AstroEngineAdapter["name"]) {
  activeAdapterName = name;
}

export function getActiveAstroAdapter(): AstroEngineAdapter {
  return ADAPTERS[activeAdapterName] ?? ADAPTERS.SwissEphemerisAdapter;
}

export async function generateChart(
  input: ChartInput,
  settings: Partial<ChartSettings> = DEFAULT_CHART_SETTINGS
): Promise<ChartResult> {
  const normalizedSettings = normalizeChartSettings(settings);
  return getActiveAstroAdapter().generateChart(input, normalizedSettings);
}

export async function generateChartWithAdapter(
  input: ChartInput,
  adapterName: AstroEngineAdapter["name"],
  settings: Partial<ChartSettings> = DEFAULT_CHART_SETTINGS
): Promise<ChartResult> {
  const adapter = ADAPTERS[adapterName] ?? ADAPTERS.SwissEphemerisAdapter;
  return adapter.generateChart(input, normalizeChartSettings(settings));
}

export interface TransitAspectHit {
  date: string;
  transitPlanet: PlanetName;
  natalPlanet: PlanetName;
  aspect: Aspect["type"];
  orb: number;
}

export interface TransitDay {
  date: string;
  strongestHits: TransitAspectHit[];
}

export interface TransitRangeResult {
  from: string;
  to: string;
  days: TransitDay[];
  exactHits: TransitAspectHit[];
}

function angleDistance(a: number, b: number): number {
  const delta = Math.abs(a - b);
  return delta > 180 ? 360 - delta : delta;
}

function detectMajorAspect(separation: number, orbMultiplier = 1): { type: Aspect["type"]; orb: number } | null {
  let best: { type: Aspect["type"]; orb: number } | null = null;
  for (const def of ASPECT_DEFS) {
    const limit = def.orb * orbMultiplier;
    const orb = Math.abs(separation - def.angle);
    if (orb > limit) continue;
    if (!best || orb < best.orb) {
      best = { type: def.type, orb: Math.round(orb * 10) / 10 };
    }
  }
  return best;
}

function iterDaysInclusive(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const endUtc = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cursor.getTime() <= endUtc.getTime()) {
    out.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function formatDateIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function toLocalDateTimeStrings(parts: LocalDateTimeParts): { date: string; time: string; localDateTime: string } {
  const date = `${String(parts.year).padStart(4, "0")}-${pad2(parts.month)}-${pad2(parts.day)}`;
  const time = `${pad2(parts.hour)}:${pad2(parts.minute)}`;
  return { date, time, localDateTime: `${date}T${time}` };
}

function toLocalDateTimeInZone(utcDate: Date, timeZone: string): {
  date: string;
  time: string;
  localDateTime: string;
  offsetMinutes: number;
  daylightSaving: boolean;
} {
  const localParts = getZonedParts(utcDate, timeZone);
  const { date, time, localDateTime } = toLocalDateTimeStrings(localParts);
  const zonedAsUtc = baseUtcMillis(localParts);
  const offsetMinutes = Math.round((utcDate.getTime() - zonedAsUtc) / 60000);
  const offsetStats = getOffsetStats(timeZone, localParts.year);
  const daylightSaving = offsetStats.hasSeasonalDst && offsetMinutes === offsetStats.dstOffset;
  return {
    date,
    time,
    localDateTime,
    offsetMinutes,
    daylightSaving,
  };
}

function buildLocalizedInputFromUtc(
  baseInput: ChartInput,
  location: { lat: number; lon: number; timezone: string },
  utcDate: Date
): ChartInput {
  const localized = toLocalDateTimeInZone(utcDate, location.timezone);
  return {
    ...baseInput,
    date: localized.date,
    time: localized.time,
    location,
  };
}

function buildNormalizedFromUtc(
  utcDate: Date,
  timeZone: string,
  location: { lat: number; lon: number }
): ChartResult["normalized"] {
  const localized = toLocalDateTimeInZone(utcDate, timeZone);
  return {
    localDateTime: localized.localDateTime,
    utcDateTime: formatUtcIso(utcDate.getTime()),
    timezone: timeZone,
    offsetMinutes: localized.offsetMinutes,
    daylightSaving: localized.daylightSaving,
    location,
  };
}

function placementFromLongitude(longitude: number): PlanetPlacement {
  const normalizedLongitude = normalizeAngle(longitude);
  const signPlacement = longitudeToSign(normalizedLongitude);
  return {
    sign: signPlacement.sign,
    degree: signPlacement.degree,
    longitude: normalizedLongitude,
  };
}

export async function generateTransits(
  baseChart: ChartResult,
  range: { from: string; to: string },
  settings: Partial<ChartSettings> = baseChart.settings
): Promise<TransitRangeResult> {
  const fromDate = new Date(`${range.from}T00:00:00Z`);
  const toDate = new Date(`${range.to}T00:00:00Z`);
  const days = iterDaysInclusive(fromDate, toDate);
  const orbMultiplier =
    settings.orbMode === "tight" ? 0.8 : settings.orbMode === "wide" ? 1.2 : 1;

  const dayRows: TransitDay[] = [];
  const exactHits: TransitAspectHit[] = [];

  for (const day of days) {
    const transitInput: ChartInput = {
      ...baseChart.input,
      date: formatDateIso(day),
      time: "12:00",
      location: {
        lat: baseChart.normalized.location.lat,
        lon: baseChart.normalized.location.lon,
        timezone: baseChart.normalized.timezone,
      },
    };
    const transitChart = await generateChart(transitInput, settings);
    const hits: TransitAspectHit[] = [];
    for (const transitPlanet of PLANETS) {
      const transitLongitude = transitChart.planets[transitPlanet].longitude ?? 0;
      for (const natalPlanet of PLANETS) {
        const natalLongitude = baseChart.planets[natalPlanet].longitude ?? 0;
        const separation = angleDistance(transitLongitude, natalLongitude);
        const match = detectMajorAspect(separation, orbMultiplier);
        if (!match) continue;
        const hit: TransitAspectHit = {
          date: transitInput.date,
          transitPlanet,
          natalPlanet,
          aspect: match.type,
          orb: match.orb,
        };
        hits.push(hit);
        if (match.orb <= 0.4) exactHits.push(hit);
      }
    }
    hits.sort((a, b) => a.orb - b.orb);
    dayRows.push({
      date: transitInput.date,
      strongestHits: hits.slice(0, 6),
    });
  }

  return {
    from: range.from,
    to: range.to,
    days: dayRows,
    exactHits: exactHits.sort((a, b) => a.date.localeCompare(b.date) || a.orb - b.orb),
  };
}

export interface SecondaryProgressionResult {
  ageYears: number;
  progressedDate: string;
  progressedChart: ChartResult;
}

export async function generateSecondaryProgressions(
  baseChart: ChartResult,
  date: string,
  settings: Partial<ChartSettings> = baseChart.settings
): Promise<SecondaryProgressionResult> {
  const birth = new Date(baseChart.normalized.utcDateTime);
  const target = new Date(`${date}T12:00:00Z`);
  const ageYears = Math.max(0, (target.getTime() - birth.getTime()) / (365.2425 * 86400000));
  const progressedUtc = new Date(birth.getTime() + ageYears * 86400000);
  const location = {
    lat: baseChart.normalized.location.lat,
    lon: baseChart.normalized.location.lon,
    timezone: baseChart.normalized.timezone,
  };

  const progressedInput = buildLocalizedInputFromUtc(baseChart.input, location, progressedUtc);

  const progressedChart = await generateChart(progressedInput, settings);
  return {
    ageYears: Math.round(ageYears * 100) / 100,
    progressedDate: progressedInput.date,
    progressedChart,
  };
}

export interface ReturnChartResult {
  exactDateTimeUtc: string;
  chart: ChartResult;
}

async function findClosestReturn(
  baseChart: ChartResult,
  approximateDate: Date,
  targetLongitude: number,
  point: PlanetName,
  settings: Partial<ChartSettings>
): Promise<ReturnChartResult> {
  const location = {
    lat: baseChart.normalized.location.lat,
    lon: baseChart.normalized.location.lon,
    timezone: baseChart.normalized.timezone,
  };
  let bestChart: ChartResult | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let minutesOffset = -2880; minutesOffset <= 2880; minutesOffset += 60) {
    const date = new Date(approximateDate.getTime() + minutesOffset * 60000);
    const input = buildLocalizedInputFromUtc(baseChart.input, location, date);
    const chart = await generateChart(input, settings);
    const candidateLongitude = chart.planets[point].longitude ?? 0;
    const dist = angleDistance(candidateLongitude, targetLongitude);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestChart = chart;
    }
  }

  return {
    exactDateTimeUtc: bestChart?.normalized.utcDateTime ?? approximateDate.toISOString(),
    chart: bestChart ?? baseChart,
  };
}

export async function generateSolarReturn(
  baseChart: ChartResult,
  year: number,
  settings: Partial<ChartSettings> = baseChart.settings
): Promise<ReturnChartResult> {
  const birthDate = new Date(baseChart.normalized.utcDateTime);
  const approx = new Date(Date.UTC(year, birthDate.getUTCMonth(), birthDate.getUTCDate(), 12, 0, 0));
  return findClosestReturn(baseChart, approx, baseChart.planets.Sun.longitude ?? 0, "Sun", settings);
}

export async function generateLunarReturn(
  baseChart: ChartResult,
  month: string,
  settings: Partial<ChartSettings> = baseChart.settings
): Promise<ReturnChartResult> {
  const [yearRaw, monthRaw] = month.split("-").map(Number);
  const year = Number.isFinite(yearRaw) ? yearRaw : new Date().getUTCFullYear();
  const monthIndex = Number.isFinite(monthRaw) ? Math.max(1, Math.min(12, monthRaw)) - 1 : 0;
  const targetLongitude = baseChart.planets.Moon.longitude ?? 0;
  const location = {
    lat: baseChart.normalized.location.lat,
    lon: baseChart.normalized.location.lon,
    timezone: baseChart.normalized.timezone,
  };

  const coarseStart = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0) - 12 * 60 * 60000);
  const coarseEnd = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0) + 12 * 60 * 60000);

  let coarseBest: ChartResult | null = null;
  let coarseBestDistance = Number.POSITIVE_INFINITY;
  for (let at = coarseStart.getTime(); at <= coarseEnd.getTime(); at += 360 * 60000) {
    const utcDate = new Date(at);
    const input = buildLocalizedInputFromUtc(baseChart.input, location, utcDate);
    const chart = await generateChart(input, settings);
    const dist = angleDistance(chart.planets.Moon.longitude ?? 0, targetLongitude);
    if (dist < coarseBestDistance) {
      coarseBestDistance = dist;
      coarseBest = chart;
    }
  }

  const centerUtc = coarseBest
    ? Date.parse(coarseBest.normalized.utcDateTime)
    : Date.UTC(year, monthIndex, 15, 12, 0, 0);
  const fineStart = Math.max(coarseStart.getTime(), centerUtc - 12 * 60 * 60000);
  const fineEnd = Math.min(coarseEnd.getTime(), centerUtc + 12 * 60 * 60000);

  let bestChart = coarseBest;
  let bestDistance = coarseBestDistance;
  for (let at = fineStart; at <= fineEnd; at += 10 * 60000) {
    const utcDate = new Date(at);
    const input = buildLocalizedInputFromUtc(baseChart.input, location, utcDate);
    const chart = await generateChart(input, settings);
    const dist = angleDistance(chart.planets.Moon.longitude ?? 0, targetLongitude);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestChart = chart;
    }
  }

  return {
    exactDateTimeUtc: bestChart?.normalized.utcDateTime ?? new Date(centerUtc).toISOString(),
    chart: bestChart ?? baseChart,
  };
}

export interface AnnualProfectionResult {
  age: number;
  profectedHouse: number;
  profectedSign: ZodiacSign;
}

export function generateAnnualProfections(baseChart: ChartResult, date = new Date()): AnnualProfectionResult {
  const birth = new Date(baseChart.normalized.utcDateTime);
  let age = date.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    date.getUTCMonth() < birth.getUTCMonth() ||
    (date.getUTCMonth() === birth.getUTCMonth() && date.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  age = Math.max(0, age);
  const profectedHouse = ((age % 12) + 1);
  const house = baseChart.houses?.find((item) => item.house === profectedHouse);
  return {
    age,
    profectedHouse,
    profectedSign: house?.sign ?? "Aries",
  };
}

export interface SaturnReturnHit {
  date: string;
  orb: number;
}

export async function generateSaturnReturnTracker(
  baseChart: ChartResult,
  settings: Partial<ChartSettings> = baseChart.settings
): Promise<SaturnReturnHit[]> {
  const natalSaturn = baseChart.planets.Saturn.longitude ?? 0;
  const birth = new Date(baseChart.normalized.utcDateTime);
  const start = new Date(Date.UTC(birth.getUTCFullYear() + 27, birth.getUTCMonth(), birth.getUTCDate()));
  const end = new Date(Date.UTC(birth.getUTCFullYear() + 32, birth.getUTCMonth(), birth.getUTCDate()));
  const hits: SaturnReturnHit[] = [];

  for (const day of iterDaysInclusive(start, end)) {
    const input: ChartInput = {
      ...baseChart.input,
      date: formatDateIso(day),
      time: "12:00",
      location: {
        lat: baseChart.normalized.location.lat,
        lon: baseChart.normalized.location.lon,
        timezone: baseChart.normalized.timezone,
      },
    };
    const chart = await generateChart(input, settings);
    const saturnLongitude = chart.planets.Saturn.longitude ?? 0;
    const orb = angleDistance(natalSaturn, saturnLongitude);
    if (orb <= 2) {
      hits.push({ date: input.date, orb: Math.round(orb * 10) / 10 });
    }
  }

  return hits;
}

export type CompositeMethod = "midpoint" | "davison";

function midpointLongitude(a: number, b: number): number {
  const ar = (a * Math.PI) / 180;
  const br = (b * Math.PI) / 180;
  return normalizeAngle((Math.atan2(Math.sin(ar) + Math.sin(br), Math.cos(ar) + Math.cos(br)) * 180) / Math.PI);
}

function buildPlanetAspectsFromPlacements(planets: Record<PlanetName, PlanetPlacement>): Aspect[] {
  const aspects: Aspect[] = [];
  for (let i = 0; i < PLANETS.length; i++) {
    const a = PLANETS[i];
    for (let j = i + 1; j < PLANETS.length; j++) {
      const b = PLANETS[j];
      const lonA = planets[a].longitude ?? 0;
      const lonB = planets[b].longitude ?? 0;
      const match = detectMajorAspect(angleDistance(lonA, lonB));
      if (!match) continue;
      aspects.push({ a, b, type: match.type, orb: match.orb });
    }
  }
  return aspects.sort((left, right) => (left.orb ?? 0) - (right.orb ?? 0));
}

export async function generateComposite(
  chartA: ChartResult,
  chartB: ChartResult,
  method: CompositeMethod,
  settings: Partial<ChartSettings> = chartA.settings
): Promise<ChartResult> {
  const normalizedSettings = normalizeChartSettings(settings);
  if (method === "davison") {
    const timeA = Date.parse(chartA.normalized.utcDateTime);
    const timeB = Date.parse(chartB.normalized.utcDateTime);
    const midTime = new Date((timeA + timeB) / 2);
    const lat = (chartA.normalized.location.lat + chartB.normalized.location.lat) / 2;
    const lon = (chartA.normalized.location.lon + chartB.normalized.location.lon) / 2;
    const davisonLocation = {
      lat,
      lon,
      timezone: chartA.normalized.timezone,
    };
    const baseInput: ChartInput = {
      ...chartA.input,
      city: `${chartA.input.city}/${chartB.input.city}`,
      country: chartA.input.country || chartB.input.country,
      daylight_saving: "auto",
      location: davisonLocation,
    };
    const input = buildLocalizedInputFromUtc(baseInput, davisonLocation, midTime);
    const chart = await generateChart(input, normalizedSettings);
    return {
      ...chart,
      settings: normalizedSettings,
      meta: {
        ...chart.meta,
        settingsHash: serializeSettings(normalizedSettings),
        warnings: ["Davison chart derived from midpoint time/location.", ...chart.meta.warnings],
      },
    };
  }

  const planets = {} as Record<PlanetName, PlanetPlacement>;
  for (const planet of PLANETS) {
    const lonA = chartA.planets[planet].longitude ?? 0;
    const lonB = chartB.planets[planet].longitude ?? 0;
    const lon = midpointLongitude(lonA, lonB);
    planets[planet] = placementFromLongitude(lon);
  }

  const aspects = buildPlanetAspectsFromPlacements(planets);
  const midpointAsc = midpointLongitude(
    chartA.angles?.ascendant.longitude ?? 0,
    chartB.angles?.ascendant.longitude ?? 0
  );
  const midpointMc = midpointLongitude(
    chartA.angles?.mc?.longitude ?? 0,
    chartB.angles?.mc?.longitude ?? 0
  );
  const midpointDesc = normalizeAngle(midpointAsc + 180);
  const midpointIc = normalizeAngle(midpointMc + 180);
  const midpointVertex = midpointLongitude(
    chartA.angles?.vertex?.longitude ?? normalizeAngle((chartA.angles?.ascendant.longitude ?? 0) + 90),
    chartB.angles?.vertex?.longitude ?? normalizeAngle((chartB.angles?.ascendant.longitude ?? 0) + 90)
  );

  const houses = buildHouses(normalizedSettings, midpointAsc, []);
  const timeA = Date.parse(chartA.normalized.utcDateTime);
  const timeB = Date.parse(chartB.normalized.utcDateTime);
  const midpointUtc = new Date((timeA + timeB) / 2);
  const location = {
    lat: (chartA.normalized.location.lat + chartB.normalized.location.lat) / 2,
    lon: (chartA.normalized.location.lon + chartB.normalized.location.lon) / 2,
  };
  const normalized = buildNormalizedFromUtc(midpointUtc, chartA.normalized.timezone, location);
  const input: ChartInput = {
    ...chartA.input,
    city: `${chartA.input.city}/${chartB.input.city}`,
    country: chartA.input.country || chartB.input.country,
    date: normalized.localDateTime.slice(0, 10),
    time: normalized.localDateTime.slice(11, 16),
    daylight_saving: "auto",
    location: {
      ...location,
      timezone: normalized.timezone,
    },
  };

  const angles = {
    ascendant: placementFromLongitude(midpointAsc),
    descendant: placementFromLongitude(midpointDesc),
    mc: placementFromLongitude(midpointMc),
    ic: placementFromLongitude(midpointIc),
    vertex: placementFromLongitude(midpointVertex),
  };
  const midpointPoints: AstroPointName[] = ["TrueNode", "MeanNode", "Chiron", "Lilith", "Fortune"];
  const points: Partial<Record<AstroPointName, PlanetPlacement>> = {
    ...chartA.points,
    ...Object.fromEntries(PLANETS.map((planet) => [planet, planets[planet]])),
    Ascendant: angles.ascendant,
    Descendant: angles.descendant,
    MC: angles.mc,
    IC: angles.ic,
    Vertex: angles.vertex,
    Fortune: placementFromLongitude(
      midpointAsc + (planets.Moon.longitude ?? 0) - (planets.Sun.longitude ?? 0)
    ),
  };
  for (const point of midpointPoints) {
    const lonA = chartA.points[point]?.longitude;
    const lonB = chartB.points[point]?.longitude;
    if (typeof lonA === "number" && typeof lonB === "number") {
      points[point] = placementFromLongitude(midpointLongitude(lonA, lonB));
    }
  }

  return {
    ...chartA,
    input,
    settings: normalizedSettings,
    normalized,
    planets,
    points,
    angles,
    aspects,
    houses,
    meta: {
      ...chartA.meta,
      settingsHash: serializeSettings(normalizedSettings),
      warnings: ["Composite midpoint chart derived from both charts."],
    },
  };
}

export interface AstrocartographyLine {
  point: AstroPointName;
  angle: "MC" | "IC" | "ASC" | "DSC";
  longitude: number; // -180 to 180
}

export interface AstrocartographyResult {
  lines: AstrocartographyLine[];
}

function toSignedLongitude(value: number): number {
  const normalized = normalizeAngle(value);
  return normalized > 180 ? normalized - 360 : normalized;
}

export function generateAstrocartography(
  baseChart: ChartResult,
  settings: Partial<ChartSettings> = baseChart.settings
): AstrocartographyResult {
  const normalizedSettings = normalizeChartSettings(settings);
  const time = new Date(baseChart.normalized.utcDateTime);
  const gmstDegrees = normalizeAngle(SiderealTime(time) * 15);
  const points: AstroPointName[] = [
    ...PLANETS,
    "Ascendant",
    "MC",
  ];

  const lines: AstrocartographyLine[] = [];
  for (const point of points) {
    const source =
      point === "Ascendant"
        ? baseChart.angles?.ascendant
        : point === "MC"
          ? baseChart.angles?.mc
          : baseChart.points[point];
    const longitude = source?.longitude;
    if (typeof longitude !== "number") continue;
    const mcLongitude = normalizeAngle(longitude - gmstDegrees);
    lines.push(
      { point, angle: "MC", longitude: toSignedLongitude(mcLongitude) },
      { point, angle: "IC", longitude: toSignedLongitude(mcLongitude + 180) },
      { point, angle: "ASC", longitude: toSignedLongitude(mcLongitude + 90) },
      { point, angle: "DSC", longitude: toSignedLongitude(mcLongitude - 90) }
    );
  }

  if (normalizedSettings.houseSystem === "Koch" || normalizedSettings.houseSystem === "Placidus") {
    // Keep deterministic output trace of requested settings.
  }

  return { lines };
}
