import { SIGN_INDEX, normalizeAngle } from "./constants";
import type { ChartResult, SunComparison, SunRelationKind, ZodiacSign } from "./types";

export type SunComparisonLocale = "pt" | "en";

const SIGN_LABELS: Record<SunComparisonLocale, Record<ZodiacSign, string>> = {
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

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatDeg(value: number): string {
  return `${value.toFixed(1)}deg`;
}

function buildStatus(score: number): SunComparison["status"] {
  if (score >= 67) return "good";
  if (score <= 39) return "bad";
  return "mixed";
}

function toSunLongitude(chart: ChartResult): number {
  const sun = chart.planets.Sun;
  const explicitLongitude = sun.longitude;
  if (typeof explicitLongitude === "number" && Number.isFinite(explicitLongitude)) {
    return normalizeAngle(explicitLongitude);
  }
  const signOffset = (SIGN_INDEX[sun.sign] ?? 0) * 30;
  return normalizeAngle(signOffset + (sun.degree ?? 0));
}

function separationDegrees(a: number, b: number): number {
  const delta = Math.abs(a - b);
  return delta > 180 ? 360 - delta : delta;
}

function getSignDistance(signA: ZodiacSign, signB: ZodiacSign): number {
  const idxA = SIGN_INDEX[signA] ?? 0;
  const idxB = SIGN_INDEX[signB] ?? 0;
  const forward = (idxB - idxA + 12) % 12;
  return Math.min(forward, 12 - forward);
}

function getRelation(signDistance: number): SunRelationKind {
  if (signDistance === 6) return "complementary-opposites";
  if (signDistance === 0) return "same-sign";
  if (signDistance === 2 || signDistance === 4) return "supportive";
  return "neutral";
}

function getLabel(chartA: ChartResult, chartB: ChartResult, locale: SunComparisonLocale): string {
  const signA = SIGN_LABELS[locale][chartA.planets.Sun.sign] ?? chartA.planets.Sun.sign;
  const signB = SIGN_LABELS[locale][chartB.planets.Sun.sign] ?? chartB.planets.Sun.sign;
  if (locale === "pt") {
    return `Sol em ${signA} x Sol em ${signB}`;
  }
  return `Sun in ${signA} x Sun in ${signB}`;
}

function getSummary(
  locale: SunComparisonLocale,
  relation: SunRelationKind,
  label: string,
  globalBonus: number,
  separation: number,
  score: number
): string {
  const separationLabel = formatDeg(separation);
  if (locale === "pt") {
    if (relation === "complementary-opposites") {
      return `${label}: opostos complementares ativos, vibe yin-yang total. Voces se completam no mapa do Sol, iluminando o ser de cada um. Angulo solar ${separationLabel} e score ${score}/100. Bonus global +${globalBonus}.`;
    }
    if (relation === "same-sign") {
      return `${label}: mesma assinatura solar, com identidade parecida e ritmo interno no mesmo compasso. Angulo solar ${separationLabel} e score ${score}/100. Flui facil, so evita competir por protagonismo o tempo todo.`;
    }
    if (relation === "supportive") {
      return `${label}: compatibilidade solar de apoio, com boa leitura de direcao e parceria no dia a dia. Angulo solar ${separationLabel} e score ${score}/100.`;
    }
    return `${label}: dinamica solar neutra, sem drama e com espaco pra alinhamento consciente. Angulo solar ${separationLabel} e score ${score}/100.`;
  }

  if (relation === "complementary-opposites") {
    return `${label}: complementary opposites are active; both complete each other in the Sun map, illuminating each person's whole being. Sun angle ${separationLabel} and score ${score}/100. Global bonus +${globalBonus}.`;
  }
  if (relation === "same-sign") {
    return `${label}: same-sign Suns with a familiar identity style and similar inner pace. Sun angle ${separationLabel} and score ${score}/100.`;
  }
  if (relation === "supportive") {
    return `${label}: supportive Sun connection, favoring cooperation and aligned direction. Sun angle ${separationLabel} and score ${score}/100.`;
  }
  return `${label}: neutral Sun dynamic, with room for conscious alignment in daily choices. Sun angle ${separationLabel} and score ${score}/100.`;
}

export function buildSunComparison(
  chartA: ChartResult,
  chartB: ChartResult,
  locale: SunComparisonLocale
): SunComparison {
  const sunA = chartA.planets.Sun;
  const sunB = chartB.planets.Sun;
  const distance = getSignDistance(sunA.sign, sunB.sign);
  const relation = getRelation(distance);
  const longitudeA = toSunLongitude(chartA);
  const longitudeB = toSunLongitude(chartB);
  const separation = separationDegrees(longitudeA, longitudeB);

  const relationBonus =
    relation === "complementary-opposites"
      ? 25
      : relation === "same-sign"
        ? 14
        : relation === "supportive"
          ? 8
          : 0;

  const resonance =
    relation === "complementary-opposites"
      ? Math.max(0, 10 - Math.abs(separation - 180) / 3)
      : relation === "same-sign"
        ? Math.max(0, 8 - separation / 2.5)
        : 0;

  const score = clampScore(55 + relationBonus + resonance);
  const oppositeExtra = Math.abs(separation - 180) <= 8 ? 3 : 0;
  const globalBonus = relation === "complementary-opposites" ? Math.min(15, 12 + oppositeExtra) : 0;
  const label = getLabel(chartA, chartB, locale);

  return {
    label,
    relation,
    score,
    status: buildStatus(score),
    summary: getSummary(locale, relation, label, globalBonus, separation, score),
    globalBonus,
  };
}
