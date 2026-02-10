import type { ChartResult, DuoMode } from "./types";
import {
  DEFAULT_PROGRESSION_STATE,
  type ProgressionState,
} from "./progression";

export type PersistedAnalysisMode = "single" | "compatibility";

export interface PersistedPersonState {
  date: string;
  time: string;
  daylightSaving: boolean | "auto";
  locationInput: string;
}

export interface PersistedHistoryEntry {
  id: string;
  createdAt: string;
  analysisMode: PersistedAnalysisMode;
  duoMode: DuoMode;
  chartA: ChartResult;
  chartB?: ChartResult;
}

export interface PersistedAppState {
  analysisMode: PersistedAnalysisMode;
  duoMode: DuoMode;
  personA: PersistedPersonState;
  personB: PersistedPersonState;
  lastChartA?: ChartResult;
  lastChartB?: ChartResult;
  history: PersistedHistoryEntry[];
  progression: ProgressionState;
}

export const APP_STATE_STORAGE_KEY = "stellar-app-state-v1";
export const HISTORY_LIMIT = 12;
const PROGRESSION_IDS_LIMIT = 160;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAnalysisMode(value: unknown): value is PersistedAnalysisMode {
  return value === "single" || value === "compatibility";
}

function isDuoMode(value: unknown): value is DuoMode {
  return value === "romantic" || value === "friend";
}

function isChartResult(value: unknown): value is ChartResult {
  if (!isObject(value)) return false;
  return (
    isObject(value.input) &&
    isObject(value.normalized) &&
    isObject(value.planets) &&
    Array.isArray(value.aspects)
  );
}

function normalizePersonState(value: unknown, fallbackLocation: string): PersistedPersonState {
  if (!isObject(value)) {
    return {
      date: "1990-01-01",
      time: "12:00",
      daylightSaving: "auto",
      locationInput: fallbackLocation,
    };
  }
  return {
    date: typeof value.date === "string" ? value.date : "1990-01-01",
    time: typeof value.time === "string" ? value.time : "12:00",
    daylightSaving:
      value.daylightSaving === true || value.daylightSaving === false || value.daylightSaving === "auto"
        ? value.daylightSaving
        : "auto",
    locationInput: typeof value.locationInput === "string" && value.locationInput.trim().length > 0
      ? value.locationInput
      : fallbackLocation,
  };
}

function normalizeHistory(value: unknown): PersistedHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  const normalized: PersistedHistoryEntry[] = [];
  for (const entry of value) {
    if (!isObject(entry)) continue;
    if (typeof entry.id !== "string" || typeof entry.createdAt !== "string") continue;
    if (!isAnalysisMode(entry.analysisMode) || !isDuoMode(entry.duoMode)) continue;
    if (!isChartResult(entry.chartA)) continue;
    if (entry.chartB != null && !isChartResult(entry.chartB)) continue;
    normalized.push({
      id: entry.id,
      createdAt: entry.createdAt,
      analysisMode: entry.analysisMode,
      duoMode: entry.duoMode,
      chartA: entry.chartA,
      chartB: entry.chartB ?? undefined,
    });
    if (normalized.length >= HISTORY_LIMIT) break;
  }
  return normalized;
}

function normalizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0))
  ).slice(0, PROGRESSION_IDS_LIMIT);
}

function normalizeProgression(value: unknown): ProgressionState {
  if (!isObject(value)) {
    return {
      ...DEFAULT_PROGRESSION_STATE,
      completedQuestIds: [],
      reflectedQuestIds: [],
    };
  }
  return {
    xp:
      typeof value.xp === "number" && Number.isFinite(value.xp) && value.xp >= 0
        ? Math.round(value.xp)
        : 0,
    streak:
      typeof value.streak === "number" && Number.isFinite(value.streak) && value.streak >= 0
        ? Math.round(value.streak)
        : 0,
    lastCompletionDay:
      typeof value.lastCompletionDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.lastCompletionDay)
        ? value.lastCompletionDay
        : undefined,
    completedQuestIds: normalizeIdList(value.completedQuestIds),
    reflectedQuestIds: normalizeIdList(value.reflectedQuestIds),
  };
}

export function readPersistedAppState(): PersistedAppState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(APP_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) return null;

    const analysisMode = isAnalysisMode(parsed.analysisMode) ? parsed.analysisMode : "single";
    const duoMode = isDuoMode(parsed.duoMode) ? parsed.duoMode : "romantic";

    return {
      analysisMode,
      duoMode,
      personA: normalizePersonState(parsed.personA, "Rio de Janeiro, BR"),
      personB: normalizePersonState(parsed.personB, "New York, US"),
      lastChartA: isChartResult(parsed.lastChartA) ? parsed.lastChartA : undefined,
      lastChartB: isChartResult(parsed.lastChartB) ? parsed.lastChartB : undefined,
      history: normalizeHistory(parsed.history),
      progression: normalizeProgression(parsed.progression),
    };
  } catch {
    return null;
  }
}

export function writePersistedAppState(state: PersistedAppState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage failures
  }
}
