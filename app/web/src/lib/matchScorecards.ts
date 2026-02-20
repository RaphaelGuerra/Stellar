import { ASPECT_SYMBOL } from "./constants";
import type {
  AspectName,
  ChartComparison,
  ComparisonAspect,
  DuoMode,
  LifeArea,
  MatchScorecard,
  PlanetName,
  ZodiacSign,
} from "./types";

type SynastryLocale = "en" | "pt";

type ScoreAccumulator = {
  total: number;
  maxMagnitude: number;
  supportHits: number;
  tensionHits: number;
  best: { score: number; label: string; summaryLabel: string } | null;
  worst: { score: number; label: string; summaryLabel: string } | null;
  complementary: { score: number; label: string } | null;
};

type AreaLabelSet = {
  love: string;
  friends: string;
  family: string;
};

const AREAS: LifeArea[] = ["love", "friends", "family"];

const AREA_WEIGHTS: Record<LifeArea, Record<string, number>> = {
  love: {
    Sun: 1,
    Moon: 2,
    Mercury: 1,
    Venus: 3,
    Mars: 3,
    Jupiter: 1,
    Saturn: 1,
    Uranus: 1,
    Neptune: 2,
    Pluto: 2,
  },
  friends: {
    Sun: 1,
    Moon: 1,
    Mercury: 3,
    Venus: 2,
    Mars: 1,
    Jupiter: 2,
    Saturn: 1,
    Uranus: 3,
    Neptune: 1,
    Pluto: 1,
  },
  family: {
    Sun: 1,
    Moon: 3,
    Mercury: 1,
    Venus: 1,
    Mars: 1,
    Jupiter: 1,
    Saturn: 3,
    Uranus: 1,
    Neptune: 2,
    Pluto: 2,
  },
};

const ASPECT_BASE_IMPACT: Partial<Record<AspectName, number>> = {
  Trine: 1,
  Sextile: 0.8,
  Conjunction: 0.4,
  Opposition: -0.55,
  Square: -0.8,
  Quintile: 0.55,
  Biquintile: 0.5,
  Semisextile: 0.35,
  Quincunx: -0.25,
  Semisquare: -0.45,
  Sesquiquadrate: -0.5,
};

const ASPECT_ORB_CAP: Partial<Record<AspectName, number>> = {
  Conjunction: 8,
  Opposition: 8,
  Square: 6,
  Trine: 6,
  Sextile: 4,
  Quincunx: 3,
  Semisextile: 2,
  Semisquare: 2,
  Sesquiquadrate: 2,
  Quintile: 2,
  Biquintile: 2,
};

const AREA_LABELS: Record<SynastryLocale, { romantic: AreaLabelSet; friend: AreaLabelSet }> = {
  en: {
    romantic: {
      love: "Love",
      friends: "Friendship",
      family: "Family",
    },
    friend: {
      love: "Bond",
      friends: "Friendship",
      family: "Family",
    },
  },
  pt: {
    romantic: {
      love: "Amor",
      friends: "Amizade",
      family: "Familia",
    },
    friend: {
      love: "Vibe",
      friends: "Amizade",
      family: "Familia",
    },
  },
};

const PLANET_LABELS: Record<SynastryLocale, Record<PlanetName, string>> = {
  en: {
    Sun: "Sun",
    Moon: "Moon",
    Mercury: "Mercury",
    Venus: "Venus",
    Mars: "Mars",
    Jupiter: "Jupiter",
    Saturn: "Saturn",
    Uranus: "Uranus",
    Neptune: "Neptune",
    Pluto: "Pluto",
  },
  pt: {
    Sun: "Sol",
    Moon: "Lua",
    Mercury: "Mercurio",
    Venus: "Venus",
    Mars: "Marte",
    Jupiter: "Jupiter",
    Saturn: "Saturno",
    Uranus: "Urano",
    Neptune: "Netuno",
    Pluto: "Plutao",
  },
};

const SIGN_LABELS: Record<SynastryLocale, Record<ZodiacSign, string>> = {
  en: {
    Aries: "Aries",
    Taurus: "Taurus",
    Gemini: "Gemini",
    Cancer: "Cancer",
    Leo: "Leo",
    Virgo: "Virgo",
    Libra: "Libra",
    Scorpio: "Scorpio",
    Sagittarius: "Sagittarius",
    Capricorn: "Capricorn",
    Aquarius: "Aquarius",
    Pisces: "Pisces",
  },
  pt: {
    Aries: "Aries",
    Taurus: "Touro",
    Gemini: "Gemeos",
    Cancer: "Cancer",
    Leo: "Leao",
    Virgo: "Virgem",
    Libra: "Libra",
    Scorpio: "Escorpiao",
    Sagittarius: "Sagitario",
    Capricorn: "Capricornio",
    Aquarius: "Aquario",
    Pisces: "Peixes",
  },
};

