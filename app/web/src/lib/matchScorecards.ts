import { ASPECT_SYMBOL } from "./constants";
import type {
  AspectName,
  ChartComparison,
  DuoMode,
  LifeArea,
  MatchScorecard,
} from "./types";

type SynastryLocale = "en" | "pt";

type ScoreAccumulator = {
  total: number;
  maxMagnitude: number;
  best: { score: number; label: string } | null;
  worst: { score: number; label: string } | null;
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
  locale: SynastryLocale
): string {
  if (locale === "pt") {
    if (status === "good") {
      return `${areaLabel}: fase boa, com apoio forte nos aspectos principais.`;
    }
    if (status === "bad") {
      return `${areaLabel}: ponto sensivel agora, pede ajuste pratico e conversa direta.`;
    }
    return `${areaLabel}: mistura de apoio e atrito; funciona melhor com alinhamento claro.`;
  }

  if (status === "good") {
    return `${areaLabel}: strong flow with supportive aspects leading the dynamic.`;
  }
  if (status === "bad") {
    return `${areaLabel}: tension is dominant, so this area needs active repair.`;
  }
  return `${areaLabel}: mixed signal, with both support and friction in play.`;
}

function buildAspectLabel(
  input: {
    aPlanet: string;
    bPlanet: string;
    type: AspectName;
    orb?: number;
  },
  locale: SynastryLocale
): string {
  const symbol = ASPECT_SYMBOL[input.type] ?? "";
  const label = getAspectLabel(locale, input.type);
  const orbText =
    typeof input.orb === "number"
      ? locale === "pt"
        ? `orb ${input.orb.toFixed(1)}deg`
        : `orb ${input.orb.toFixed(1)}deg`
      : locale === "pt"
        ? "orb n/a"
        : "orb n/a";
  return `${input.aPlanet} ${symbol} ${input.bPlanet} (${label}, ${orbText})`;
}

function initAccumulator(): ScoreAccumulator {
  return {
    total: 0,
    maxMagnitude: 0,
    best: null,
    worst: null,
  };
}

export function buildMatchScorecards(
  comparison: ChartComparison,
  locale: SynastryLocale,
  duoMode: DuoMode
): MatchScorecard[] {
  const labels = getAreaLabels(locale, duoMode);

  return AREAS.map((area) => {
    const acc = initAccumulator();

    for (const aspect of comparison.aspects ?? []) {
      const weightA = AREA_WEIGHTS[area][aspect.a.planet] ?? 0;
      const weightB = AREA_WEIGHTS[area][aspect.b.planet] ?? 0;
      const pairWeight = weightA + weightB;
      if (pairWeight <= 0) continue;

      const baseImpact = getAspectBaseImpact(aspect.type);
      const orbCap = getAspectOrbCap(aspect.type);
      const orb = aspect.orb ?? orbCap;
      const orbFactor = Math.max(0.15, 1 - orb / orbCap);
      const weightedImpact = baseImpact * pairWeight * orbFactor;

      acc.total += weightedImpact;
      acc.maxMagnitude += pairWeight;

      const lineLabel = buildAspectLabel(
        {
          aPlanet: aspect.a.planet,
          bPlanet: aspect.b.planet,
          type: aspect.type,
          orb: aspect.orb,
        },
        locale
      );

      if (weightedImpact > 0 && (!acc.best || weightedImpact > acc.best.score)) {
        acc.best = { score: weightedImpact, label: lineLabel };
      }
      if (weightedImpact < 0 && (!acc.worst || weightedImpact < acc.worst.score)) {
        acc.worst = { score: weightedImpact, label: lineLabel };
      }
    }

    const normalized =
      acc.maxMagnitude > 0 ? clampPercent(50 + (acc.total / acc.maxMagnitude) * 50) : 50;
    const status = buildStatus(normalized);
    const areaLabel = labels[area];

    return {
      area,
      score: normalized,
      status,
      summary: buildSummary(status, areaLabel, locale),
      topSupportAspect: acc.best?.label,
      topTensionAspect: acc.worst?.label,
    };
  });
}
