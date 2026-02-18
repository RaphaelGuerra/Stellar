import { Body, Ecliptic, GeoVector, MakeTime } from "astronomy-engine";
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
  ChartResult,
  ChartSettings,
  DetailBlock,
  DuoMode,
  PlanetName,
  SynastryStatKey,
} from "./types";
import type { TransitRangeResult } from "./engine";

export type TransitLocale = "pt" | "en";

type ChartRef = "A" | "B";
type TransitKind = "opportunity" | "watchout";

interface TransitHit {
  key: string;
  chartRef: ChartRef;
  transitPlanet: PlanetName;
  natalPlanet: PlanetName;
  aspectType: AspectName;
  orb: number;
  exactness: number;
  stat: SynastryStatKey;
  opportunityScore: number;
  watchoutScore: number;
}

export interface TransitInsight {
  key: string;
  kind: TransitKind;
  title: string;
  subtitle: string;
  text: string;
  tags: readonly string[];
  details: readonly DetailBlock[];
  tone: AspectTone;
  orb: number;
}

export interface DailyTransitOutlook {
  generatedAt: string;
  dateLabel: string;
  opportunity: TransitInsight;
  watchout: TransitInsight;
}

interface BuildTransitOptions {
  locale?: TransitLocale;
  duoMode?: DuoMode;
  now?: Date;
}

const PLANET_BODIES: Record<PlanetName, Body> = {
  Sun: Body.Sun,
  Moon: Body.Moon,
  Mercury: Body.Mercury,
  Venus: Body.Venus,
  Mars: Body.Mars,
  Jupiter: Body.Jupiter,
  Saturn: Body.Saturn,
  Uranus: Body.Uranus,
  Neptune: Body.Neptune,
  Pluto: Body.Pluto,
};

const STAT_ORDER: SynastryStatKey[] = [
  "attraction",
  "communication",
  "stability",
  "growth",
];

