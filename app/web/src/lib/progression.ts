import { ASPECT_SYMBOL, PLANET_SYMBOL } from "./constants";
import type {
  AspectName,
  AspectTone,
  ChartComparison,
  ComparisonAspect,
  DetailBlock,
  DuoMode,
  PlanetName,
  SynastryStatKey,
} from "./types";

export type ProgressionLocale = "pt" | "en";

export interface ProgressionState {
  xp: number;
  streak: number;
  lastCompletionDay?: string;
  completedQuestIds: string[];
  reflectedQuestIds: string[];
}

export interface RelationshipQuest {
  id: string;
  dayKey: string;
  title: string;
  subtitle: string;
  text: string;
  tags: readonly string[];
  details: readonly DetailBlock[];
  tone: AspectTone;
  focusStat: SynastryStatKey;
  focusStatLabel: string;
  sourceAspect: ComparisonAspect;
}

interface BuildQuestOptions {
  locale?: ProgressionLocale;
  duoMode?: DuoMode;
  now?: Date;
  timeZone?: string;
}

export const QUEST_COMPLETION_XP = 40;
export const QUEST_REFLECTION_XP = 20;
const TRACKED_QUEST_IDS_LIMIT = 160;
const DETAIL_UNLOCK_THRESHOLDS = [0, 80, 180, 320] as const;

export const DEFAULT_PROGRESSION_STATE: ProgressionState = {
  xp: 0,
  streak: 0,
  completedQuestIds: [],
  reflectedQuestIds: [],
};

const ASPECT_LABELS: Record<ProgressionLocale, Record<AspectName, string>> = {
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

const STAT_LABELS: Record<ProgressionLocale, Record<SynastryStatKey, string>> = {
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

function dayKeyToOrdinal(dayKey: string): number | null {
  const [year, month, day] = dayKey.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function isConsecutiveDay(previousDay: string, currentDay: string): boolean {
  const previousOrdinal = dayKeyToOrdinal(previousDay);
  const currentOrdinal = dayKeyToOrdinal(currentDay);
  if (previousOrdinal == null || currentOrdinal == null) return false;
  return currentOrdinal - previousOrdinal === 1;
}

function trimIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids)).slice(0, TRACKED_QUEST_IDS_LIMIT);
}

function dedupeTags(tags: readonly string[]): string[] {
  return Array.from(new Set(tags.filter(Boolean)));
}

function getAspectTone(type: AspectName): AspectTone {
  if (type === "Trine" || type === "Sextile") return "harmonious";
  if (type === "Square" || type === "Opposition") return "challenging";
  return "intense";
}

function pickQuestAspect(aspects: readonly ComparisonAspect[]): ComparisonAspect | null {
  const challenging = aspects.find(
    (aspect) => aspect.type === "Square" || aspect.type === "Opposition"
  );
  if (challenging) return challenging;
  const intense = aspects.find((aspect) => aspect.type === "Conjunction");
  if (intense) return intense;
  return aspects[0] ?? null;
}

function pickFocusStat(aspect: ComparisonAspect): SynastryStatKey {
  const stats: SynastryStatKey[] = ["attraction", "communication", "stability", "growth"];
  let winner: SynastryStatKey = "growth";
  let winnerScore = Number.NEGATIVE_INFINITY;
  for (const stat of stats) {
    const score =
      (STAT_WEIGHTS[aspect.a.planet][stat] ?? 0) +
      (STAT_WEIGHTS[aspect.b.planet][stat] ?? 0);
    if (score > winnerScore) {
      winnerScore = score;
      winner = stat;
    }
  }
  return winner;
}

function getDuoLabel(locale: ProgressionLocale, duoMode: DuoMode): string {
  if (locale === "en") return duoMode === "friend" ? "friendship" : "relationship";
  return duoMode === "friend" ? "amizade" : "relacao";
}

