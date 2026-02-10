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
  DetailBlock,
  PlanetName,
  SynastryStat,
  SynastryStatKey,
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

const SYNASTRY_STAT_ORDER: SynastryStatKey[] = [
  "attraction",
  "communication",
  "stability",
  "growth",
];

const SYNASTRY_STAT_AREAS: Record<SynastryStatKey, readonly LifeArea[]> = {
  attraction: ["love"],
  communication: ["communication"],
  stability: ["family", "money"],
  growth: ["work", "friends"],
};

const SYNASTRY_STAT_KEY_PLANETS: Record<SynastryStatKey, readonly PlanetName[]> = {
  attraction: ["Venus", "Mars", "Pluto"],
  communication: ["Mercury", "Jupiter", "Sun"],
  stability: ["Moon", "Saturn", "Neptune"],
  growth: ["Sun", "Jupiter", "Uranus"],
};

const SYNASTRY_STAT_LABELS: Record<SynastryLocale, Record<SynastryStatKey, string>> = {
  en: {
    attraction: "Attraction",
    communication: "Communication",
    stability: "Stability",
    growth: "Growth",
  },
  pt: {
    attraction: "Atracao",
    communication: "Comunicacao",
    stability: "Estabilidade",
    growth: "Crescimento",
  },
};

const SYNASTRY_STAT_SUMMARY: Record<SynastryLocale, Record<SynastryStatKey, string>> = {
  en: {
    attraction: "Chemistry, desire, and romantic pull.",
    communication: "How well both people exchange ideas.",
    stability: "Emotional and practical consistency.",
    growth: "Capacity to evolve and build together.",
  },
  pt: {
    attraction: "Quimica, desejo e puxada romantica.",
    communication: "Como os dois trocam ideia no dia a dia.",
    stability: "Constancia emocional e pratica.",
    growth: "Capacidade de evoluir e construir junto.",
  },
};

const ASPECT_STAT_IMPACT: Record<AspectName, number> = {
  Trine: 1,
  Sextile: 0.85,
  Conjunction: 0.7,
  Opposition: 0.4,
  Square: 0.25,
};

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

const LIFE_AREA_PLAYBOOK: Record<
  SynastryLocale,
  Record<LifeArea, { focus: string; risk: string; move: string }>
> = {
  en: {
    love: {
      focus: "Chemistry, affection, and romantic expectations.",
      risk: "Mixed signals around closeness can create insecurity.",
      move: "Set one ritual for affection and one boundary for conflict.",
    },
    family: {
      focus: "Home routines, emotional safety, and caregiving patterns.",
      risk: "Unspoken roles can create resentment quickly.",
      move: "Define who handles what at home for the next seven days.",
    },
    work: {
      focus: "Ambition, pace, and execution style.",
      risk: "Power struggles can replace collaboration.",
      move: "Agree on priority, owner, and deadline before starting tasks.",
    },
    friends: {
      focus: "Social rhythm, trust, and mutual support.",
      risk: "One person can feel sidelined when plans stay vague.",
      move: "Schedule intentional quality time with a clear plan.",
    },
    money: {
      focus: "Risk tolerance, spending style, and shared security.",
      risk: "Different priorities can trigger recurring budget conflict.",
      move: "Do one weekly money check-in with a single concrete target.",
    },
    communication: {
      focus: "How both people process, explain, and listen.",
      risk: "Assumptions can become avoidable arguments.",
      move: "Use short recap questions before reacting.",
    },
  },
  pt: {
    love: {
      focus: "Quimica, carinho e expectativa no romance.",
      risk: "Sinal misturado vira inseguranca e DR sem fim.",
      move: "Combina um ritual de carinho e um limite claro pra treta.",
    },
    family: {
      focus: "Rotina da casa, acolhimento e cuidado.",
      risk: "Papel mal combinado vira ressentimento rapidinho.",
      move: "Define quem puxa cada responsa da casa nesta semana.",
    },
    work: {
      focus: "Ambicao, ritmo e jeito de executar.",
      risk: "Disputa de ego mata parceria.",
      move: "Antes de comecar, fecha prioridade, dono e prazo.",
    },
    friends: {
      focus: "Role social, lealdade e apoio.",
      risk: "No automatico, alguem vai se sentir escanteado.",
      move: "Marca tempo de qualidade com plano fechado.",
    },
    money: {
      focus: "Risco, gasto e seguranca financeira.",
      risk: "Prioridade diferente vira guerra de boleto.",
      move: "Faz check-in semanal de grana com uma meta objetiva.",
    },
    communication: {
      focus: "Como voces pensam, explicam e escutam.",
      risk: "Suposicao vira discussao boba.",
      move: "Repete em uma frase o que ouviu antes de responder.",
    },
  },
};

function getOrbDetail(orb: number | undefined, locale: SynastryLocale): string {
  if (orb == null) {
    return locale === "en"
      ? "Orb not specified, so treat this as medium strength."
      : "Orb nao veio, entao considera intensidade media.";
  }
  if (orb <= 1) {
    return locale === "en"
      ? "Tight orb: this will show up loudly in day-to-day dynamics."
      : "Orb fechadinho: isso aparece forte no dia a dia, porra.";
  }
  if (orb <= 3) {
    return locale === "en"
      ? "Mid orb: this stays reliable whenever the theme is triggered."
      : "Orb medio: quando esse tema bate, ele aparece com constancia.";
  }
  return locale === "en"
    ? "Wide orb: subtler, but still relevant under pressure."
    : "Orb mais aberto: fica sutil, mas pinta quando o caldo engrossa.";
}

