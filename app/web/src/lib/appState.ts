import type { ChartResult, ChartSettings, DuoMode, PrimaryArea } from "./types";
import { DEFAULT_CHART_SETTINGS, normalizeChartSettings } from "./constants";
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

export interface PersistedReminderRules {
  enabled: boolean;
  leadDays: number;
  maxOrb: number;
  lastSentKey?: string;
}

export interface PersistedAppState {
  primaryArea: PrimaryArea;
  analysisMode: PersistedAnalysisMode;
  duoMode: DuoMode;
  chartSettings: ChartSettings;
  timeTravelDate: string;
  transitDayPage: number;
  selectedTransitDate?: string;
  reminders: PersistedReminderRules;
  atlasInspectorInput: string;
  personA: PersistedPersonState;
  personB: PersistedPersonState;
  lastChartA?: ChartResult;
  lastChartB?: ChartResult;
  history: PersistedHistoryEntry[];
  progression: ProgressionState;
}

export const APP_STATE_STORAGE_KEY = "stellar-app-state-v1";
export const PRIVACY_SETTINGS_STORAGE_KEY = "stellar-privacy-settings-v1";
export const HISTORY_LIMIT = 12;
export const APP_STATE_RETENTION_DAYS = 30;
const PROGRESSION_IDS_LIMIT = 160;
const APP_STATE_MAX_AGE_MS = APP_STATE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const APP_STATE_SCHEMA_VERSION = 3;
const PRIVACY_SCHEMA_VERSION = 1;
const MAX_TRANSIT_PAGE = 36;
const DEFAULT_REMINDER_RULES: PersistedReminderRules = {
  enabled: false,
  leadDays: 1,
  maxOrb: 0.4,
};

export interface PersistedPrivacySettings {
  persistLocalData: boolean;
}

interface PersistedAppStateEnvelope {
  schemaVersion: number;
  updatedAt: string;
  state: PersistedAppState;
}

interface PersistedPrivacySettingsEnvelope {
  schemaVersion: number;
  updatedAt: string;
  persistLocalData: boolean;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAnalysisMode(value: unknown): value is PersistedAnalysisMode {
  return value === "single" || value === "compatibility";
}

function isDuoMode(value: unknown): value is DuoMode {
  return value === "romantic" || value === "friend";
}

function isPrimaryArea(value: unknown): value is PrimaryArea {
  return (
    value === "chart" ||
    value === "transits" ||
    value === "timing" ||
    value === "relationships" ||
    value === "atlas" ||
    value === "library"
  );
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

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed);
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
  const now = Date.now();
  const normalized: PersistedHistoryEntry[] = [];
  for (const entry of value) {
    if (!isObject(entry)) continue;
    if (typeof entry.id !== "string" || typeof entry.createdAt !== "string") continue;
    const createdAtMs = Date.parse(entry.createdAt);
    if (!Number.isFinite(createdAtMs)) continue;
    if (now - createdAtMs > APP_STATE_MAX_AGE_MS) continue;
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

function normalizeTransitDayPage(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_TRANSIT_PAGE, Math.round(value)));
}

function normalizeReminderRules(value: unknown): PersistedReminderRules {
  if (!isObject(value)) return { ...DEFAULT_REMINDER_RULES };
  const leadDays =
    typeof value.leadDays === "number" && Number.isFinite(value.leadDays)
      ? Math.max(0, Math.min(7, Math.round(value.leadDays)))
      : DEFAULT_REMINDER_RULES.leadDays;
  const maxOrb =
    typeof value.maxOrb === "number" && Number.isFinite(value.maxOrb)
      ? Math.max(0.1, Math.min(2, Math.round(value.maxOrb * 10) / 10))
      : DEFAULT_REMINDER_RULES.maxOrb;
  return {
    enabled: value.enabled === true,
    leadDays,
    maxOrb,
    lastSentKey: typeof value.lastSentKey === "string" ? value.lastSentKey : undefined,
  };
}

