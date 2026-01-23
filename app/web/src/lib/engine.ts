import type {
  Aspect,
  AspectName,
  ChartInput,
  ChartResult,
  HousePlacement,
  PlanetName,
  ZodiacSign,
} from "./types";
import { resolveCity } from "./resolveCity";

interface LocalDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
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

const ASPECT_TYPES: AspectName[] = ["Conjunction", "Opposition", "Square", "Trine", "Sextile"];

const FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

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

function getOffsetMinutes(timeZone: string, localParts: LocalDateTimeParts): number {
  const utcGuess = baseUtcMillis(localParts);
  const zonedParts = getZonedParts(new Date(utcGuess), timeZone);
  const zonedAsUtc = baseUtcMillis(zonedParts);
  return Math.round((utcGuess - zonedAsUtc) / 60000);
}

function getOffsetStats(timeZone: string, year: number) {
  const offsets = new Set<number>();
  for (let month = 1; month <= 12; month++) {
    offsets.add(
      getOffsetMinutes(timeZone, {
        year,
        month,
        day: 15,
        hour: 12,
        minute: 0,
        second: 0,
      })
    );
  }
  const values = Array.from(offsets.values());
  if (values.length === 0) {
    return { standardOffset: 0, dstOffset: 0 };
  }
  const standardOffset = Math.max(...values);
  const dstOffset = Math.min(...values);
  return { standardOffset, dstOffset };
}

function formatUtcIso(utcMillis: number): string {
  return new Date(utcMillis).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function hashSeed(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function createRng(seed: string) {
  let state = hashSeed(seed) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

function pickSign(rng: () => number): ZodiacSign {
  return SIGNS[Math.floor(rng() * SIGNS.length)];
}

function buildPlanets(rng: () => number) {
  const result: Record<PlanetName, { sign: ZodiacSign }> = {} as Record<
    PlanetName,
    { sign: ZodiacSign }
  >;
  for (const planet of PLANETS) {
    result[planet] = { sign: pickSign(rng) };
  }
  return result;
}

function buildHouses(rng: () => number): HousePlacement[] {
  const houses: HousePlacement[] = [];
  for (let i = 1 as const; i <= 12; i++) {
    const degree = Math.round(rng() * 29.9 * 10) / 10; // one decimal place
    houses.push({
      house: i,
      sign: pickSign(rng),
      degree,
    });
  }
  return houses;
}

function buildAspects(rng: () => number): Aspect[] {
  const aspects: Aspect[] = [];
  const used = new Set<string>();
  const total = 4;

  while (aspects.length < total) {
    const a = PLANETS[Math.floor(rng() * PLANETS.length)];
    const b = PLANETS[Math.floor(rng() * PLANETS.length)];
    if (a === b) continue;
    const key = [a, b].sort().join("-");
    if (used.has(key)) continue;
    used.add(key);
    aspects.push({
      a,
      b,
      type: ASPECT_TYPES[Math.floor(rng() * ASPECT_TYPES.length)],
    });
  }

  return aspects;
}

export async function generateChart(input: ChartInput): Promise<ChartResult> {
  const resolvedCity = resolveCity({ city: input.city, country: input.country });
  const localParts = parseLocalDateTime(input.date, input.time);
  const { standardOffset, dstOffset } = getOffsetStats(resolvedCity.timezone, localParts.year);
  const autoOffsetMinutes = getOffsetMinutes(resolvedCity.timezone, localParts);
  const daylightSaving =
    input.daylight_saving === "auto" ? autoOffsetMinutes !== standardOffset : input.daylight_saving;
  const offsetMinutes =
    input.daylight_saving === "auto"
      ? autoOffsetMinutes
      : input.daylight_saving
      ? dstOffset
      : standardOffset;
  const localDateTime = `${input.date}T${input.time}`;
  const utcDateTime = formatUtcIso(baseUtcMillis(localParts) + offsetMinutes * 60000);

  const rng = createRng(`${input.date}|${input.time}|${input.city}|${input.country}`);
  const planets = buildPlanets(rng);
  const houses = buildHouses(rng);
  const aspects = buildAspects(rng);

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
    houses,
    aspects,
  };
}
