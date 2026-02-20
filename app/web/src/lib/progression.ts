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
  unlockedInsights: UnlockedInsight[];
}

export interface UnlockedInsight {
  id: string;
  dayKey: string;
  source: "mission" | "reflection";
  title: string;
  text: string;
  tags: readonly string[];
  tone: AspectTone;
  createdAt: string;
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
export const ADVANCED_OVERLAYS_UNLOCK_XP = 420;
export const ADVANCED_OVERLAYS_UNLOCK_MISSIONS = 6;
const TRACKED_QUEST_IDS_LIMIT = 160;
const TRACKED_UNLOCKED_INSIGHTS_LIMIT = 48;
const DETAIL_UNLOCK_THRESHOLDS = [0, 80, 180, 320] as const;
const DETAIL_UNLOCK_MISSION_THRESHOLDS = [0, 1, 3, 5] as const;
const DAILY_MISSION_PREFIX = "daily-mission:";

export const DEFAULT_PROGRESSION_STATE: ProgressionState = {
  xp: 0,
  streak: 0,
  completedQuestIds: [],
  reflectedQuestIds: [],
  unlockedInsights: [],
};

const ASPECT_LABELS: Record<ProgressionLocale, Partial<Record<AspectName, string>>> = {
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

function getAspectLabel(locale: ProgressionLocale, type: AspectName): string {
  return ASPECT_LABELS[locale][type] ?? type;
}

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

function trimUnlockedInsights(items: readonly UnlockedInsight[]): UnlockedInsight[] {
  return items.slice(0, TRACKED_UNLOCKED_INSIGHTS_LIMIT);
}

function dedupeTags(tags: readonly string[]): string[] {
  return Array.from(new Set(tags.filter(Boolean)));
}

function getAspectTone(type: AspectName): AspectTone {
  if (
    type === "Trine" ||
    type === "Sextile" ||
    type === "Semisextile" ||
    type === "Quintile" ||
    type === "Biquintile"
  ) {
    return "harmonious";
  }
  if (
    type === "Square" ||
    type === "Opposition" ||
    type === "Semisquare" ||
    type === "Sesquiquadrate" ||
    type === "Quincunx"
  ) {
    return "challenging";
  }
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

function getLegacyMissionCountFromXp(xp: number): number {
  if (xp >= ADVANCED_OVERLAYS_UNLOCK_XP) return ADVANCED_OVERLAYS_UNLOCK_MISSIONS;
  if (xp >= DETAIL_UNLOCK_THRESHOLDS[3]) return DETAIL_UNLOCK_MISSION_THRESHOLDS[3];
  if (xp >= DETAIL_UNLOCK_THRESHOLDS[2]) return DETAIL_UNLOCK_MISSION_THRESHOLDS[2];
  if (xp >= DETAIL_UNLOCK_THRESHOLDS[1]) return DETAIL_UNLOCK_MISSION_THRESHOLDS[1];
  return 0;
}

function getDailyMissionDayKey(questId: string): string | null {
  if (!questId.startsWith(DAILY_MISSION_PREFIX)) return null;
  const dayKey = questId.slice(DAILY_MISSION_PREFIX.length);
  return /^\d{4}-\d{2}-\d{2}$/.test(dayKey) ? dayKey : null;
}

export function getDailyMissionId(dayKey: string): string {
  return `${DAILY_MISSION_PREFIX}${dayKey}`;
}

export function hasCompletedMissionDay(state: ProgressionState, dayKey: string): boolean {
  return state.completedQuestIds.includes(getDailyMissionId(dayKey));
}

export function hasReflectedMissionDay(state: ProgressionState, dayKey: string): boolean {
  return state.reflectedQuestIds.includes(getDailyMissionId(dayKey));
}

export function getMissionCompletionCount(state: ProgressionState): number {
  const missionDays = new Set(
    state.completedQuestIds
      .map(getDailyMissionDayKey)
      .filter((dayKey): dayKey is string => dayKey != null)
  );
  return Math.max(missionDays.size, getLegacyMissionCountFromXp(state.xp));
}

export function getDetailUnlockCountByMissions(completedMissionCount: number): number {
  if (completedMissionCount >= DETAIL_UNLOCK_MISSION_THRESHOLDS[3]) return 4;
  if (completedMissionCount >= DETAIL_UNLOCK_MISSION_THRESHOLDS[2]) return 3;
  if (completedMissionCount >= DETAIL_UNLOCK_MISSION_THRESHOLDS[1]) return 2;
  return 1;
}

export function getNextDetailUnlockMissionCount(completedMissionCount: number): number | null {
  for (const threshold of DETAIL_UNLOCK_MISSION_THRESHOLDS.slice(1)) {
    if (completedMissionCount < threshold) return threshold;
  }
  return null;
}

export function isAdvancedOverlaysUnlockedByMissions(completedMissionCount: number): boolean {
  return completedMissionCount >= ADVANCED_OVERLAYS_UNLOCK_MISSIONS;
}

export function getAdvancedOverlaysUnlockMissionCount(completedMissionCount: number): number | null {
  if (isAdvancedOverlaysUnlockedByMissions(completedMissionCount)) return null;
  return ADVANCED_OVERLAYS_UNLOCK_MISSIONS;
}

function toHashSeed(text: string): number {
  let seed = 0;
  for (let index = 0; index < text.length; index += 1) {
    seed = (seed * 31 + text.charCodeAt(index)) >>> 0;
  }
  return seed;
}

function pickCandidate(entries: readonly string[], seed: number): string | null {
  if (entries.length === 0) return null;
  return entries[seed % entries.length];
}

export function buildUnlockedInsight(
  comparison: ChartComparison,
  quest: RelationshipQuest,
  source: "mission" | "reflection",
  locale: ProgressionLocale = quest.title.includes("Missao") ? "pt" : "en",
  now: Date = new Date()
): UnlockedInsight {
  const pool = [
    quest.text,
    ...quest.details.map((detail) => `${detail.title}: ${detail.text}`),
    ...comparison.highlights.slice(0, 4).map((highlight) => highlight.text),
    ...comparison.highlights
      .slice(0, 3)
      .flatMap((highlight) =>
        (highlight.details ?? [])
          .slice(0, 2)
          .map((detail) => `${detail.title}: ${detail.text}`)
      ),
  ].filter((entry) => entry.trim().length > 0);
  const seed = toHashSeed(`${quest.id}|${source}`);
  const text = pickCandidate(pool, seed) ?? quest.text;
  const sourceLabel =
    locale === "pt"
      ? source === "mission" ? "Missao" : "Reflexao"
      : source === "mission" ? "Mission" : "Reflection";
  return {
    id: `${quest.dayKey}|${source}|${seed.toString(16)}`,
    dayKey: quest.dayKey,
    source,
    title: `${sourceLabel} Insight · ${quest.focusStatLabel}`,
    text,
    tags: dedupeTags([source, quest.focusStatLabel.toLowerCase(), ...quest.tags.slice(0, 2)]),
    tone: quest.tone,
    createdAt: now.toISOString(),
  };
}

function appendUnlockedInsight(
  state: ProgressionState,
  insight: UnlockedInsight | null
): ProgressionState["unlockedInsights"] {
  if (!insight) return state.unlockedInsights;
  if (state.unlockedInsights.some((entry) => entry.id === insight.id)) {
    return state.unlockedInsights;
  }
  return trimUnlockedInsights([insight, ...state.unlockedInsights]);
}

export function getNextDetailUnlockXp(xp: number): number | null {
  for (const threshold of DETAIL_UNLOCK_THRESHOLDS.slice(1)) {
    if (xp < threshold) return threshold;
  }
  return null;
}

export function isAdvancedOverlaysUnlocked(xp: number): boolean {
  return xp >= ADVANCED_OVERLAYS_UNLOCK_XP;
}

export function getAdvancedOverlaysUnlockXp(xp: number): number | null {
  if (xp >= ADVANCED_OVERLAYS_UNLOCK_XP) return null;
  return ADVANCED_OVERLAYS_UNLOCK_XP;
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

export function awardDailyMissionCompletion(
  state: ProgressionState,
  dayKey: string,
  insight: UnlockedInsight | null = null
): ProgressionState {
  const missionId = getDailyMissionId(dayKey);
  if (state.completedQuestIds.includes(missionId)) return state;
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
    completedQuestIds: trimIds([missionId, ...state.completedQuestIds]),
    unlockedInsights: appendUnlockedInsight(state, insight),
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

export function awardDailyMissionReflection(
  state: ProgressionState,
  dayKey: string,
  insight: UnlockedInsight | null = null
): ProgressionState {
  const missionId = getDailyMissionId(dayKey);
  if (!state.completedQuestIds.includes(missionId)) return state;
  if (state.reflectedQuestIds.includes(missionId)) return state;
  return {
    ...state,
    xp: Math.max(0, state.xp) + QUEST_REFLECTION_XP,
    reflectedQuestIds: trimIds([missionId, ...state.reflectedQuestIds]),
    unlockedInsights: appendUnlockedInsight(state, insight),
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
  const aspectLabel = getAspectLabel(locale, sourceAspect.type);
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
            title: "Mission Reward",
            text: "Generate one compatibility chart per day to complete mission. Add reflection for a bonus insight.",
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
            title: "Recompensa da missao",
            text: "Gera um mapa de compatibilidade por dia pra concluir a missao. Reflexao libera insight bonus.",
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