const STAT_LABELS: Record<TransitLocale, Record<SynastryStatKey, string>> = {
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

const ASPECT_LABELS: Record<TransitLocale, Partial<Record<AspectName, string>>> = {
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

const PERSON_LABELS: Record<TransitLocale, Record<ChartRef, string>> = {
  en: { A: "Person A", B: "Person B" },
  pt: { A: "Pessoa A", B: "Pessoa B" },
};

const STAT_WEIGHTS: Record<PlanetName, Record<SynastryStatKey, number>> = {
  Sun: { attraction: 1, communication: 2, stability: 1, growth: 3 },
  Moon: { attraction: 1, communication: 1, stability: 3, growth: 1 },
  Mercury: { attraction: 1, communication: 3, stability: 1, growth: 2 },
  Venus: { attraction: 3, communication: 1, stability: 1, growth: 1 },
  Mars: { attraction: 3, communication: 1, stability: 1, growth: 2 },
  Jupiter: { attraction: 1, communication: 2, stability: 1, growth: 3 },
  Saturn: { attraction: 1, communication: 1, stability: 3, growth: 1 },
  Uranus: { attraction: 1, communication: 2, stability: 1, growth: 3 },
  Neptune: { attraction: 1, communication: 1, stability: 3, growth: 1 },
  Pluto: { attraction: 3, communication: 1, stability: 1, growth: 2 },
};

const BASE_IMPACT: Partial<Record<AspectName, number>> = {
  Trine: 1,
  Sextile: 0.9,
  Conjunction: 0.8,
  Opposition: 0.65,
  Square: 0.55,
  Quintile: 0.72,
  Biquintile: 0.7,
  Semisextile: 0.62,
  Quincunx: 0.5,
  Semisquare: 0.44,
  Sesquiquadrate: 0.4,
};

const OPPORTUNITY_FACTOR: Partial<Record<AspectName, number>> = {
  Trine: 1.35,
  Sextile: 1.2,
  Conjunction: 0.85,
  Opposition: 0.35,
  Square: 0.25,
  Quintile: 1.1,
  Biquintile: 1.05,
  Semisextile: 0.95,
  Quincunx: 0.45,
  Semisquare: 0.32,
  Sesquiquadrate: 0.3,
};

const WATCHOUT_FACTOR: Partial<Record<AspectName, number>> = {
  Trine: 0.2,
  Sextile: 0.3,
  Conjunction: 0.85,
  Opposition: 1.35,
  Square: 1.2,
  Quintile: 0.42,
  Biquintile: 0.45,
  Semisextile: 0.5,
  Quincunx: 1.1,
  Semisquare: 1.15,
  Sesquiquadrate: 1.2,
};

function getPlanetLongitude(chart: ChartResult, planet: PlanetName): number {
  const placement = chart.planets[planet];
  if (typeof placement.longitude === "number" && Number.isFinite(placement.longitude)) {
    return normalizeAngle(placement.longitude);
  }
  const signOffset = (SIGN_INDEX[placement.sign] ?? 0) * 30;
  return normalizeAngle(signOffset + (placement.degree ?? 0));
}

function getTransitLongitudes(now: Date): Record<PlanetName, number> {
  const map = {} as Record<PlanetName, number>;
  const time = MakeTime(now);
  for (const planet of PLANETS) {
    const vector = GeoVector(PLANET_BODIES[planet], time, true);
    map[planet] = normalizeAngle(Ecliptic(vector).elon);
  }
  return map;
}

function separationDegrees(a: number, b: number): number {
  const delta = Math.abs(a - b);
  return delta > 180 ? 360 - delta : delta;
}

function getAspectLabel(locale: TransitLocale, type: AspectName): string {
  return ASPECT_LABELS[locale][type] ?? type;
}

function getBaseImpact(type: AspectName): number {
  return BASE_IMPACT[type] ?? 0.5;
}

function getOpportunityFactor(type: AspectName): number {
  return OPPORTUNITY_FACTOR[type] ?? 0.75;
}

function getWatchoutFactor(type: AspectName): number {
  return WATCHOUT_FACTOR[type] ?? 0.85;
}

function detectAspect(
  separation: number,
  aspectDefs: ReadonlyArray<{ type: AspectName; angle: number; orb: number }>,
  orbMultiplier: number
): { type: AspectName; orb: number; maxOrb: number } | null {
  let bestMatch: { type: AspectName; orb: number; maxOrb: number } | null = null;
  for (const aspect of aspectDefs) {
    const maxOrb = aspect.orb * orbMultiplier;
    const orb = Math.abs(separation - aspect.angle);
    if (orb > maxOrb) continue;
    if (bestMatch === null || orb < bestMatch.orb) {
      bestMatch = {
        type: aspect.type,
        orb,
        maxOrb,
      };
    }
  }
  return bestMatch;
}

function pickDominantStat(transitPlanet: PlanetName, natalPlanet: PlanetName): SynastryStatKey {
  let bestStat: SynastryStatKey = "growth";
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const stat of STAT_ORDER) {
    const score = (STAT_WEIGHTS[transitPlanet][stat] ?? 0) * 1.15 + (STAT_WEIGHTS[natalPlanet][stat] ?? 0);
    if (score > bestScore) {
      bestScore = score;
      bestStat = stat;
    }
  }
  return bestStat;
}

function dedupeTags(tags: string[]): string[] {
  return Array.from(new Set(tags.filter(Boolean)));
}

function buildTransitHits(
  chartA: ChartResult,
  chartB: ChartResult,
  now: Date,
  settings: ChartSettings
): TransitHit[] {
  const aspectDefs = resolveAspectDefinitions(settings);
  const orbMultiplier = getOrbMultiplier(settings.orbMode);
  const transitLongitudes = getTransitLongitudes(now);
  const hits: TransitHit[] = [];
  const charts: Array<{ ref: ChartRef; chart: ChartResult }> = [
    { ref: "A", chart: chartA },
    { ref: "B", chart: chartB },
  ];

  for (const transitPlanet of PLANETS) {
    const transitLongitude = transitLongitudes[transitPlanet];
    for (const target of charts) {
      for (const natalPlanet of PLANETS) {
        const natalLongitude = getPlanetLongitude(target.chart, natalPlanet);
        const separation = separationDegrees(transitLongitude, natalLongitude);
        const aspect = detectAspect(separation, aspectDefs, orbMultiplier);
        if (!aspect) continue;

        const stat = pickDominantStat(transitPlanet, natalPlanet);
        const exactness = Math.max(0, 1 - aspect.orb / aspect.maxOrb);
        const baseStrength = getBaseImpact(aspect.type) * (0.15 + exactness);
        const statBoost = 1 + (STAT_WEIGHTS[transitPlanet][stat] + STAT_WEIGHTS[natalPlanet][stat]) / 12;
        const weightedStrength = baseStrength * statBoost;

        hits.push({
          key: `${transitPlanet}-${aspect.type}-${target.ref}-${natalPlanet}`,
          chartRef: target.ref,
          transitPlanet,
          natalPlanet,
          aspectType: aspect.type,
          orb: Math.round(aspect.orb * 10) / 10,
          exactness,
          stat,
          opportunityScore: weightedStrength * getOpportunityFactor(aspect.type),
          watchoutScore: weightedStrength * getWatchoutFactor(aspect.type),
        });
      }
    }
  }

  return hits;
}

function getDuoLabel(locale: TransitLocale, duoMode: DuoMode): string {
  if (locale === "en") return duoMode === "friend" ? "friendship" : "relationship";
  return duoMode === "friend" ? "amizade" : "relacao";
}

function buildInsightDetails(
  hit: TransitHit,
  kind: TransitKind,
  locale: TransitLocale,
  duoMode: DuoMode
): DetailBlock[] {
  const statLabel = STAT_LABELS[locale][hit.stat];
  const duoLabel = getDuoLabel(locale, duoMode);
  const exactnessPercent = Math.round(hit.exactness * 100);
  const personLabel = PERSON_LABELS[locale][hit.chartRef];
  const aspectLabel = getAspectLabel(locale, hit.aspectType);

  if (locale === "en") {
    if (kind === "opportunity") {
      return [
        {
          title: "Signal",
          text: `${hit.transitPlanet} ${aspectLabel} ${personLabel}'s ${hit.natalPlanet} is ${exactnessPercent}% exact right now.`,
        },
        {
          title: "Best Use Today",
          text: `Lean into ${statLabel.toLowerCase()} while this transit is active in your ${duoLabel}.`,
        },
        {
          title: "Risk If Ignored",
          text: "Good timing can fade quickly if no concrete action is taken today.",
        },
        {
          title: "Micro Action",
          text: "Set one shared action for today and close it before midnight.",
        },
      ];
    }

    return [
      {
        title: "Pressure Signal",
        text: `${hit.transitPlanet} ${aspectLabel} ${personLabel}'s ${hit.natalPlanet} can trigger reactive patterns.`,
      },
      {
        title: "Main Risk",
        text: `${statLabel} becomes the weakest lane if expectations stay implicit.`,
      },
      {
        title: "How To Defuse",
        text: "Use short, explicit agreements before discussing sensitive points.",
      },
      {
        title: "Micro Action",
        text: "Do one 10-minute check-in and confirm the next concrete step.",
      },
    ];
  }

  if (kind === "opportunity") {
    return [
      {
        title: "Sinal do dia",
        text: `${hit.transitPlanet} ${aspectLabel} com ${hit.natalPlanet} de ${personLabel} ta ${exactnessPercent}% exato agora.`,
      },
      {
        title: "Melhor uso hoje",
        text: `Aproveita pra fortalecer ${statLabel.toLowerCase()} nessa ${duoLabel}.`,
      },
      {
        title: "Risco se vacilar",
        text: "Se deixar no automatico, essa janela boa passa rapido.",
      },
      {
        title: "Micro-acao",
        text: "Fecha uma acao conjunta hoje e conclui ainda hoje.",
      },
    ];
  }

  return [
    {
      title: "Sinal de pressao",
      text: `${hit.transitPlanet} ${aspectLabel} com ${hit.natalPlanet} de ${personLabel} pode puxar reatividade.`,
    },
    {
      title: "Risco principal",
      text: `${statLabel} vira ponto fraco se ficar tudo no nao dito.`,
    },
    {
      title: "Como desarmar",
      text: "Faz combinado curto e direto antes de entrar em assunto sensivel.",
    },
    {
      title: "Micro-acao",
      text: "Roda um check-in de 10 minutos e confirma o proximo passo objetivo.",
    },
  ];
}

function buildInsight(
  hit: TransitHit,
  kind: TransitKind,
  locale: TransitLocale,
  duoMode: DuoMode
): TransitInsight {
  const statLabel = STAT_LABELS[locale][hit.stat];
  const aspectLabel = getAspectLabel(locale, hit.aspectType);
  const personLabel = PERSON_LABELS[locale][hit.chartRef];
  const duoLabel = getDuoLabel(locale, duoMode);

  if (locale === "en") {
    const title = kind === "opportunity" ? `${statLabel} Boost Window` : `${statLabel} Pressure Point`;
    const subtitle = `${PLANET_SYMBOL[hit.transitPlanet]} ${hit.transitPlanet} ${ASPECT_SYMBOL[hit.aspectType]} ${PLANET_SYMBOL[hit.natalPlanet]} ${hit.natalPlanet} · ${personLabel}`;
    const text =
      kind === "opportunity"
        ? `Transit ${hit.transitPlanet} ${aspectLabel} ${personLabel}'s ${hit.natalPlanet} opens a practical lane for ${statLabel.toLowerCase()} in your ${duoLabel}.`
        : `Transit ${hit.transitPlanet} ${aspectLabel} ${personLabel}'s ${hit.natalPlanet} can create friction around ${statLabel.toLowerCase()} in your ${duoLabel}.`;

    return {
      key: `${kind}-${hit.key}`,
      kind,
      title,
      subtitle,
      text,
      tags: dedupeTags([
        statLabel.toLowerCase(),
        aspectLabel.toLowerCase(),
        kind,
        personLabel.toLowerCase().replace(/\s+/g, "-"),
      ]),
      details: buildInsightDetails(hit, kind, locale, duoMode),
      tone: kind === "opportunity" ? "harmonious" : "challenging",
      orb: hit.orb,
    };
  }

  const title = kind === "opportunity" ? `Janela de ${statLabel}` : `Pressao em ${statLabel}`;
  const subtitle = `${PLANET_SYMBOL[hit.transitPlanet]} ${hit.transitPlanet} ${ASPECT_SYMBOL[hit.aspectType]} ${PLANET_SYMBOL[hit.natalPlanet]} ${hit.natalPlanet} · ${personLabel}`;
  const text =
    kind === "opportunity"
      ? `Transito de ${hit.transitPlanet} em ${aspectLabel} com ${hit.natalPlanet} de ${personLabel} abre uma boa janela pra ${statLabel.toLowerCase()} nessa ${duoLabel}.`
      : `Transito de ${hit.transitPlanet} em ${aspectLabel} com ${hit.natalPlanet} de ${personLabel} pode puxar atrito em ${statLabel.toLowerCase()} nessa ${duoLabel}.`;

  return {
    key: `${kind}-${hit.key}`,
    kind,
    title,
    subtitle,
    text,
    tags: dedupeTags([
      statLabel.toLowerCase(),
      aspectLabel.toLowerCase(),
      kind === "opportunity" ? "oportunidade" : "atencao",
      personLabel.toLowerCase().replace(/\s+/g, "-"),
    ]),
    details: buildInsightDetails(hit, kind, locale, duoMode),
    tone: kind === "opportunity" ? "harmonious" : "challenging",
    orb: hit.orb,
  };
}

function buildFallbackInsight(kind: TransitKind, locale: TransitLocale, duoMode: DuoMode): TransitInsight {
  const duoLabel = getDuoLabel(locale, duoMode);
  if (locale === "en") {
    return kind === "opportunity"
      ? {
          key: "opportunity-fallback",
          kind,
          title: "Steady Window",
          subtitle: "No tight transit right now",
          text: `No strong transit is exact at the moment. Use the day to keep your ${duoLabel} cadence stable.`,
          tags: ["steady", "timing", "opportunity"],
          details: [
            {
              title: "Move",
              text: "Do one small commitment together and finish it today.",
            },
          ],
          tone: "harmonious",
          orb: 0,
        }
      : {
          key: "watchout-fallback",
          kind,
          title: "Baseline Risk Control",
          subtitle: "No high-pressure transit right now",
          text: `No high-pressure transit is exact now. Keep communication explicit to protect your ${duoLabel}.`,
          tags: ["baseline", "risk", "watchout"],
          details: [
            {
              title: "Move",
              text: "Run a short alignment check before making assumptions.",
            },
          ],
          tone: "challenging",
          orb: 0,
        };
  }

  return kind === "opportunity"
    ? {
        key: "opportunity-fallback",
        kind,
        title: "Janela estavel",
        subtitle: "Sem transito apertado agora",
        text: `Sem transito forte exato agora. Usa o dia pra manter o ritmo da ${duoLabel}.`,
        tags: ["estavel", "timing", "oportunidade"],
        details: [
          {
            title: "Passo",
            text: "Fecha um compromisso pequeno hoje e conclui hoje.",
          },
        ],
        tone: "harmonious",
        orb: 0,
      }
    : {
        key: "watchout-fallback",
        kind,
        title: "Controle de risco basico",
        subtitle: "Sem transito de alta pressao agora",
        text: `Sem transito de alta pressao exato agora. Mantem comunicacao clara pra proteger a ${duoLabel}.`,
        tags: ["base", "risco", "atencao"],
        details: [
          {
            title: "Passo",
            text: "Faz um mini alinhamento antes de tirar conclusao.",
          },
        ],
        tone: "challenging",
        orb: 0,
      };
}

function formatDateLabel(now: Date, locale: TransitLocale, timeZone: string): string {
  const formatterLocale = locale === "pt" ? "pt-BR" : "en-US";
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  };
  try {
    return new Intl.DateTimeFormat(formatterLocale, options).format(now);
  } catch {
    return new Intl.DateTimeFormat(formatterLocale, {
      ...options,
      timeZone: "UTC",
    }).format(now);
  }
}

