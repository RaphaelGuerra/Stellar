import { Body, Ecliptic, GeoVector, MakeTime } from "astronomy-engine";
import type { Aspect, AspectName, ChartInput, ChartResult, PlanetName, ZodiacSign } from "./types";
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

const SIGNS: ZodiacSign[] = [
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

const PLANETS: PlanetName[] = [
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

const ASPECT_DEFS: Array<{ type: AspectName; angle: number; orb: number }> = [
  { type: "Conjunction", angle: 0, orb: 8 },
  { type: "Opposition", angle: 180, orb: 8 },
  { type: "Square", angle: 90, orb: 6 },
  { type: "Trine", angle: 120, orb: 6 },
  { type: "Sextile", angle: 60, orb: 4 },
];

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
  if (offsetsByDay.length === 0) {
    const emptyResult: OffsetStats = {
      standardOffset: 0,
      dstOffset: 0,
      hasSeasonalDst: false,
      offsets: [0],
    };
    OFFSET_STATS_CACHE.set(cacheKey, emptyResult);
    return emptyResult;
  }

  const offsets = Array.from(new Set(offsetsByDay.values()));
  const januaryOffset = offsetsByDay[0];
  const decemberOffset = offsetsByDay[offsetsByDay.length - 1];
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

function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
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

function buildPlanets(time: Date) {
  const result: Record<PlanetName, { sign: ZodiacSign; degree: number; longitude: number }> = {} as Record<
    PlanetName,
    { sign: ZodiacSign; degree: number; longitude: number }
  >;
  for (const planet of PLANETS) {
    const longitude = getPlanetLongitude(PLANET_BODIES[planet], time);
    const placement = longitudeToSign(longitude);
    result[planet] = { sign: placement.sign, degree: placement.degree, longitude };
  }
  return result;
}

function buildAspects(time: Date): Aspect[] {
  const aspects: Aspect[] = [];
  const longitudes = new Map<PlanetName, number>();
  for (const planet of PLANETS) {
    longitudes.set(planet, getPlanetLongitude(PLANET_BODIES[planet], time));
  }
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
        const orb = Math.abs(separation - aspect.angle);
        if (orb <= aspect.orb) {
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

export async function generateChart(input: ChartInput): Promise<ChartResult> {
  const resolvedCity = input.location ?? resolveCity({ city: input.city, country: input.country });
  const localParts = parseLocalDateTime(input.date, input.time);
  const localDateTime = `${input.date}T${input.time}`;
  const { standardOffset, dstOffset, hasSeasonalDst, offsets } = getOffsetStats(
    resolvedCity.timezone,
    localParts.year
  );
  const autoOffsetMinutes = getOffsetMinutes(resolvedCity.timezone, localParts);
  const candidates = findMatchingUtcCandidates(resolvedCity.timezone, localParts, [
    ...offsets,
    standardOffset,
    dstOffset,
    autoOffsetMinutes,
  ]);
  if (candidates.length === 0) {
    throw new NonexistentLocalTimeError(localDateTime, resolvedCity.timezone);
  }
  if (input.daylight_saving === "auto" && candidates.length > 1) {
    throw new AmbiguousLocalTimeError(localDateTime, resolvedCity.timezone);
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
      // For non-ambiguous local times where the requested manual offset is unavailable,
      // keep a valid UTC candidate instead of synthesizing a shifted instant.
      const fallback =
        candidates.find((candidate) => candidate.offsetMinutes === autoOffsetMinutes) ?? candidates[0];
      offsetMinutes = fallback.offsetMinutes;
      daylightSaving = hasSeasonalDst && offsetMinutes === dstOffset;
      utcMillis = fallback.utcMillis;
    }
  }
  const utcDateTime = formatUtcIso(utcMillis);
  const observationTime = new Date(utcMillis);

  const planets = buildPlanets(observationTime);
  const aspects = buildAspects(observationTime);

  return {
    input,
    normalized: {
      localDateTime,
      utcDateTime,
      timezone: resolvedCity.timezone,
      offsetMinutes,
      daylightSaving,
      location: {
        lat: resolvedCity.lat,
        lon: resolvedCity.lon,
      },
    },
    planets,
    aspects,
  };
}
