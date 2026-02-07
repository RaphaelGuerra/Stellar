import { aspectSymbol, formatPairLine, type Mode } from "./aspectContext";
import {
  type ElementName,
  PLANETS,
  PLANET_SYMBOL,
  SIGN_ELEMENT,
  SIGN_SYMBOL,
} from "./constants";
import type { ChartResult, PlanetName, ZodiacSign } from "./types";

export type { ElementName } from "./constants";

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


export function buildPlacementsSummary(chart: ChartResult): PlacementSummary[] {
  const summaries: PlacementSummary[] = [];
  for (const planet of PLANETS) {
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
  for (const planet of PLANETS) {
    const placement = chart.planets[planet];
    if (!placement) continue;

    const signEntry = content.sign[placement.sign];
    const planetEntry = content.planet[planet];
    const pSym = PLANET_SYMBOL[planet];
    const sSym = SIGN_SYMBOL[placement.sign];
    const element = SIGN_ELEMENT[placement.sign];

    if (signEntry) {
      const inWord = mode === "carioca" ? "em" : "in";
      const subtitle = `${pSym} ${planet} ${inWord} ${placement.sign} ${sSym}`;
      addCard(
        `planet-sign-${planet}-${placement.sign}`,
        "planet-sign",
        signEntry.title,
        signEntry,
        {
          subtitle: planetEntry ? `${subtitle} · ${planetEntry.title}` : subtitle,
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
    const pairTitle = `${aspect.a} ${symbol} ${aspect.b}`;

    addCard(key, "aspect", pairTitle, aspectEntry, {
      subtitle: `${aspect.type} · ${aspectEntry.title}`,
      textOverride: text,
      orb: aspect.orb,
    });
    aspectCount++;
  }

  return cards;
}
