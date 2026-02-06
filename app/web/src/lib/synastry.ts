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
type LifeArea = "love" | "family" | "work" | "friends" | "money" | "communication";

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

const LIFE_AREAS: LifeArea[] = ["love", "family", "work", "friends", "money", "communication"];

const LIFE_AREA_LABELS: Record<SynastryLocale, Record<LifeArea, string>> = {
  en: {
    love: "Love",
    family: "Family",
    work: "Work",
    friends: "Friends",
    money: "Money",
    communication: "Communication",
  },
  pt: {
    love: "amor",
    family: "familia",
    work: "trampo",
    friends: "amizades",
    money: "grana",
    communication: "papo",
  },
};

const LIFE_AREA_TAGS: Record<SynastryLocale, Record<LifeArea, string>> = {
  en: {
    love: "love",
    family: "family",
    work: "work",
    friends: "friends",
    money: "money",
    communication: "communication",
  },
  pt: {
    love: "amor",
    family: "familia",
    work: "trampo",
    friends: "amizades",
    money: "grana",
    communication: "papo",
  },
};

const PLANET_AREA_WEIGHTS: Record<PlanetName, Record<LifeArea, number>> = {
  Sun: { love: 1, family: 1, work: 3, friends: 1, money: 1, communication: 1 },
  Moon: { love: 2, family: 3, work: 1, friends: 1, money: 1, communication: 1 },
  Mercury: { love: 1, family: 1, work: 2, friends: 2, money: 1, communication: 3 },
  Venus: { love: 3, family: 1, work: 1, friends: 2, money: 2, communication: 1 },
  Mars: { love: 2, family: 1, work: 3, friends: 1, money: 2, communication: 1 },
  Jupiter: { love: 1, family: 1, work: 2, friends: 2, money: 2, communication: 1 },
  Saturn: { love: 1, family: 2, work: 3, friends: 1, money: 2, communication: 1 },
  Uranus: { love: 1, family: 1, work: 2, friends: 3, money: 1, communication: 2 },
  Neptune: { love: 2, family: 2, work: 1, friends: 1, money: 1, communication: 2 },
  Pluto: { love: 2, family: 2, work: 2, friends: 1, money: 2, communication: 1 },
};

const ASPECT_CLARITY: Record<
  SynastryLocale,
  Record<AspectName, { tone: string; advice: string; tag: string }>
> = {
  en: {
    Conjunction: {
      tone: "Very strong blend of energy.",
      advice: "Set clear roles early so intensity does not become confusion.",
      tag: "intensity",
    },
    Opposition: {
      tone: "Push-pull dynamic between both sides.",
      advice: "Use explicit agreements before big decisions to avoid repeat fights.",
      tag: "push-pull",
    },
    Square: {
      tone: "Friction that can become growth.",
      advice: "Treat recurring conflict as a shared problem to solve.",
      tag: "challenge",
    },
    Trine: {
      tone: "Natural ease and flow.",
      advice: "Use this easy lane on purpose so it does not turn into complacency.",
      tag: "easy-flow",
    },
    Sextile: {
      tone: "Good potential lane.",
      advice: "It gets stronger when both people take practical action.",
      tag: "opportunity",
    },
  },
  pt: {
    Conjunction: {
      tone: "Mistura forte pra caralho.",
      advice: "Se nao combinar regra do jogo, vira bagunca.",
      tag: "intensidade",
    },
    Opposition: {
      tone: "E puxa-puxa dos dois lados.",
      advice: "Combinado claro evita treta repetida.",
      tag: "puxa-puxa",
    },
    Square: {
      tone: "Da atrito na lata.",
      advice: "Se encarar o conflito junto, vira crescimento de verdade.",
      tag: "desafio",
    },
    Trine: {
      tone: "Flui facil pra cacete.",
      advice: "Usa de proposito pra nao virar moleza.",
      tag: "fluidez",
    },
    Sextile: {
      tone: "Tem chance boa pra caralho.",
      advice: "So ganha forca com atitude no dia a dia.",
      tag: "oportunidade",
    },
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

function rankLifeAreas(aspect: ComparisonAspect): LifeArea[] {
  const weightsA = PLANET_AREA_WEIGHTS[aspect.a.planet];
  const weightsB = PLANET_AREA_WEIGHTS[aspect.b.planet];
  return [...LIFE_AREAS]
    .sort((left, right) => {
      const rightScore = (weightsA[right] ?? 0) + (weightsB[right] ?? 0);
      const leftScore = (weightsA[left] ?? 0) + (weightsB[left] ?? 0);
      return rightScore - leftScore;
    });
}

function dedupeTags(tags: string[]): string[] {
  return Array.from(new Set(tags));
}

function buildHighlightText(
  aspect: ComparisonAspect,
  areas: [LifeArea, LifeArea],
  locale: SynastryLocale
): string {
  const [firstArea, secondArea] = areas;
  const clarity = ASPECT_CLARITY[locale][aspect.type];
  const firstLabel = LIFE_AREA_LABELS[locale][firstArea];
  const secondLabel = LIFE_AREA_LABELS[locale][secondArea];

  if (locale === "en") {
    return `Main areas: ${firstLabel} and ${secondLabel}. ${clarity.tone} ${clarity.advice}`;
  }
  return `Areas mais mexidas: ${firstLabel} e ${secondLabel}. ${clarity.tone} ${clarity.advice}`;
}

function makeHighlight(
  aspect: ComparisonAspect,
  index: number,
  locale: SynastryLocale
): ComparisonHighlight {
  const rankedAreas = rankLifeAreas(aspect);
  const primaryArea = rankedAreas[0] ?? "love";
  const secondaryArea = rankedAreas[1] ?? "family";
  const areaPairLabel =
    locale === "en"
      ? `${LIFE_AREA_LABELS[locale][primaryArea]} + ${LIFE_AREA_LABELS[locale][secondaryArea]}`
      : `${LIFE_AREA_LABELS[locale][primaryArea]} + ${LIFE_AREA_LABELS[locale][secondaryArea]}`;
  const label = ASPECT_LABELS[locale][aspect.type];
  const clarity = ASPECT_CLARITY[locale][aspect.type];
  return {
    key: `synastry-${index}-${aspect.a.planet}-${aspect.b.planet}-${aspect.type}`,
    kind: "synastry-aspect",
    title: `${areaPairLabel}: ${aspect.a.planet} ${label} ${aspect.b.planet}`,
    text: buildHighlightText(aspect, [primaryArea, secondaryArea], locale),
    tags: dedupeTags([
      LIFE_AREA_TAGS[locale][primaryArea],
      LIFE_AREA_TAGS[locale][secondaryArea],
      clarity.tag,
      label.toLowerCase(),
      aspect.a.planet.toLowerCase(),
      aspect.b.planet.toLowerCase(),
    ]),
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