const OPPOSITE_SIGNS: Record<ZodiacSign, ZodiacSign> = {
  Aries: "Libra",
  Taurus: "Scorpio",
  Gemini: "Sagittarius",
  Cancer: "Capricorn",
  Leo: "Aquarius",
  Virgo: "Pisces",
  Libra: "Aries",
  Scorpio: "Taurus",
  Sagittarius: "Gemini",
  Capricorn: "Cancer",
  Aquarius: "Leo",
  Pisces: "Virgo",
};

const PERSONAL_PLANETS = new Set<PlanetName>(["Sun", "Moon", "Mercury", "Venus", "Mars"]);

const COMPLEMENTARY_OPPOSITION_TUNING = {
  base: 0.25,
  samePlanet: 0.5,
  personalPair: 0.2,
  orbTiers: [
    { maxOrb: 1.0, bonus: 0.28 },
    { maxOrb: 2.2, bonus: 0.16 },
    { maxOrb: 4.0, bonus: 0.08 },
  ],
} as const;

const ASPECT_LABELS: Record<SynastryLocale, Partial<Record<AspectName, string>>> = {
  en: {
    Conjunction: "Conjunction",
    Opposition: "Opposition",
    Square: "Square",
    Trine: "Trine",
    Sextile: "Sextile",
    Quincunx: "Quincunx",
    Semisextile: "Semisextile",
    Semisquare: "Semisquare",
    Sesquiquadrate: "Sesquiquadrate",
    Quintile: "Quintile",
    Biquintile: "Biquintile",
  },
  pt: {
    Conjunction: "Conjuncao",
    Opposition: "Oposicao",
    Square: "Quadratura",
    Trine: "Trigono",
    Sextile: "Sextil",
    Quincunx: "Quincuncio",
    Semisextile: "Semisextil",
    Semisquare: "Semiquadratura",
    Sesquiquadrate: "Sesquiquadratura",
    Quintile: "Quintil",
    Biquintile: "Biquintil",
  },
};

function getAspectBaseImpact(type: AspectName): number {
  return ASPECT_BASE_IMPACT[type] ?? 0.2;
}

function getAspectOrbCap(type: AspectName): number {
  return ASPECT_ORB_CAP[type] ?? 2;
}

function getAspectLabel(locale: SynastryLocale, type: AspectName): string {
  return ASPECT_LABELS[locale][type] ?? type;
}