export function buildDailyTransitOutlook(
  chartA: ChartResult,
  chartB: ChartResult,
  options: BuildTransitOptions = {}
): DailyTransitOutlook {
  const locale = options.locale ?? "pt";
  const duoMode = options.duoMode ?? "romantic";
  const now = options.now ?? new Date();
  const settings = normalizeChartSettings(chartA.settings ?? chartB.settings);
  const hits = buildTransitHits(chartA, chartB, now, settings);

  const byOpportunity = [...hits].sort((left, right) => {
    if (right.opportunityScore !== left.opportunityScore) {
      return right.opportunityScore - left.opportunityScore;
    }
    return left.orb - right.orb;
  });

  const byWatchout = [...hits].sort((left, right) => {
    if (right.watchoutScore !== left.watchoutScore) {
      return right.watchoutScore - left.watchoutScore;
    }
    return left.orb - right.orb;
  });

  const opportunityHit = byOpportunity[0];
  const watchoutHit =
    byWatchout.find((hit) => hit.key !== opportunityHit?.key) ?? byWatchout[0];

  return {
    generatedAt: now.toISOString(),
    dateLabel: formatDateLabel(now, locale, chartA.normalized.timezone),
    opportunity: opportunityHit
      ? buildInsight(opportunityHit, "opportunity", locale, duoMode)
      : buildFallbackInsight("opportunity", locale, duoMode),
    watchout: watchoutHit
      ? buildInsight(watchoutHit, "watchout", locale, duoMode)
      : buildFallbackInsight("watchout", locale, duoMode),
  };
}