function buildAreaBreakdown(areas: readonly LifeArea[], locale: SynastryLocale): string {
  return areas
    .slice(0, 3)
    .map((area, index) => {
      const label = LIFE_AREA_LABELS[locale][area];
      const playbook = LIFE_AREA_PLAYBOOK[locale][area];
      return `${index + 1}. ${label}: ${playbook.focus}`;
    })
    .join(" ");
}

function buildHighlightDetails(
  aspect: ComparisonAspect,
  areas: readonly LifeArea[],
  locale: SynastryLocale
): DetailBlock[] {
  const [primaryArea = "love", secondaryArea = "family", tertiaryArea = "work"] = areas;
  const aspectLabel = ASPECT_LABELS[locale][aspect.type];
  const clarity = ASPECT_CLARITY[locale][aspect.type];
  const primaryLabel = LIFE_AREA_LABELS[locale][primaryArea];
  const secondaryLabel = LIFE_AREA_LABELS[locale][secondaryArea];
  const primaryPlaybook = LIFE_AREA_PLAYBOOK[locale][primaryArea];
  const secondaryPlaybook = LIFE_AREA_PLAYBOOK[locale][secondaryArea];
  const orbDetail = getOrbDetail(aspect.orb, locale);
  const areaBreakdown = buildAreaBreakdown([primaryArea, secondaryArea, tertiaryArea], locale);

  if (locale === "en") {
    return [
      {
        title: "Aspect decoded",
        text: `${aspect.a.planet} ${aspectLabel} ${aspect.b.planet}. ${clarity.tone} ${orbDetail}`,
      },
      {
        title: "Life areas",
        text: areaBreakdown,
      },
      {
        title: "Watchout",
        text: `${primaryLabel}: ${primaryPlaybook.risk} ${secondaryLabel}: ${secondaryPlaybook.risk}`,
      },
      {
        title: "Action step",
        text: `${primaryPlaybook.move} ${clarity.advice}`,
      },
    ];
  }

  return [
    {
      title: "Traducao sem astro-nerd",
      text: `${aspect.a.planet} ${aspectLabel} ${aspect.b.planet}. ${clarity.tone} ${orbDetail}`,
    },
    {
      title: "Areas que mais mexe",
      text: areaBreakdown,
    },
    {
      title: "Treta pra evitar",
      text: `${primaryLabel}: ${primaryPlaybook.risk} ${secondaryLabel}: ${secondaryPlaybook.risk}`,
    },
    {
      title: "Passo pratico",
      text: `${primaryPlaybook.move} ${clarity.advice}`,
    },
  ];
}

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

function clampToPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreAspect(aspect: ComparisonAspect): number {
  const orb = aspect.orb ?? 0;
  return Math.max(0, 100 - orb * 10);
}

function buildStatWeight(aspect: ComparisonAspect, stat: SynastryStatKey): number {
  const areas = SYNASTRY_STAT_AREAS[stat];
  const weightsA = PLANET_AREA_WEIGHTS[aspect.a.planet];
  const weightsB = PLANET_AREA_WEIGHTS[aspect.b.planet];
  const areaWeight = areas.reduce(
    (sum, area) => sum + (weightsA[area] ?? 0) + (weightsB[area] ?? 0),
    0
  );

  const keyPlanets = SYNASTRY_STAT_KEY_PLANETS[stat];
  const keyBoost =
    (keyPlanets.includes(aspect.a.planet) ? 2 : 0) +
    (keyPlanets.includes(aspect.b.planet) ? 2 : 0);
  return areaWeight + keyBoost;
}

function buildSynastryStats(
  aspects: readonly ComparisonAspect[],
  locale: SynastryLocale
): SynastryStat[] {
  const totals: Record<SynastryStatKey, { weighted: number; maximum: number }> = {
    attraction: { weighted: 0, maximum: 0 },
    communication: { weighted: 0, maximum: 0 },
    stability: { weighted: 0, maximum: 0 },
    growth: { weighted: 0, maximum: 0 },
  };

  for (const aspect of aspects) {
    const baseScore = scoreAspect(aspect);
    const impact = ASPECT_STAT_IMPACT[aspect.type];
    for (const stat of SYNASTRY_STAT_ORDER) {
      const weight = buildStatWeight(aspect, stat);
      totals[stat].weighted += baseScore * impact * weight;
      totals[stat].maximum += 100 * weight;
    }
  }

  return SYNASTRY_STAT_ORDER.map((stat) => {
    const total = totals[stat];
    const normalized = total.maximum > 0 ? (total.weighted / total.maximum) * 100 : 0;
    return {
      key: stat,
      label: SYNASTRY_STAT_LABELS[locale][stat],
      score: clampToPercent(normalized),
      summary: SYNASTRY_STAT_SUMMARY[locale][stat],
    };
  });
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
    details: buildHighlightDetails(aspect, rankedAreas, locale),
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
  const stats = buildSynastryStats(aspects, locale);

  return {
    chartA,
    chartB,
    aspects,
    highlights,
    stats,
  };
}
