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
  const result: Record<PlanetName, { sign: ZodiacSign; degree: number }> = {} as Record<
    PlanetName,
    { sign: ZodiacSign; degree: number }
  >;
  for (const planet of PLANETS) {
    const longitude = getPlanetLongitude(PLANET_BODIES[planet], time);
    const placement = longitudeToSign(longitude);
    result[planet] = { sign: placement.sign, degree: placement.degree };
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
  const utcMillis = baseUtcMillis(localParts) + offsetMinutes * 60000;
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
