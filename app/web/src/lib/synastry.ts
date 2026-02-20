import {
  ASPECT_SYMBOL,
  PLANETS,
  PLANET_SYMBOL,
  SIGN_INDEX,
  getOrbMultiplier,
  normalizeChartSettings,
  normalizeAngle,
  resolveAspectDefinitions,
} from "./constants";
import { buildSunComparison } from "./sunComparison";
import type {
  AspectName,
  AspectTone,
  ChartComparison,
  ChartResult,
  ComparisonAspect,
  ComparisonHighlight,
  DetailBlock,
  DuoMode,
  PlanetName,
  SunComparison,
  SynastryStat,
  SynastryStatKey,
  ZodiacSign,
} from "./types";

export type SynastryLocale = "pt" | "en";
type LifeArea = "love" | "family" | "work" | "friends" | "money" | "communication";

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

const SYNASTRY_STAT_THEME: Record<SynastryLocale, Record<SynastryStatKey, string>> = {
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

const COMPLEMENTARY_STAT_TUNING = {
  base: 0.08,
  samePlanet: 0.12,
  personalPair: 0.08,
  orbTiers: [
    { maxOrb: 1.0, bonus: 0.12 },
    { maxOrb: 2.2, bonus: 0.08 },
    { maxOrb: 4.0, bonus: 0.04 },
  ],
  impactCap: 1.2,
} as const;

const ASPECT_STAT_IMPACT: Partial<Record<AspectName, number>> = {
  Trine: 1,
  Sextile: 0.85,
  Conjunction: 0.7,
  Opposition: 0.4,
  Square: 0.25,
  Quintile: 0.65,
  Biquintile: 0.6,
  Semisextile: 0.5,
  Quincunx: 0.35,
  Semisquare: 0.3,
  Sesquiquadrate: 0.28,
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

const LIFE_AREA_LABELS_FRIEND: Record<SynastryLocale, Record<LifeArea, string>> = {
  en: {
    ...LIFE_AREA_LABELS.en,
    love: "Bond",
  },
  pt: {
    ...LIFE_AREA_LABELS.pt,
    love: "vibe",
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
  Partial<Record<AspectName, { tone: string; advice: string; tag: string }>>
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
    Quincunx: {
      tone: "Adjustment aspect that exposes misalignment.",
      advice: "Use tiny routine changes to prevent recurring friction.",
      tag: "adjustment",
    },
    Semisextile: {
      tone: "Subtle support channel with low noise.",
      advice: "Small intentional actions make this aspect useful.",
      tag: "subtle-flow",
    },
    Semisquare: {
      tone: "Low-grade friction that builds over time.",
      advice: "Address small annoyances early before they stack.",
      tag: "micro-friction",
    },
    Sesquiquadrate: {
      tone: "Background pressure that needs better timing.",
      advice: "Slow down decisions and verify assumptions.",
      tag: "pressure",
    },
    Quintile: {
      tone: "Creative chemistry and problem-solving spark.",
      advice: "Channel this into one shared creative objective.",
      tag: "creative",
    },
    Biquintile: {
      tone: "Focused strategic creativity between both people.",
      advice: "Plan one concrete experiment and review results quickly.",
      tag: "strategy",
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
    Quincunx: {
      tone: "Aspecto de ajuste que mostra desalinhamento.",
      advice: "Muda rotina pequena antes que a friccao repita.",
      tag: "ajuste",
    },
    Semisextile: {
      tone: "Canal sutil de apoio, sem alarde.",
      advice: "Acao pequena e consistente faz render.",
      tag: "fluxo-sutil",
    },
    Semisquare: {
      tone: "Atrito baixo que acumula com o tempo.",
      advice: "Resolve incomodo pequeno antes de virar bola de neve.",
      tag: "micro-atrito",
    },
    Sesquiquadrate: {
      tone: "Pressao de fundo que pede timing melhor.",
      advice: "Desacelera decisao e confirma premissas.",
      tag: "pressao",
    },
    Quintile: {
      tone: "Quimica criativa e boa inventividade juntos.",
      advice: "Canaliza em um objetivo criativo concreto.",
      tag: "criatividade",
    },
    Biquintile: {
      tone: "Criatividade estrategica com foco.",
      advice: "Planeja um experimento pratico e revisa rapido.",
      tag: "estrategia",
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

const FRIEND_LOVE_PLAYBOOK: Record<SynastryLocale, { focus: string; risk: string; move: string }> = {
  en: {
    focus: "Trust, loyalty, and shared rhythm between close friends.",
    risk: "Unclear expectations can turn support into friction.",
    move: "Set one friendship pact for availability and direct feedback this week.",
  },
  pt: {
    focus: "Confianca, lealdade e sintonia entre amigos de verdade.",
    risk: "Expectativa mal combinada vira cobranca e desgaste.",
    move: "Fecha um pacto simples de disponibilidade e sinceridade nesta semana.",
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

function buildAreaBreakdown(
  areas: readonly LifeArea[],
  locale: SynastryLocale,
  duoMode: DuoMode
): string {
  const areaLabels = getAreaLabels(locale, duoMode);
  return areas
    .slice(0, 3)
    .map((area, index) => {
      const label = areaLabels[area];
      const playbook = getAreaPlaybook(locale, duoMode, area);
      return `${index + 1}. ${label}: ${playbook.focus}`;
    })
    .join(" ");
}

function buildHighlightDetails(
  aspect: ComparisonAspect,
  areas: readonly LifeArea[],
  locale: SynastryLocale,
  duoMode: DuoMode
): DetailBlock[] {
  const [primaryArea = "love", secondaryArea = "family", tertiaryArea = "work"] = areas;
  const areaLabels = getAreaLabels(locale, duoMode);
  const aspectLabel = getAspectLabel(locale, aspect.type);
  const clarity = getAspectClarity(locale, aspect.type);
  const primaryLabel = areaLabels[primaryArea];
  const secondaryLabel = areaLabels[secondaryArea];
  const primaryPlaybook = getAreaPlaybook(locale, duoMode, primaryArea);
  const secondaryPlaybook = getAreaPlaybook(locale, duoMode, secondaryArea);
  const orbDetail = getOrbDetail(aspect.orb, locale);
  const areaBreakdown = buildAreaBreakdown([primaryArea, secondaryArea, tertiaryArea], locale, duoMode);

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
    case "Semisextile":
    case "Quintile":
    case "Biquintile":
      return "harmonious";
    case "Square":
    case "Opposition":
    case "Semisquare":
    case "Sesquiquadrate":
    case "Quincunx":
      return "challenging";
  }
  return "intense";
}


const SYNASTRY_TITLES: Record<
  SynastryLocale,
  Record<LifeArea, Record<AspectTone, string[]>>
> = {
  en: {
    love: {
      harmonious: ["City of Stars", "A Lovely Night"],
      challenging: ["Love Under Fire", "Heart's Boot Camp"],
      intense: ["Here's to the Ones Who Dream", "I'm Always Gonna Love You"],
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
      harmonious: ["People Love What Others Are Passionate About", "A Bit of Madness"],
      challenging: ["Frenemies Potential", "Friends Who Push"],
      intense: ["Ride or Die Energy", "Instant Connection"],
    },
    money: {
      harmonious: ["Financial Sync", "The Golden Match"],
      challenging: ["Budget Wars", "The Resource Tug"],
      intense: ["High Stakes Bond", "All-In Investment"],
    },
    communication: {
      harmonious: ["Same Wavelength", "I Think It's Romantic"],
      challenging: ["Lost in Translation", "The Debate Club"],
      intense: ["Mind Meld", "Words Hit Different"],
    },
  },
  pt: {
    love: {
      harmonious: ["Cidade das Estrelas", "Uma Noite Encantadora"],
      challenging: ["Amor que Da Trabalho", "Coracao na Porrada"],
      intense: ["Pros Que Ousam Sonhar", "Eu Sempre Vou Te Amar"],
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
      harmonious: ["As Pessoas Amam Quem Tem Paixao", "Um Pouco de Loucura"],
      challenging: ["Quase Inimigo, Quase Irmao", "Cria que Cutuca"],
      intense: ["Parceiro de Trincheira", "Cola Cosmica"],
    },
    money: {
      harmonious: ["Grana no Flow", "Bolso em Sintonia"],
      challenging: ["Guerra de Bolso", "Grana na Treta"],
      intense: ["Aposta Alta", "Grana Tudo ou Nada"],
    },
    communication: {
      harmonious: ["Mesma Frequencia", "Eu Acho Romantico"],
      challenging: ["Papo Desencontrado", "Dialogo de Surdo"],
      intense: ["Telepatia Bruta", "Papo que Arrepia"],
    },
  },
};

const FRIEND_LOVE_TITLES: Record<SynastryLocale, Record<AspectTone, string[]>> = {
  en: {
    harmonious: ["Friendship Green Light", "Ride-or-Die Sync"],
    challenging: ["Friendship Stress Test", "Trust Bootcamp"],
    intense: ["Crew Bond at Full Volume", "Unbreakable Squad Energy"],
  },
  pt: {
    harmonious: ["Amizade no Sinal Verde", "Sintonia de Trincheira"],
    challenging: ["Amizade no Teste", "Confianca no Bootcamp"],
    intense: ["Vibe de Bonde Fechado", "Parceria no Talo"],
  },
};

function getAreaLabels(locale: SynastryLocale, duoMode: DuoMode): Record<LifeArea, string> {
  return duoMode === "friend" ? LIFE_AREA_LABELS_FRIEND[locale] : LIFE_AREA_LABELS[locale];
}

function getAreaPlaybook(
  locale: SynastryLocale,
  duoMode: DuoMode,
  area: LifeArea
): { focus: string; risk: string; move: string } {
  if (duoMode === "friend" && area === "love") {
    return FRIEND_LOVE_PLAYBOOK[locale];
  }
  return LIFE_AREA_PLAYBOOK[locale][area];
}

function pickSynastryTitle(
  area: LifeArea,
  tone: AspectTone,
  index: number,
  locale: SynastryLocale,
  duoMode: DuoMode
): string {
  const options =
    duoMode === "friend" && area === "love"
      ? FRIEND_LOVE_TITLES[locale][tone]
      : SYNASTRY_TITLES[locale][area][tone];
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

function getAspectLabel(locale: SynastryLocale, type: AspectName): string {
  return ASPECT_LABELS[locale][type] ?? type;
}

function getAspectClarity(
  locale: SynastryLocale,
  type: AspectName
): { tone: string; advice: string; tag: string } {
  return (
    ASPECT_CLARITY[locale][type] ??
    (locale === "en"
      ? {
          tone: "Mixed signal that asks for conscious handling.",
          advice: "Use clear agreements and review practical expectations weekly.",
          tag: "dynamic",
        }
      : {
          tone: "Sinal misto que pede jogo de cintura.",
          advice: "Fecha combinado claro e revisa expectativa pratica toda semana.",
          tag: "dinamica",
        })
  );
}

function getAspectImpact(type: AspectName): number {
  return ASPECT_STAT_IMPACT[type] ?? 0.45;
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

function getPlanetLabel(locale: SynastryLocale, planet: PlanetName): string {
  return PLANET_LABELS[locale][planet] ?? planet;
}

function buildAspectSummaryLabel(aspect: ComparisonAspect, locale: SynastryLocale): string {
  const aspectLabel = getAspectLabel(locale, aspect.type);
  return `${getPlanetLabel(locale, aspect.a.planet)} ${aspectLabel} ${getPlanetLabel(locale, aspect.b.planet)}`;
}

function isComplementaryOpposition(
  aspect: ComparisonAspect,
  chartA: ChartResult,
  chartB: ChartResult
): boolean {
  if (aspect.type !== "Opposition") return false;
  const signA = chartA.planets[aspect.a.planet]?.sign;
  const signB = chartB.planets[aspect.b.planet]?.sign;
  if (!signA || !signB) return false;
  return OPPOSITE_SIGNS[signA] === signB;
}

function buildComplementaryLabel(
  aspect: ComparisonAspect,
  chartA: ChartResult,
  chartB: ChartResult,
  locale: SynastryLocale
): string {
  const signA = chartA.planets[aspect.a.planet]?.sign;
  const signB = chartB.planets[aspect.b.planet]?.sign;
  const signLabelA = signA ? SIGN_LABELS[locale][signA] : "?";
  const signLabelB = signB ? SIGN_LABELS[locale][signB] : "?";
  return `${getPlanetLabel(locale, aspect.a.planet)} em ${signLabelA} x ${getPlanetLabel(
    locale,
    aspect.b.planet
  )} em ${signLabelB}`;
}

function getComplementaryStatBonus(
  aspect: ComparisonAspect,
  chartA: ChartResult,
  chartB: ChartResult
): number {
  if (!isComplementaryOpposition(aspect, chartA, chartB)) return 0;

  let bonus = COMPLEMENTARY_STAT_TUNING.base;
  if (aspect.a.planet === aspect.b.planet) bonus += COMPLEMENTARY_STAT_TUNING.samePlanet;
  if (PERSONAL_PLANETS.has(aspect.a.planet) && PERSONAL_PLANETS.has(aspect.b.planet)) {
    bonus += COMPLEMENTARY_STAT_TUNING.personalPair;
  }

  const orb = aspect.orb ?? 8;
  for (const tier of COMPLEMENTARY_STAT_TUNING.orbTiers) {
    if (orb <= tier.maxOrb) {
      bonus += tier.bonus;
      break;
    }
  }

  return bonus;
}

function buildStatScoreMessage(score: number, locale: SynastryLocale): string {
  if (locale === "pt") {
    if (score >= 75) return "Status forte agora.";
    if (score >= 56) return "Status estavel com espaco para subir.";
    if (score >= 40) return "Status misto, pede ajuste fino.";
    return "Status sensivel, precisa estrategia no dia a dia.";
  }

  if (score >= 75) return "Strong status right now.";
  if (score >= 56) return "Stable status with room to improve.";
  if (score >= 40) return "Mixed status; this needs fine-tuning.";
  return "Fragile status; this needs active structure.";
}

function buildStatSummary(
  stat: SynastryStatKey,
  score: number,
  locale: SynastryLocale,
  sunComparison: SunComparison,
  dominantAspect?: ComparisonAspect,
  complementaryAspect?: ComparisonAspect,
  chartA?: ChartResult,
  chartB?: ChartResult
): string {
  const theme = SYNASTRY_STAT_THEME[locale][stat];
  const scoreMessage = buildStatScoreMessage(score, locale);
  const dominantLabel = dominantAspect ? buildAspectSummaryLabel(dominantAspect, locale) : null;
  const hasComplementarySun = sunComparison.relation === "complementary-opposites";
  const sunContext =
    hasComplementarySun
      ? locale === "pt"
        ? `Bonus solar global (+${sunComparison.globalBonus}) ativo em ${sunComparison.label}.`
        : `Global Sun bonus (+${sunComparison.globalBonus}) active in ${sunComparison.label}.`
      : "";

  if (complementaryAspect && chartA && chartB) {
    const complementaryLabel = buildComplementaryLabel(complementaryAspect, chartA, chartB, locale);
    if (locale === "pt") {
      const strengthLabel = score >= 70 ? "Match forte" : "Vinculo forte";
      return `${theme} ${scoreMessage} ${strengthLabel} de opostos complementares em ${complementaryLabel}, com potencial de conexao profunda. ${sunContext}`.trim();
    }
    const strengthLabel = score >= 70 ? "Strong match" : "Strong bond";
    return `${theme} ${scoreMessage} ${strengthLabel} from complementary opposites in ${complementaryLabel}, with deep-bond potential. ${sunContext}`.trim();
  }

  if (dominantLabel) {
    if (locale === "pt") {
      return `${theme} ${scoreMessage} Aspecto dominante: ${dominantLabel}. ${sunContext}`.trim();
    }
    return `${theme} ${scoreMessage} Dominant aspect: ${dominantLabel}. ${sunContext}`.trim();
  }

  return `${theme} ${scoreMessage} ${sunContext}`.trim();
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
  locale: SynastryLocale,
  chartA: ChartResult,
  chartB: ChartResult,
  sunComparison: SunComparison
): SynastryStat[] {
  const totals: Record<SynastryStatKey, { weighted: number; maximum: number }> = {
    attraction: { weighted: 0, maximum: 0 },
    communication: { weighted: 0, maximum: 0 },
    stability: { weighted: 0, maximum: 0 },
    growth: { weighted: 0, maximum: 0 },
  };
  const dominantAspect: Partial<Record<SynastryStatKey, { score: number; aspect: ComparisonAspect }>> =
    {};
  const complementaryOpposition: Partial<
    Record<SynastryStatKey, { score: number; aspect: ComparisonAspect }>
  > = {};

  for (const aspect of aspects) {
    const baseScore = scoreAspect(aspect);
    const baseImpact = getAspectImpact(aspect.type);
    const complementaryBonus = getComplementaryStatBonus(aspect, chartA, chartB);
    const impact = Math.min(COMPLEMENTARY_STAT_TUNING.impactCap, baseImpact + complementaryBonus);
    for (const stat of SYNASTRY_STAT_ORDER) {
      const weight = buildStatWeight(aspect, stat);
      const contribution = baseScore * impact * weight;
      totals[stat].weighted += contribution;
      totals[stat].maximum += 100 * weight;

      if (!dominantAspect[stat] || contribution > (dominantAspect[stat]?.score ?? 0)) {
        dominantAspect[stat] = { score: contribution, aspect };
      }

      if (isComplementaryOpposition(aspect, chartA, chartB)) {
        let complementaryScore = contribution;
        if (aspect.a.planet === aspect.b.planet) complementaryScore += 40;
        if (PERSONAL_PLANETS.has(aspect.a.planet) && PERSONAL_PLANETS.has(aspect.b.planet)) {
          complementaryScore += 20;
        }
        complementaryScore += Math.max(0, 8 - (aspect.orb ?? 8)) * 2;

        if (
          !complementaryOpposition[stat] ||
          complementaryScore > (complementaryOpposition[stat]?.score ?? 0)
        ) {
          complementaryOpposition[stat] = { score: complementaryScore, aspect };
        }
      }
    }
  }

  return SYNASTRY_STAT_ORDER.map((stat) => {
    const total = totals[stat];
    const normalized = total.maximum > 0 ? (total.weighted / total.maximum) * 100 : 0;
    const score = clampToPercent(normalized + sunComparison.globalBonus);
    return {
      key: stat,
      label: SYNASTRY_STAT_LABELS[locale][stat],
      score,
      summary: buildStatSummary(
        stat,
        score,
        locale,
        sunComparison,
        dominantAspect[stat]?.aspect,
        complementaryOpposition[stat]?.aspect,
        chartA,
        chartB
      ),
    };
  });
}

function buildHighlightText(
  aspect: ComparisonAspect,
  areas: [LifeArea, LifeArea],
  locale: SynastryLocale,
  duoMode: DuoMode
): string {
  const [firstArea, secondArea] = areas;
  const areaLabels = getAreaLabels(locale, duoMode);
  const clarity = getAspectClarity(locale, aspect.type);
  const firstLabel = areaLabels[firstArea];
  const secondLabel = areaLabels[secondArea];

  if (locale === "en") {
    return `Main areas: ${firstLabel} and ${secondLabel}. ${clarity.tone} ${clarity.advice}`;
  }
  return `Areas mais mexidas: ${firstLabel} e ${secondLabel}. ${clarity.tone} ${clarity.advice}`;
}

function makeHighlight(
  aspect: ComparisonAspect,
  index: number,
  locale: SynastryLocale,
  duoMode: DuoMode
): ComparisonHighlight {
  const areaLabels = getAreaLabels(locale, duoMode);
  const rankedAreas = rankLifeAreas(aspect);
  const primaryArea = rankedAreas[0] ?? "love";
  const secondaryArea = rankedAreas[1] ?? "family";
  const tone = getAspectTone(aspect.type);
  const label = getAspectLabel(locale, aspect.type);
  const clarity = getAspectClarity(locale, aspect.type);
  const funTitle = pickSynastryTitle(primaryArea, tone, index, locale, duoMode);
  const pSymA = PLANET_SYMBOL[aspect.a.planet] ?? "";
  const pSymB = PLANET_SYMBOL[aspect.b.planet] ?? "";
  const aSymbol = ASPECT_SYMBOL[aspect.type] ?? "";
  const subtitle = `${pSymA} ${aspect.a.planet} ${aSymbol} ${pSymB} ${aspect.b.planet} · ${label}`;
  return {
    key: `synastry-${index}-${aspect.a.planet}-${aspect.b.planet}-${aspect.type}`,
    kind: "synastry-aspect",
    title: funTitle,
    subtitle,
    text: buildHighlightText(aspect, [primaryArea, secondaryArea], locale, duoMode),
    details: buildHighlightDetails(aspect, rankedAreas, locale, duoMode),
    tags: dedupeTags([
      areaLabels[primaryArea].toLowerCase(),
      areaLabels[secondaryArea].toLowerCase(),
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
  locale: SynastryLocale = "pt",
  duoMode: DuoMode = "romantic"
): ChartComparison {
  const settings = normalizeChartSettings(chartA.settings ?? chartB.settings);
  const orbMultiplier = getOrbMultiplier(settings.orbMode);
  const aspectDefs = resolveAspectDefinitions(settings);
  const aspects: ComparisonAspect[] = [];

  for (const planetA of PLANETS) {
    const lonA = getPlanetLongitude(chartA, planetA);
    for (const planetB of PLANETS) {
      const lonB = getPlanetLongitude(chartB, planetB);
      const separation = separationDegrees(lonA, lonB);
      let best: ComparisonAspect | null = null;
      for (const aspectDef of aspectDefs) {
        const orb = Math.abs(separation - aspectDef.angle);
        if (orb <= aspectDef.orb * orbMultiplier) {
          const candidate: ComparisonAspect = {
            a: { chart: "A", planet: planetA },
            b: { chart: "B", planet: planetB },
            type: aspectDef.type,
            orb: Math.round(orb * 10) / 10,
          };
          if (!best || (candidate.orb ?? 99) < (best.orb ?? 99)) {
            best = candidate;
          }
        }
      }
      if (best) aspects.push(best);
    }
  }

  aspects.sort((left, right) => (left.orb ?? 0) - (right.orb ?? 0));
  const highlights = aspects.map((aspect, index) => makeHighlight(aspect, index, locale, duoMode));
  const sunComparison = buildSunComparison(chartA, chartB, locale);
  const stats = buildSynastryStats(aspects, locale, chartA, chartB, sunComparison);

  return {
    chartA,
    chartB,
    aspects,
    highlights,
    stats,
    sunComparison,
  };
}
