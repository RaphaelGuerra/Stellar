import { aspectSymbol, formatPairLine, type Mode } from "./aspectContext";
import type { ChartResult, PlanetName } from "./types";

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
  title: string;
  subtitle?: string;
  text: string;
  tags: readonly string[];
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

export function buildCards(
  content: ContentPack,
  chart: ChartResult,
  mode: Mode
): CardModel[] {
  const cards: CardModel[] = [];
  const usedKeys = new Set<string>();

  function addCard(
    key: string,
    title: string,
    entry: Entry | undefined,
    subtitle?: string,
    textOverride?: string
  ) {
    if (!entry || usedKeys.has(key)) return;
    usedKeys.add(key);
    cards.push({
      key,
      title,
      subtitle,
      text: textOverride ?? entry.text,
      tags: entry.tags,
    });
  }

  // Add planet and sign cards for each planet
  for (const planet of PLANET_NAMES) {
    const placement = chart.planets[planet];
    if (!placement) continue;

    const planetEntry = content.planet[planet];
    const signEntry = content.sign[placement.sign];

    // Add planet card
    if (planetEntry) {
      addCard(
        `planet-${planet}`,
        `${planet} - ${planetEntry.title}`,
        planetEntry
      );
    }

    // Add sign card for this planet
    if (signEntry) {
      addCard(
        `planet-sign-${planet}-${placement.sign}`,
        `${planet} em ${placement.sign} - ${signEntry.title}`,
        signEntry
      );
    }
  }

  // Add aspect cards (limit to 6)
  let aspectCount = 0;
  for (const aspect of chart.aspects) {
    if (aspectCount >= 6) break;

    const aspectEntry = content.aspect[aspect.type];
    if (!aspectEntry) continue;

    const key = `aspect-${aspect.a}-${aspect.b}-${aspect.type}`;
    if (usedKeys.has(key)) continue;

    const symbol = aspectSymbol(aspect.type);
    const pairLine = formatPairLine(aspect.a, aspect.b, aspect.type, mode);
    const text = `${aspectEntry.text}\n\n${pairLine}`;

    addCard(
      key,
      aspectEntry.title,
      aspectEntry,
      `${aspect.a} ${symbol} ${aspect.b}`,
      text
    );
    aspectCount++;
  }

  return cards;
}
