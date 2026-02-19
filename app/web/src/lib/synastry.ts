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
  SynastryStat,
  SynastryStatKey,
} from "./types";

export type SynastryLocale = "pt" | "en";
type LifeArea = "love" | "family" | "work" | "friends" | "money" | "communication";
type SpecialChartSignature = {
  date: string;
  time: string;
  country: string;
  utcDateTime: string;
  timezone: string;
  lat: number;
  lon: number;
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

const SPECIAL_RAPHAEL_SIGNATURE: SpecialChartSignature = {
  date: "1988-12-16",
  time: "11:20",
  country: "BR",
  utcDateTime: "1988-12-16T13:20:00Z",
  timezone: "America/Sao_Paulo",
  lat: -22.7592175,
  lon: -43.4508728,
};

const SPECIAL_STELLA_SIGNATURE: SpecialChartSignature = {
  date: "1998-06-10",
  time: "08:34",
  country: "BR",
  utcDateTime: "1998-06-10T11:34:00Z",
  timezone: "America/Sao_Paulo",
  lat: -23.5506507,
  lon: -46.6333824,
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
      tone: "Encontro de energia muito forte.",
      advice: "Quando voces alinham expectativas, essa intensidade vira construcao.",
      tag: "intensidade",
    },
    Opposition: {
      tone: "Dinamica de polos que se atraem e se provocam.",
      advice: "Combinados claros evitam desgaste repetido.",
      tag: "puxa-puxa",
    },
    Square: {
      tone: "Atrito direto que pede maturidade.",
      advice: "Se o conflito for tratado como parceria, vira crescimento real.",
      tag: "desafio",
    },
    Trine: {
      tone: "Fluxo natural e acolhedor.",
      advice: "Vale usar essa facilidade com intencao para aprofundar o vinculo.",
      tag: "fluidez",
    },
    Sextile: {
      tone: "Potencial muito bom para evoluir juntos.",
      advice: "Esse ponto cresce com atitudes consistentes no dia a dia.",
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
      : "Orb bem fechado: isso aparece forte no dia a dia.";
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
  const watchoutTitle = duoMode === "romantic"
    ? (locale === "en" ? "Tender watchout" : "Ponto de cuidado")
    : (locale === "en" ? "Watchout" : "Treta pra evitar");
  const actionTitle = duoMode === "romantic"
    ? (locale === "en" ? "Gesture of care" : "Gesto de carinho")
    : (locale === "en" ? "Action step" : "Passo pratico");

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
        title: watchoutTitle,
        text: `${primaryLabel}: ${primaryPlaybook.risk} ${secondaryLabel}: ${secondaryPlaybook.risk}`,
      },
      {
        title: actionTitle,
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
      title: watchoutTitle,
      text: `${primaryLabel}: ${primaryPlaybook.risk} ${secondaryLabel}: ${secondaryPlaybook.risk}`,
    },
    {
      title: actionTitle,
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
      harmonious: ["Raridade em Sintonia", "Carinho que Eleva"],
      challenging: ["Amor em Ajuste", "Coracao em Aprendizado"],
      intense: ["Estrela de Referencia", "Conexao que Marca"],
    },
    family: {
      harmonious: ["Lar em Harmonia", "Raiz Alinhada"],
      challenging: ["Rotina em Ajuste", "Familia em Reconstrucao"],
      intense: ["Laco Profundo", "Base que Transforma"],
    },
    work: {
      harmonious: ["Dupla que Rende", "Execucao em Sintonia"],
      challenging: ["Ritmo em Conflito", "Ambicao em Atrito"],
      intense: ["Parceria de Potencia", "Foco que Impressiona"],
    },
    friends: {
      harmonious: ["Companhia que Faz Bem", "Lealdade em Cena"],
      challenging: ["Amizade em Teste", "Afinidade em Ajuste"],
      intense: ["Parceria de Trincheira", "Conexao Fora da Curva"],
    },
    money: {
      harmonious: ["Grana em Sintonia", "Seguranca Compartilhada"],
      challenging: ["Prioridades em Choque", "Bolso em Negociacao"],
      intense: ["Aposta com Responsabilidade", "Investimento de Confianca"],
    },
    communication: {
      harmonious: ["Mesma Frequencia", "Conversa que Encanta"],
      challenging: ["Papo em Ajuste", "Escuta em Construcao"],
      intense: ["Conexao Mental Forte", "Palavra que Marca"],
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

function nearlyEqual(left: number, right: number, tolerance = 0.02): boolean {
  return Math.abs(left - right) <= tolerance;
}

function matchesSpecialSignature(chart: ChartResult, signature: SpecialChartSignature): boolean {
  const input = chart.input;
  const normalized = chart.normalized;

  return (
    input.date === signature.date &&
    input.time === signature.time &&
    input.country.toUpperCase() === signature.country &&
    normalized.utcDateTime === signature.utcDateTime &&
    normalized.timezone === signature.timezone &&
    nearlyEqual(normalized.location.lat, signature.lat) &&
    nearlyEqual(normalized.location.lon, signature.lon)
  );
}

function isRaphaelStellaMap(chartA: ChartResult, chartB: ChartResult): boolean {
  const directMatch =
    matchesSpecialSignature(chartA, SPECIAL_RAPHAEL_SIGNATURE) &&
    matchesSpecialSignature(chartB, SPECIAL_STELLA_SIGNATURE);
  const swappedMatch =
    matchesSpecialSignature(chartA, SPECIAL_STELLA_SIGNATURE) &&
    matchesSpecialSignature(chartB, SPECIAL_RAPHAEL_SIGNATURE);
  return directMatch || swappedMatch;
}

function buildSpecialRomanticHighlight(locale: SynastryLocale): ComparisonHighlight {
  if (locale === "en") {
    return {
      key: "special-raphael-stella-core",
      kind: "summary",
      title: "Reference Star Connection",
      subtitle: "A map that combines admiration, affection, and intention",
      text: "This pairing carries emotional recognition, mental connection, and real care. The strength here is not only intensity, but the way respect and tenderness can protect the bond.",
      tags: ["rare-bond", "admiration", "care", "mind-connection", "respect"],
      details: [
        {
          title: "Why this feels different",
          text: "The connection tends to mix affection, desire, friendship, and admiration in the same lane.",
        },
        {
          title: "What preserves it",
          text: "Clear limits, honest communication, and consistent small gestures keep this energy healthy.",
        },
      ],
      tone: "intense",
      score: 100,
    };
  }

  return {
    key: "special-raphael-stella-core",
    kind: "summary",
    title: "Estrela de Referencia",
    subtitle: "Um mapa que junta admiracao, carinho e intencao",
    text: "Esse encontro traz reconhecimento emocional, conexao mental e cuidado real. A forca aqui nao e so intensidade: e a forma como respeito e delicadeza protegem o vinculo.",
    tags: ["conexao-rara", "admiracao", "carinho", "conexao-mental", "respeito"],
    details: [
      {
        title: "Por que isso marca",
        text: "A dinamica costuma unir admiracao, amizade, desejo e acolhimento no mesmo fluxo.",
      },
      {
        title: "Como preservar o melhor",
        text: "Limites claros, conversa honesta e gestos consistentes mantem essa energia em equilibrio.",
      },
    ],
    tone: "intense",
    score: 100,
  };
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
    const impact = getAspectImpact(aspect.type);
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
  locale: SynastryLocale,
  duoMode: DuoMode
): string {
  const [firstArea, secondArea] = areas;
  const areaLabels = getAreaLabels(locale, duoMode);
  const clarity = getAspectClarity(locale, aspect.type);
  const firstLabel = areaLabels[firstArea];
  const secondLabel = areaLabels[secondArea];
  const romanticNuance = duoMode === "romantic" ? buildRomanticNuance(aspect, locale) : "";

  if (locale === "en") {
    return `Main areas: ${firstLabel} and ${secondLabel}. ${clarity.tone} ${clarity.advice}${romanticNuance}`;
  }
  return `Areas mais mexidas: ${firstLabel} e ${secondLabel}. ${clarity.tone} ${clarity.advice}${romanticNuance}`;
}

function includesPlanet(aspect: ComparisonAspect, planet: PlanetName): boolean {
  return aspect.a.planet === planet || aspect.b.planet === planet;
}

function buildRomanticNuance(aspect: ComparisonAspect, locale: SynastryLocale): string {
  const hasSun = includesPlanet(aspect, "Sun");
  const hasMoon = includesPlanet(aspect, "Moon");
  const hasMercury = includesPlanet(aspect, "Mercury");
  const hasVenus = includesPlanet(aspect, "Venus");
  const hasMars = includesPlanet(aspect, "Mars");
  const hasJupiter = includesPlanet(aspect, "Jupiter");
  const hasSaturn = includesPlanet(aspect, "Saturn");
  const hasUranus = includesPlanet(aspect, "Uranus");
  const hasPluto = includesPlanet(aspect, "Pluto");

  if (hasSun && hasMoon) {
    return locale === "en"
      ? " This tends to create emotional recognition and genuine admiration."
      : " Isso costuma trazer reconhecimento emocional e admiracao real.";
  }
  if (hasVenus && hasPluto) {
    return locale === "en"
      ? " The magnetic pull is high, so care and boundaries keep it healthy."
      : " O magnetismo aqui e alto, entao cuidado e limites preservam o melhor.";
  }
  if (hasVenus && hasJupiter) {
    return locale === "en"
      ? " Warmth, generosity, and affection usually grow quickly here."
      : " Esse ponto favorece carinho, generosidade e acolhimento.";
  }
  if (hasMercury || (hasSun && hasMercury) || (hasMercury && hasMoon) || (hasMercury && hasUranus)) {
    return locale === "en"
      ? " Mental connection is part of the attraction, not just a bonus."
      : " A conexao mental vira parte central do encanto, nao so um extra.";
  }
  if (hasSaturn && (hasSun || hasMoon || hasVenus)) {
    return locale === "en"
      ? " This favors commitment and respect when both protect the bond."
      : " Esse encontro favorece compromisso e respeito quando o vinculo e cuidado.";
  }
  if (hasMars && hasUranus) {
    return locale === "en"
      ? " There is spark and movement, which works best with clear direction."
      : " Ha faisca e movimento; com direcao clara, isso rende muito.";
  }

  return locale === "en"
    ? " This can become a rare bond when admiration and care stay aligned."
    : " Isso pode virar uma conexao rara quando admiracao e cuidado andam juntos.";
}

function buildRomanticTags(aspect: ComparisonAspect, locale: SynastryLocale): string[] {
  const hasSun = includesPlanet(aspect, "Sun");
  const hasMoon = includesPlanet(aspect, "Moon");
  const hasMercury = includesPlanet(aspect, "Mercury");
  const hasVenus = includesPlanet(aspect, "Venus");
  const hasMars = includesPlanet(aspect, "Mars");
  const hasJupiter = includesPlanet(aspect, "Jupiter");
  const hasSaturn = includesPlanet(aspect, "Saturn");
  const hasPluto = includesPlanet(aspect, "Pluto");

  const tags: string[] = [];

  if ((hasSun && hasMoon) || (hasVenus && hasJupiter)) {
    tags.push(locale === "en" ? "admiration" : "admiracao");
  }
  if (hasMercury || (hasSun && hasMercury)) {
    tags.push(locale === "en" ? "mind-connection" : "conexao-mental");
  }
  if (hasVenus || hasMoon || hasJupiter) {
    tags.push(locale === "en" ? "care" : "carinho");
  }
  if (hasSaturn && (hasSun || hasMoon || hasVenus)) {
    tags.push(locale === "en" ? "respect" : "respeito");
  }
  if ((hasVenus && hasPluto) || (hasMars && hasPluto) || (hasVenus && hasMars)) {
    tags.push(locale === "en" ? "desire" : "desejo");
  }

  return tags;
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
  const romanticTags = duoMode === "romantic" ? buildRomanticTags(aspect, locale) : [];
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
      ...romanticTags,
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
  const highlightList =
    duoMode === "romantic" && isRaphaelStellaMap(chartA, chartB)
      ? [buildSpecialRomanticHighlight(locale), ...highlights]
      : highlights;
  const stats = buildSynastryStats(aspects, locale);

  return {
    chartA,
    chartB,
    aspects,
    highlights: highlightList,
    stats,
  };
}
