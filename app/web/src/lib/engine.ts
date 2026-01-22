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
  const daylightSaving = input.daylight_saving === "auto" ? false : input.daylight_saving;
  const localDateTime = `${input.date}T${input.time}`;

  const rng = createRng(`${input.date}|${input.time}|${input.city}|${input.country}`);
  const planets = buildPlanets(rng);
  const houses = buildHouses(rng);
  const aspects = buildAspects(rng);

  return {
    input,
    normalized: {
      localDateTime,
      utcDateTime: `${localDateTime}:00Z`,
      timezone: resolvedCity.timezone,
      offsetMinutes: 0,
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