function normalizeAtlasInspectorInput(value: unknown, fallbackLocation: string): string {
  if (typeof value !== "string") return fallbackLocation;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallbackLocation;
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

function isExpired(updatedAt: string): boolean {
  const updatedAtMs = Date.parse(updatedAt);
  if (!Number.isFinite(updatedAtMs)) return true;
  return Date.now() - updatedAtMs > APP_STATE_MAX_AGE_MS;
}

function parsePersistedStatePayload(rawValue: unknown): unknown | null {
  if (!isObject(rawValue)) return null;
  if (
    typeof rawValue.schemaVersion === "number" &&
    typeof rawValue.updatedAt === "string" &&
    isObject(rawValue.state)
  ) {
    if (isExpired(rawValue.updatedAt)) return null;
    return rawValue.state;
  }
  return rawValue;
}

export function readPersistedAppState(): PersistedAppState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(APP_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    const payload = parsePersistedStatePayload(parsed);
    if (!payload || !isObject(payload)) {
      clearPersistedAppState();
      return null;
    }

    const analysisMode = isAnalysisMode(payload.analysisMode) ? payload.analysisMode : "single";
    const duoMode = isDuoMode(payload.duoMode) ? payload.duoMode : "romantic";
    const defaultTimeTravelDate = new Date().toISOString().slice(0, 10);

    const personA = normalizePersonState(payload.personA, "Rio de Janeiro, BR");
    const personB = normalizePersonState(payload.personB, "New York, US");

    return {
      primaryArea: isPrimaryArea(payload.primaryArea) ? payload.primaryArea : "chart",
      analysisMode,
      duoMode,
      chartSettings: normalizeChartSettings(
        isObject(payload.chartSettings) ? (payload.chartSettings as Partial<ChartSettings>) : DEFAULT_CHART_SETTINGS
      ),
      timeTravelDate: isIsoDate(payload.timeTravelDate) ? payload.timeTravelDate : defaultTimeTravelDate,
      transitDayPage: normalizeTransitDayPage(payload.transitDayPage),
      selectedTransitDate: isIsoDate(payload.selectedTransitDate) ? payload.selectedTransitDate : undefined,
      reminders: normalizeReminderRules(payload.reminders),
      atlasInspectorInput: normalizeAtlasInspectorInput(payload.atlasInspectorInput, personA.locationInput),
      personA,
      personB,
      lastChartA: isChartResult(payload.lastChartA) ? payload.lastChartA : undefined,
      lastChartB: isChartResult(payload.lastChartB) ? payload.lastChartB : undefined,
      history: normalizeHistory(payload.history),
      progression: normalizeProgression(payload.progression),
    };
  } catch {
    return null;
  }
}

export function writePersistedAppState(state: PersistedAppState) {
  if (typeof window === "undefined") return;
  try {
    const envelope: PersistedAppStateEnvelope = {
      schemaVersion: APP_STATE_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      state: {
        ...state,
        timeTravelDate: isIsoDate(state.timeTravelDate)
          ? state.timeTravelDate
          : new Date().toISOString().slice(0, 10),
        transitDayPage: normalizeTransitDayPage(state.transitDayPage),
        selectedTransitDate: isIsoDate(state.selectedTransitDate) ? state.selectedTransitDate : undefined,
        reminders: normalizeReminderRules(state.reminders),
        atlasInspectorInput: normalizeAtlasInspectorInput(state.atlasInspectorInput, state.personA.locationInput),
        history: normalizeHistory(state.history).slice(0, HISTORY_LIMIT),
      },
    };
    window.localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // ignore storage failures
  }
}

export function clearPersistedAppState() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(APP_STATE_STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
}

export function readPrivacySettings(): PersistedPrivacySettings {
  if (typeof window === "undefined") return { persistLocalData: true };
  try {
    const raw = window.localStorage.getItem(PRIVACY_SETTINGS_STORAGE_KEY);
    if (!raw) return { persistLocalData: true };
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) return { persistLocalData: true };
    if (typeof parsed.persistLocalData === "boolean") {
      return { persistLocalData: parsed.persistLocalData };
    }
    return { persistLocalData: true };
  } catch {
    return { persistLocalData: true };
  }
}

export function writePrivacySettings(settings: PersistedPrivacySettings) {
  if (typeof window === "undefined") return;
  try {
    const envelope: PersistedPrivacySettingsEnvelope = {
      schemaVersion: PRIVACY_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      persistLocalData: settings.persistLocalData,
    };
    window.localStorage.setItem(PRIVACY_SETTINGS_STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // ignore storage failures
  }
}