function getPlanetLabel(locale: SynastryLocale, planet: PlanetName): string {
  return PLANET_LABELS[locale][planet] ?? planet;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getAreaLabels(locale: SynastryLocale, duoMode: DuoMode): AreaLabelSet {
  return AREA_LABELS[locale][duoMode === "friend" ? "friend" : "romantic"];
}

function buildStatus(score: number): MatchScorecard["status"] {
  if (score >= 67) return "good";
  if (score <= 39) return "bad";
  return "mixed";
}

function buildSummary(
  status: MatchScorecard["status"],
  areaLabel: string,
  locale: SynastryLocale,
  context: {
    bestLabel?: string;
    worstLabel?: string;
    supportHits: number;
    tensionHits: number;
    complementaryLabel?: string;
    solarGlobalBonus?: number;
    solarLabel?: string;
  }
): string {
  const solarBonusText =
    context.solarGlobalBonus && context.solarGlobalBonus > 0
      ? locale === "pt"
        ? `Bonus solar global (+${context.solarGlobalBonus}) aplicado por ${context.solarLabel ?? "Sol x Sol"}.`
        : `Global Sun bonus (+${context.solarGlobalBonus}) applied from ${context.solarLabel ?? "Sun x Sun"}.`
      : "";
  const balanceLabel =
    context.supportHits > context.tensionHits
      ? locale === "pt"
        ? "apoio acima da tensao"
        : "support above tension"
      : context.tensionHits > context.supportHits
        ? locale === "pt"
          ? "tensao acima do apoio"
          : "tension above support"
        : locale === "pt"
          ? "equilibrio entre apoio e atrito"
          : "balanced support and friction";

  if (locale === "pt") {
    if (context.complementaryLabel) {
      const trail =
        status === "good"
          ? "Match forte com conexao profunda quando os dois atuam no mesmo time."
          : status === "bad"
            ? "Conexao forte existe, mas precisa combinado claro pra nao virar disputa de ego."
            : "Tem intensidade positiva, desde que role alinhamento pratico no dia a dia.";
      return `${areaLabel}: opostos complementares ativados em ${context.complementaryLabel}. ${trail} ${solarBonusText}`.trim();
    }

    const best = context.bestLabel ? `Forca: ${context.bestLabel}. ` : "";
    const worst = context.worstLabel ? `Ponto de atrito: ${context.worstLabel}. ` : "";
    if (status === "good") {
      return `${areaLabel}: fase boa com ${balanceLabel}. ${best}${worst}${solarBonusText}`.trim();
    }
    if (status === "bad") {
      return `${areaLabel}: fase sensivel com ${balanceLabel}. ${best}${worst}${solarBonusText}`.trim();
    }
    return `${areaLabel}: leitura mista com ${balanceLabel}. ${best}${worst}${solarBonusText}`.trim();
  }

  if (context.complementaryLabel) {
    const trail =
      status === "good"
        ? "Strong match with deep and productive bond potential."
        : status === "bad"
          ? "Strong pull is present, but boundaries are required to avoid conflict loops."
          : "There is high voltage chemistry when both people align on practical choices.";
    return `${areaLabel}: complementary opposites active in ${context.complementaryLabel}. ${trail} ${solarBonusText}`.trim();
  }

  const best = context.bestLabel ? `Strength: ${context.bestLabel}. ` : "";
  const worst = context.worstLabel ? `Friction: ${context.worstLabel}. ` : "";
  if (status === "good") {
    return `${areaLabel}: strong flow with ${balanceLabel}. ${best}${worst}${solarBonusText}`.trim();
  }
  if (status === "bad") {
    return `${areaLabel}: tension-heavy phase with ${balanceLabel}. ${best}${worst}${solarBonusText}`.trim();
  }
  return `${areaLabel}: mixed signal with ${balanceLabel}. ${best}${worst}${solarBonusText}`.trim();
}

function buildAspectLabel(
  input: {
    aPlanet: PlanetName;
    bPlanet: PlanetName;
    type: AspectName;
    orb?: number;
  },
  locale: SynastryLocale
): string {
  const symbol = ASPECT_SYMBOL[input.type] ?? "";
  const label = getAspectLabel(locale, input.type);
  const planetA = getPlanetLabel(locale, input.aPlanet);
  const planetB = getPlanetLabel(locale, input.bPlanet);
  const orbText =
    typeof input.orb === "number"
      ? locale === "pt"
        ? `orb ${input.orb.toFixed(1)}deg`
        : `orb ${input.orb.toFixed(1)}deg`
      : locale === "pt"
        ? "orb n/a"
        : "orb n/a";
  return `${planetA} ${symbol} ${planetB} (${label}, ${orbText})`;
}

function buildAspectSummaryLabel(
  input: {
    aPlanet: PlanetName;
    bPlanet: PlanetName;
    type: AspectName;
  },
  locale: SynastryLocale
): string {
  return `${getPlanetLabel(locale, input.aPlanet)} ${getAspectLabel(locale, input.type)} ${getPlanetLabel(
    locale,
    input.bPlanet
  )}`;
}

function isComplementaryOpposition(aspect: ComparisonAspect, comparison: ChartComparison): boolean {
  if (aspect.type !== "Opposition") return false;
  const signA = comparison.chartA.planets[aspect.a.planet]?.sign;
  const signB = comparison.chartB.planets[aspect.b.planet]?.sign;
  if (!signA || !signB) return false;
  return OPPOSITE_SIGNS[signA] === signB;
}

function buildComplementaryLabel(
  aspect: ComparisonAspect,
  comparison: ChartComparison,
  locale: SynastryLocale
): string {
  const signA = comparison.chartA.planets[aspect.a.planet]?.sign;
  const signB = comparison.chartB.planets[aspect.b.planet]?.sign;
  const signLabelA = signA ? SIGN_LABELS[locale][signA] : "?";
  const signLabelB = signB ? SIGN_LABELS[locale][signB] : "?";
  const planetA = getPlanetLabel(locale, aspect.a.planet);
  const planetB = getPlanetLabel(locale, aspect.b.planet);
  return `${planetA} em ${signLabelA} x ${planetB} em ${signLabelB}`;
}

function getComplementaryOppositionBoost(aspect: ComparisonAspect, comparison: ChartComparison): number {
  if (!isComplementaryOpposition(aspect, comparison)) return 0;

  let boost = COMPLEMENTARY_OPPOSITION_TUNING.base;
  if (aspect.a.planet === aspect.b.planet) boost += COMPLEMENTARY_OPPOSITION_TUNING.samePlanet;
  if (PERSONAL_PLANETS.has(aspect.a.planet) && PERSONAL_PLANETS.has(aspect.b.planet)) {
    boost += COMPLEMENTARY_OPPOSITION_TUNING.personalPair;
  }

  const orb = aspect.orb ?? getAspectOrbCap(aspect.type);
  for (const tier of COMPLEMENTARY_OPPOSITION_TUNING.orbTiers) {
    if (orb <= tier.maxOrb) {
      boost += tier.bonus;
      break;
    }
  }

  return boost;
}

function initAccumulator(): ScoreAccumulator {
  return {
    total: 0,
    maxMagnitude: 0,
    supportHits: 0,
    tensionHits: 0,
    best: null,
    worst: null,
    complementary: null,
  };
}

export function buildMatchScorecards(
  comparison: ChartComparison,
  locale: SynastryLocale,
  duoMode: DuoMode
): MatchScorecard[] {
  const labels = getAreaLabels(locale, duoMode);
  const sunGlobalBonus = comparison.sunComparison.globalBonus ?? 0;
  const solarLabel = comparison.sunComparison.label;

  const areaCards = AREAS.map((area) => {
    const acc = initAccumulator();

    for (const aspect of comparison.aspects ?? []) {
      const weightA = AREA_WEIGHTS[area][aspect.a.planet] ?? 0;
      const weightB = AREA_WEIGHTS[area][aspect.b.planet] ?? 0;
      const pairWeight = weightA + weightB;
      if (pairWeight <= 0) continue;

      const complementaryBoost = getComplementaryOppositionBoost(aspect, comparison);
      const baseImpact = getAspectBaseImpact(aspect.type) + complementaryBoost;
      const orbCap = getAspectOrbCap(aspect.type);
      const orb = aspect.orb ?? orbCap;
      const orbFactor = Math.max(0.15, 1 - orb / orbCap);
      const weightedImpact = baseImpact * pairWeight * orbFactor;

      acc.total += weightedImpact;
      acc.maxMagnitude += pairWeight;
      if (weightedImpact > 0) acc.supportHits += 1;
      if (weightedImpact < 0) acc.tensionHits += 1;

      const lineLabel = buildAspectLabel(
        {
          aPlanet: aspect.a.planet,
          bPlanet: aspect.b.planet,
          type: aspect.type,
          orb: aspect.orb,
        },
        locale
      );
      const summaryLabel = buildAspectSummaryLabel(
        {
          aPlanet: aspect.a.planet,
          bPlanet: aspect.b.planet,
          type: aspect.type,
        },
        locale
      );

      if (weightedImpact > 0 && (!acc.best || weightedImpact > acc.best.score)) {
        acc.best = { score: weightedImpact, label: lineLabel, summaryLabel };
      }
      if (weightedImpact < 0 && (!acc.worst || weightedImpact < acc.worst.score)) {
        acc.worst = { score: weightedImpact, label: lineLabel, summaryLabel };
      }

      if (complementaryBoost > 0) {
        const complementaryScore = complementaryBoost * pairWeight * orbFactor;
        if (!acc.complementary || complementaryScore > acc.complementary.score) {
          acc.complementary = {
            score: complementaryScore,
            label: buildComplementaryLabel(aspect, comparison, locale),
          };
        }
      }
    }

    const normalized = acc.maxMagnitude > 0 ? 50 + (acc.total / acc.maxMagnitude) * 50 : 50;
    const score = clampPercent(normalized + sunGlobalBonus);
    const status = buildStatus(score);
    const areaLabel = labels[area];

    return {
      area,
      score,
      status,
      summary: buildSummary(status, areaLabel, locale, {
        bestLabel: acc.best?.summaryLabel,
        worstLabel: acc.worst?.summaryLabel,
        supportHits: acc.supportHits,
        tensionHits: acc.tensionHits,
        complementaryLabel: acc.complementary?.label,
        solarGlobalBonus: sunGlobalBonus,
        solarLabel,
      }),
      topSupportAspect: acc.best?.label,
      topTensionAspect: acc.worst?.label,
    };
  });

  const sunCard: MatchScorecard = {
    area: "sun",
    score: comparison.sunComparison.score,
    status: comparison.sunComparison.status,
    summary: comparison.sunComparison.summary,
    topSupportAspect: comparison.sunComparison.label,
    topTensionAspect: undefined,
  };

  return [...areaCards, sunCard];
}