export function getLocalDayKey(now: Date, timeZone: string): string {
  const formatter = (zone: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  try {
    const parts = formatter(timeZone).formatToParts(now);
    const year = parts.find((part) => part.type === "year")?.value ?? "0000";
    const month = parts.find((part) => part.type === "month")?.value ?? "01";
    const day = parts.find((part) => part.type === "day")?.value ?? "01";
    return `${year}-${month}-${day}`;
  } catch {
    const parts = formatter("UTC").formatToParts(now);
    const year = parts.find((part) => part.type === "year")?.value ?? "0000";
    const month = parts.find((part) => part.type === "month")?.value ?? "01";
    const day = parts.find((part) => part.type === "day")?.value ?? "01";
    return `${year}-${month}-${day}`;
  }
}

export function getDetailUnlockCount(xp: number): number {
  if (xp >= DETAIL_UNLOCK_THRESHOLDS[3]) return 4;
  if (xp >= DETAIL_UNLOCK_THRESHOLDS[2]) return 3;
  if (xp >= DETAIL_UNLOCK_THRESHOLDS[1]) return 2;
  return 1;
}

export function getNextDetailUnlockXp(xp: number): number | null {
  for (const threshold of DETAIL_UNLOCK_THRESHOLDS.slice(1)) {
    if (xp < threshold) return threshold;
  }
  return null;
}

export function hasCompletedQuest(state: ProgressionState, questId: string): boolean {
  return state.completedQuestIds.includes(questId);
}

export function hasReflectedQuest(state: ProgressionState, questId: string): boolean {
  return state.reflectedQuestIds.includes(questId);
}

export function awardQuestCompletion(
  state: ProgressionState,
  questId: string,
  dayKey: string
): ProgressionState {
  if (state.completedQuestIds.includes(questId)) return state;
  let nextStreak = 1;
  if (state.lastCompletionDay === dayKey) {
    nextStreak = Math.max(1, state.streak);
  } else if (state.lastCompletionDay && isConsecutiveDay(state.lastCompletionDay, dayKey)) {
    nextStreak = Math.max(1, state.streak) + 1;
  }
  return {
    ...state,
    xp: Math.max(0, state.xp) + QUEST_COMPLETION_XP,
    streak: nextStreak,
    lastCompletionDay: dayKey,
    completedQuestIds: trimIds([questId, ...state.completedQuestIds]),
  };
}

export function awardQuestReflection(
  state: ProgressionState,
  questId: string
): ProgressionState {
  if (!state.completedQuestIds.includes(questId)) return state;
  if (state.reflectedQuestIds.includes(questId)) return state;
  return {
    ...state,
    xp: Math.max(0, state.xp) + QUEST_REFLECTION_XP,
    reflectedQuestIds: trimIds([questId, ...state.reflectedQuestIds]),
  };
}

export function buildRelationshipQuest(
  comparison: ChartComparison,
  options: BuildQuestOptions = {}
): RelationshipQuest | null {
  const locale = options.locale ?? "pt";
  const duoMode = options.duoMode ?? "romantic";
  const now = options.now ?? new Date();
  const timeZone = options.timeZone ?? comparison.chartA.normalized.timezone;

  const sourceAspect = pickQuestAspect(comparison.aspects ?? []);
  if (!sourceAspect) return null;

  const dayKey = getLocalDayKey(now, timeZone);
  const focusStat = pickFocusStat(sourceAspect);
  const focusStatLabel = STAT_LABELS[locale][focusStat];
  const aspectLabel = ASPECT_LABELS[locale][sourceAspect.type];
  const duoLabel = getDuoLabel(locale, duoMode);
  const tone = getAspectTone(sourceAspect.type);

  const id = [
    dayKey,
    duoMode,
    sourceAspect.type,
    sourceAspect.a.planet,
    sourceAspect.b.planet,
    comparison.chartA.normalized.utcDateTime,
    comparison.chartB.normalized.utcDateTime,
  ].join("|");

  const subtitle = `${PLANET_SYMBOL[sourceAspect.a.planet]} ${sourceAspect.a.planet} ${ASPECT_SYMBOL[sourceAspect.type]} ${PLANET_SYMBOL[sourceAspect.b.planet]} ${sourceAspect.b.planet} · ${aspectLabel}`;
  const title =
    locale === "en"
      ? `Relationship Quest · ${focusStatLabel}`
      : `Missao da dupla · ${focusStatLabel}`;
  const text =
    locale === "en"
      ? `${aspectLabel} is your active pressure lane. Convert it into a practical win for ${focusStatLabel.toLowerCase()} in your ${duoLabel}.`
      : `${aspectLabel} e tua pista de pressao ativa. Transforma isso em ganho pratico pra ${focusStatLabel.toLowerCase()} nessa ${duoLabel}.`;

  const details: DetailBlock[] =
    locale === "en"
      ? [
          {
            title: "Trigger",
            text: `${sourceAspect.a.planet} ${aspectLabel} ${sourceAspect.b.planet} can create friction if plans stay vague.`,
          },
          {
            title: "Quest",
            text: "Define one shared 15-minute action and execute it before the day ends.",
          },
          {
            title: "XP Rule",
            text: "Mark quest complete for +40 XP. Add reflection for +20 XP.",
          },
          {
            title: "Reflection Prompt",
            text: `What shifted in ${focusStatLabel.toLowerCase()} after this micro-action?`,
          },
        ]
      : [
          {
            title: "Gatilho",
            text: `${sourceAspect.a.planet} ${aspectLabel} ${sourceAspect.b.planet} pode virar atrito se ficar tudo no improviso.`,
          },
          {
            title: "Missao",
            text: "Define uma acao conjunta de 15 minutos e conclui antes do fim do dia.",
          },
          {
            title: "Regra de XP",
            text: "Marca missao concluida pra ganhar +40 XP. Registra reflexao pra +20 XP.",
          },
          {
            title: "Pergunta de reflexao",
            text: `O que mudou em ${focusStatLabel.toLowerCase()} depois dessa micro-acao?`,
          },
        ];

  return {
    id,
    dayKey,
    title,
    subtitle,
    text,
    tags: dedupeTags([
      focusStatLabel.toLowerCase(),
      aspectLabel.toLowerCase(),
      tone,
      duoLabel,
    ]),
    details,
    tone,
    focusStat,
    focusStatLabel,
    sourceAspect,
  };
}
