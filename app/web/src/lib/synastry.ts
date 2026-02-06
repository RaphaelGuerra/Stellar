import type {
  AspectName,
  ChartComparison,
  ChartResult,
  ComparisonAspect,
  ComparisonHighlight,
  PlanetName,
  ZodiacSign,
} from "./types";

export type SynastryLocale = "pt" | "en";

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

const SIGN_INDEX: Record<ZodiacSign, number> = {
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

const ASPECT_DEFS: Array<{ type: AspectName; angle: number; orb: number }> = [
  { type: "Conjunction", angle: 0, orb: 8 },
  { type: "Opposition", angle: 180, orb: 8 },
  { type: "Square", angle: 90, orb: 6 },
  { type: "Trine", angle: 120, orb: 6 },
  { type: "Sextile", angle: 60, orb: 4 },
];

const ASPECT_LABELS: Record<SynastryLocale, Record<AspectName, string>> = {
  en: {
    Conjunction: "Conjunction",
    Opposition: "Opposition",
    Square: "Square",
    Trine: "Trine",
    Sextile: "Sextile",
  },
  pt: {
    Conjunction: "Conjuncao",
    Opposition: "Oposicao",
    Square: "Quadratura",
    Trine: "Trigono",
    Sextile: "Sextil",
  },
};

const ASPECT_TEXT: Record<SynastryLocale, Record<AspectName, string>> = {
  en: {
    Conjunction: "Intense fusion of energies. High identification and high impact.",
    Opposition: "Polar tension and attraction. Balance is the key for this axis.",
    Square: "Friction that creates growth. Demands adjustment from both sides.",
    Trine: "Natural flow and ease. Shared talents cooperate with less effort.",
    Sextile: "Constructive opportunity. Works best with conscious initiative.",
  },
  pt: {
    Conjunction: "Fusao intensa de energias. Alta identificacao e alto impacto.",
    Opposition: "Tensao polar e atracao. Equilibrio e a chave desse eixo.",
    Square: "Atrito que gera crescimento. Exige ajuste dos dois lados.",
    Trine: "Fluxo natural e facilidade. Talentos cooperam com menos esforco.",
    Sextile: "Oportunidade construtiva. Funciona melhor com iniciativa consciente.",
  },
};

function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

function getPlanetLongitude(chart: ChartResult, planet: PlanetName): number {
  const placement = chart.planets[planet];
  const explicitLongitude = placement.longitude;
  if (typeof explicitLongitude === "number" && Number.isFinite(explicitLongitude)) {
    return normalizeAngle(explicitLongitude);
  }
  const signOffset = (SIGN_INDEX[placement.sign] ?? 0) * 30;
  return normalizeAngle(signOffset + (placement.degree ?? 0));
}

function separationDegrees(a: number, b: number): number {
  const delta = Math.abs(a - b);
  return delta > 180 ? 360 - delta : delta;
}

function makeHighlight(
  aspect: ComparisonAspect,
  index: number,
  locale: SynastryLocale
): ComparisonHighlight {
  const label = ASPECT_LABELS[locale][aspect.type];
  return {
    key: `synastry-${index}-${aspect.a.planet}-${aspect.b.planet}-${aspect.type}`,
    kind: "synastry-aspect",
    title: `${aspect.a.planet} ${label} ${aspect.b.planet}`,
    text: ASPECT_TEXT[locale][aspect.type],
    tags: [label.toLowerCase(), aspect.a.planet.toLowerCase(), aspect.b.planet.toLowerCase()],
    score: Math.max(0, 100 - (aspect.orb ?? 0) * 10),
    related: { aspect },
  };
}

export function buildChartComparison(
  chartA: ChartResult,
  chartB: ChartResult,
  locale: SynastryLocale = "pt"
): ChartComparison {
  const aspects: ComparisonAspect[] = [];

  for (const planetA of PLANETS) {
    const lonA = getPlanetLongitude(chartA, planetA);
    for (const planetB of PLANETS) {
      const lonB = getPlanetLongitude(chartB, planetB);
      const separation = separationDegrees(lonA, lonB);
      for (const aspectDef of ASPECT_DEFS) {
        const orb = Math.abs(separation - aspectDef.angle);
        if (orb <= aspectDef.orb) {
          aspects.push({
            a: { chart: "A", planet: planetA },
            b: { chart: "B", planet: planetB },
            type: aspectDef.type,
            orb: Math.round(orb * 10) / 10,
          });
          break;
        }
      }
    }
  }

  aspects.sort((left, right) => (left.orb ?? 0) - (right.orb ?? 0));
  const highlights = aspects.map((aspect, index) => makeHighlight(aspect, index, locale));

  return {
    chartA,
    chartB,
    aspects,
    highlights,
  };
}
