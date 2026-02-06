import { aspectSymbol, formatPairLine, type Mode } from "./aspectContext";
import type { ChartResult, PlanetName, ZodiacSign } from "./types";

export type CardCategory = "planet" | "sign" | "planet-sign" | "aspect";

export interface Entry {
  title: string;
  text: string;
  tags: readonly string[];
}

export interface ContentPack {
  sign: Record<string, Entry>;
  house: Record<string, Entry>;
  planet: Record<string, Entry>;
  aspect: Record<string, Entry>;
}

export type ElementName = "fire" | "earth" | "air" | "water";

export interface CardModel {
  key: string;
  category: CardCategory;
  title: string;
  subtitle?: string;
  text: string;
  tags: readonly string[];
  planet?: PlanetName;
  sign?: ZodiacSign;
  element?: ElementName;
  degree?: number;
  planetSymbol?: string;
  signSymbol?: string;
  orb?: number;
}

export interface PlacementSummary {
  planet: PlanetName;
  sign: ZodiacSign;
  degree?: number;
  planetSymbol: string;
  signSymbol: string;
  element: ElementName;
}

/* ===== Symbol & Element Maps ===== */

export const PLANET_SYMBOL: Record<PlanetName, string> = {
  Sun: "\u2609",
  Moon: "\u263D",
  Mercury: "\u263F",
  Venus: "\u2640",
  Mars: "\u2642",
  Jupiter: "\u2643",
  Saturn: "\u2644",
  Uranus: "\u2645",
  Neptune: "\u2646",
  Pluto: "\u2647",
};

export const SIGN_SYMBOL: Record<ZodiacSign, string> = {
  Aries: "\u2648",
  Taurus: "\u2649",
  Gemini: "\u264A",
  Cancer: "\u264B",
  Leo: "\u264C",
  Virgo: "\u264D",
  Libra: "\u264E",
  Scorpio: "\u264F",
  Sagittarius: "\u2650",
  Capricorn: "\u2651",
  Aquarius: "\u2652",
  Pisces: "\u2653",
};

export const SIGN_ELEMENT: Record<ZodiacSign, ElementName> = {
  Aries: "fire",
  Taurus: "earth",
  Gemini: "air",
  Cancer: "water",
  Leo: "fire",
  Virgo: "earth",
  Libra: "air",
  Scorpio: "water",
  Sagittarius: "fire",
  Capricorn: "earth",
  Aquarius: "air",
  Pisces: "water",
};

export function getElement(sign: ZodiacSign): ElementName {
  return SIGN_ELEMENT[sign];
}

export function getPlanetSymbol(planet: PlanetName): string {
  return PLANET_SYMBOL[planet];
}

export function getSignSymbol(sign: ZodiacSign): string {
  return SIGN_SYMBOL[sign];
}

const PLANET_NAMES: PlanetName[] = [
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

export function buildPlacementsSummary(chart: ChartResult): PlacementSummary[] {
  const summaries: PlacementSummary[] = [];
  for (const planet of PLANET_NAMES) {
    const placement = chart.planets[planet];
    if (!placement) continue;
    summaries.push({
      planet,
      sign: placement.sign,
      degree: placement.degree,
      planetSymbol: PLANET_SYMBOL[planet],
      signSymbol: SIGN_SYMBOL[placement.sign],
      element: SIGN_ELEMENT[placement.sign],
    });
  }
  return summaries;
}

export function buildCards(
  content: ContentPack,
  chart: ChartResult,
  mode: Mode
): CardModel[] {
  const cards: CardModel[] = [];
  const usedKeys = new Set<string>();

  function addCard(
    key: string,
    category: CardCategory,
    title: string,
    entry: Entry | undefined,
    options?: {
      subtitle?: string;
      textOverride?: string;
      planet?: PlanetName;
      sign?: ZodiacSign;
      element?: ElementName;
      degree?: number;
      planetSymbol?: string;
      signSymbol?: string;
      orb?: number;
    }
  ) {
    if (!entry || usedKeys.has(key)) return;
    usedKeys.add(key);
    cards.push({
      key,
      category,
      title,
      subtitle: options?.subtitle,
      text: options?.textOverride ?? entry.text,
      tags: entry.tags,
      planet: options?.planet,
      sign: options?.sign,
      element: options?.element,
      degree: options?.degree,
      planetSymbol: options?.planetSymbol,
      signSymbol: options?.signSymbol,
      orb: options?.orb,
    });
  }

  // Add planet-sign cards for each planet
  for (const planet of PLANET_NAMES) {
    const placement = chart.planets[planet];
    if (!placement) continue;

    const signEntry = content.sign[placement.sign];
    const pSym = PLANET_SYMBOL[planet];
    const sSym = SIGN_SYMBOL[placement.sign];
    const element = SIGN_ELEMENT[placement.sign];

    // Add sign card for this planet (with astrological symbols in title)
    if (signEntry) {
      const inWord = mode === "carioca" ? "em" : "in";
      const title = `${pSym} ${planet} ${inWord} ${placement.sign} ${sSym} - ${signEntry.title}`;
      addCard(
        `planet-sign-${planet}-${placement.sign}`,
        "planet-sign",
        title,
        signEntry,
        {
          planet,
          sign: placement.sign,
          element,
          degree: placement.degree,
          planetSymbol: pSym,
          signSymbol: sSym,
        }
      );
    }
  }

  // Add aspect cards (limit to 12)
  let aspectCount = 0;
  for (const aspect of chart.aspects) {
    if (aspectCount >= 12) break;

    const aspectEntry = content.aspect[aspect.type];
    if (!aspectEntry) continue;

    const key = `aspect-${aspect.a}-${aspect.b}-${aspect.type}`;
    if (usedKeys.has(key)) continue;

    const symbol = aspectSymbol(aspect.type);
    const pairLine = formatPairLine(aspect.a, aspect.b, aspect.type, mode);
    const text = `${aspectEntry.text}\n\n${pairLine}`;

    addCard(key, "aspect", aspectEntry.title, aspectEntry, {
      subtitle: `${aspect.a} ${symbol} ${aspect.b}`,
      textOverride: text,
      orb: aspect.orb,
    });
    aspectCount++;
  }

  return cards;
}
