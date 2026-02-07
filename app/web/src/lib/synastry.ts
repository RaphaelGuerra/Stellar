import {
  ASPECT_DEFS,
  ASPECT_SYMBOL,
  PLANETS,
  PLANET_SYMBOL,
  SIGN_INDEX,
  normalizeAngle,
} from "./constants";
import type {
  AspectName,
  AspectTone,
  ChartComparison,
  ChartResult,
  ComparisonAspect,
  ComparisonHighlight,
  PlanetName,
} from "./types";

export type SynastryLocale = "pt" | "en";
type LifeArea = "love" | "family" | "work" | "friends" | "money" | "communication";

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

function getAspectTone(type: AspectName): AspectTone {
  switch (type) {
    case "Trine":
    case "Sextile":
      return "harmonious";
    case "Square":
    case "Opposition":
      return "challenging";
    case "Conjunction":
      return "intense";
  }
}


const SYNASTRY_TITLES: Record<
  SynastryLocale,
  Record<LifeArea, Record<AspectTone, string[]>>
> = {
  en: {
    love: {
      harmonious: ["Love on Cruise Control", "Heart's Green Light"],
      challenging: ["Love Under Fire", "Heart's Boot Camp"],
      intense: ["Love at Full Volume", "Heart Lockdown"],
    },
    family: {
      harmonious: ["Home Sweet Match", "Roots in Sync"],
      challenging: ["Holiday Dinner Energy", "Family Tug of War"],
      intense: ["Blood Bond", "Deep Roots"],
    },
    work: {
      harmonious: ["Dream Team Energy", "The Easy Hustle"],
      challenging: ["Office Friction", "The Ambition Clash"],
      intense: ["Power Merger", "Workaholic Chemistry"],
    },
    friends: {
      harmonious: ["Best Friend Material", "Squad Goals"],
      challenging: ["Frenemies Potential", "Friends Who Push"],
      intense: ["Ride or Die Energy", "Instant Connection"],
    },
    money: {
      harmonious: ["Financial Sync", "The Golden Match"],
      challenging: ["Budget Wars", "The Resource Tug"],
      intense: ["High Stakes Bond", "All-In Investment"],
    },
    communication: {
      harmonious: ["Same Wavelength", "The Easy Chat"],
      challenging: ["Lost in Translation", "The Debate Club"],
      intense: ["Mind Meld", "Words Hit Different"],
    },
  },
  pt: {
    love: {
      harmonious: ["Amor no Sapatinho", "Coracao no Modo Facil"],
      challenging: ["Amor que Da Trabalho", "Coracao na Porrada"],
      intense: ["Amor Bomba Atomica", "Pegacao Cosmica"],
    },
    family: {
      harmonious: ["Lar Doce Match", "Raiz Alinhada"],
      challenging: ["Ceia de Natal Astral", "Familia na Treta"],
      intense: ["Laco de Sangue", "DNA Cosmico"],
    },
    work: {
      harmonious: ["Trampo que Flui", "Dupla de Ouro"],
      challenging: ["Escritorio em Chamas", "Ambicao vs Ambicao"],
      intense: ["Fusao de Potencia", "Parceria Atomica"],
    },
    friends: {
      harmonious: ["Amizade no Sapatinho", "Sintonia de Cria"],
      challenging: ["Quase Inimigo, Quase Irmao", "Cria que Cutuca"],
      intense: ["Parceiro de Trincheira", "Cola Cosmica"],
    },
    money: {
      harmonious: ["Grana no Flow", "Bolso em Sintonia"],
      challenging: ["Guerra de Bolso", "Grana na Treta"],
      intense: ["Aposta Alta", "Grana Tudo ou Nada"],
    },
    communication: {
      harmonious: ["Mesma Frequencia", "Papo que Flui"],
      challenging: ["Papo Desencontrado", "Dialogo de Surdo"],
      intense: ["Telepatia Bruta", "Papo que Arrepia"],
    },
  },
};

function pickSynastryTitle(
  area: LifeArea,
  tone: AspectTone,
  index: number,
  locale: SynastryLocale
): string {
  const options = SYNASTRY_TITLES[locale][area][tone];
  return options[index % options.length];
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
  const tone = getAspectTone(aspect.type);
  const label = ASPECT_LABELS[locale][aspect.type];
  const clarity = ASPECT_CLARITY[locale][aspect.type];
  const funTitle = pickSynastryTitle(primaryArea, tone, index, locale);
  const pSymA = PLANET_SYMBOL[aspect.a.planet] ?? "";
  const pSymB = PLANET_SYMBOL[aspect.b.planet] ?? "";
  const aSymbol = ASPECT_SYMBOL[aspect.type] ?? "";
  const subtitle = `${pSymA} ${aspect.a.planet} ${aSymbol} ${pSymB} ${aspect.b.planet} · ${label}`;
  return {
    key: `synastry-${index}-${aspect.a.planet}-${aspect.b.planet}-${aspect.type}`,
    kind: "synastry-aspect",
    title: funTitle,
    subtitle,
    text: buildHighlightText(aspect, [primaryArea, secondaryArea], locale),
    tags: dedupeTags([
      LIFE_AREA_LABELS[locale][primaryArea].toLowerCase(),
      LIFE_AREA_LABELS[locale][secondaryArea].toLowerCase(),
      clarity.tag,
      label.toLowerCase(),
      aspect.a.planet.toLowerCase(),
      aspect.b.planet.toLowerCase(),
    ]),
    tone,
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