// ---------------------------------------------------------------------------
// Transit theme + calendar helpers (used by TransitsView)
// ---------------------------------------------------------------------------

export interface TransitThemeEntry {
  key: string;
  label: string;
  count: number;
  bestOrb: number;
}

export interface TransitExactHitDayGroup {
  date: string;
  hits: TransitRangeResult["exactHits"];
}

export function buildTransitThemes(
  feed: TransitRangeResult | null,
  windowDays: number,
  isCarioca: boolean
): TransitThemeEntry[] {
  if (!feed || feed.days.length === 0 || feed.exactHits.length === 0) return [];
  const windowDates = new Set(feed.days.slice(0, Math.max(1, windowDays)).map((day) => day.date));
  const map = new Map<string, TransitThemeEntry>();
  for (const hit of feed.exactHits) {
    if (!windowDates.has(hit.date)) continue;
    const key = `${hit.transitPlanet}-${hit.aspect}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      if (hit.orb < existing.bestOrb) existing.bestOrb = hit.orb;
      continue;
    }
    map.set(key, {
      key,
      label: isCarioca
        ? `${hit.transitPlanet} ${hit.aspect}: foco em ${hit.natalPlanet}`
        : `${hit.transitPlanet} ${hit.aspect}: focus on ${hit.natalPlanet}`,
      count: 1,
      bestOrb: hit.orb,
    });
  }
  return Array.from(map.values())
    .sort((left, right) => right.count - left.count || left.bestOrb - right.bestOrb)
    .slice(0, 4);
}

export function groupExactHitsByDate(feed: TransitRangeResult | null): TransitExactHitDayGroup[] {
  if (!feed || feed.exactHits.length === 0) return [];
  const map = new Map<string, TransitRangeResult["exactHits"]>();
  for (const hit of feed.exactHits) {
    const list = map.get(hit.date) ?? [];
    list.push(hit);
    map.set(hit.date, list);
  }
  return Array.from(map.entries())
    .map(([date, hits]) => ({
      date,
      hits: [...hits].sort((left, right) => left.orb - right.orb),
    }))
    .sort((left, right) => left.date.localeCompare(right.date));
}
