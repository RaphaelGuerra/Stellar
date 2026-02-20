import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";
import { useContentMode, type Mode } from "../content/useContentMode";
import { buildCards, buildPlacementsSummary, type CardModel, type PlacementSummary } from "../lib/cards";
import { buildChartComparison } from "../lib/synastry";
import { buildAstralMapModelCompatibility, buildAstralMapModelSingle } from "../lib/astralMap";
import { generateChartInWorker } from "../lib/astroWorkerClient";
import { DEFAULT_CHART_SETTINGS } from "../lib/constants";
import {
  DEFAULT_PROGRESSION_STATE,
  awardQuestCompletion,
  awardQuestReflection,
  getLocalDayKey,
  hasCompletedQuest,
  hasReflectedQuest,
  buildRelationshipQuest,
  type RelationshipQuest,
  type ProgressionState,
} from "../lib/progression";
import {
  APP_STATE_RETENTION_DAYS,
  HISTORY_LIMIT,
  clearPersistedAppState,
  readPersistedAppState,
  readPrivacySettings,
  writePrivacySettings,
  writePersistedAppState,
  type PersistedHistoryEntry,
} from "../lib/appState";
import { validateChartInput, type ValidationErrorCode } from "../lib/validation";
import { useGeoSearch, resolveLocationCandidates, type GeoSuggestion } from "../lib/useGeoSearch";
import type {
  AstralMapModel,
  ChartComparison,
  ChartInput,
  ChartResult,
  ChartSettings,
  DuoMode,
  PrimaryArea,
} from "../lib/types";
import { formatIsoDate, shiftIsoDate, toLocationLabel } from "../lib/dateUtils";
import type { ContentPack } from "../lib/cards";

export type AnalysisMode = "single" | "compatibility";

const DEFAULT_REMINDER_RULES = {
  enabled: false,
  leadDays: 1,
  maxOrb: 0.4,
};

const EN_VALIDATION_MESSAGES: Record<ValidationErrorCode, string> = {
  DATE_REQUIRED: "Date is required.",
  DATE_FORMAT_INVALID: "Invalid date format (expected: YYYY-MM-DD).",
  DATE_INVALID: "Invalid calendar date.",
  DATE_TOO_OLD: "Date must be later than 1900.",
  TIME_REQUIRED: "Time is required.",
  TIME_FORMAT_INVALID: "Invalid time format (expected: HH:mm).",
  CITY_REQUIRED: "City and country are required (e.g. New York, US).",
  CITY_TOO_SHORT: "City name must have at least 2 characters.",
  COUNTRY_TOO_SHORT: "Country code must have at least 2 characters.",
  DATE_IN_FUTURE: "Date/time cannot be in the future.",
  TIMEZONE_INVALID: "Invalid timezone for the selected location.",
};

const CARIOCA_VALIDATION_MESSAGES: Record<ValidationErrorCode, string> = {
  DATE_REQUIRED: "Bota a data ai, porra! Sem data nao rola nada.",
  DATE_FORMAT_INVALID: "Essa data ta toda cagada, mermao. Usa YYYY-MM-DD direitinho.",
  DATE_INVALID: "Tu inventou uma data que nao existe, maluco.",
  DATE_TOO_OLD: "Eita, essa data e antes de 1900. Ninguem e tao velho assim, caralho.",
  TIME_REQUIRED: "Cadê a hora, porra? Sem hora o mapa fica manco.",
  TIME_FORMAT_INVALID: "Essa hora ta zoada pra cacete. Manda no formato HH:mm.",
  CITY_REQUIRED: "Fala a cidade e o pais, caralho! Ex: Rio de Janeiro, BR.",
  CITY_TOO_SHORT: "Uma letra so de cidade? Ta de sacanagem, ne. Bota pelo menos 2.",
  COUNTRY_TOO_SHORT: "Codigo do pais com 1 letra? Bota pelo menos 2, porra.",
  DATE_IN_FUTURE: "Opa, ninguem nasce no futuro, maluco. Confere essa data ai.",
  TIMEZONE_INVALID: "O fuso dessa cidade veio todo fudido. Tenta outra localizacao.",
};

function formatValidationMessages(errors: readonly ValidationErrorCode[], isCarioca: boolean): string[] {
  const dictionary = isCarioca ? CARIOCA_VALIDATION_MESSAGES : EN_VALIDATION_MESSAGES;
  return errors.map((code) => dictionary[code]);
}

function hasErrorName(error: unknown, name: string): boolean {
  if (error instanceof Error && error.name === name) return true;
  if (typeof error === "object" && error !== null && "name" in error) {
    return (error as { name?: unknown }).name === name;
  }
  return false;
}

function formatRuntimeError(error: unknown, isCarioca: boolean): string {
  if (hasErrorName(error, "NonexistentLocalTimeError")) {
    return isCarioca
      ? "Esse horario nem existe nessa cidade, porra. Ajusta a hora e tenta de novo."
      : "That local time does not exist in this timezone. Please adjust the time and try again.";
  }
  if (hasErrorName(error, "AmbiguousLocalTimeError")) {
    return isCarioca
      ? "Esse horario ficou duplicado por causa de horario de verao. Escolhe Sim ou Nao e manda brasa."
      : "That local time is ambiguous due to daylight saving time. Choose Yes or No for daylight saving and try again.";
  }
  if (error instanceof Error && error.message.startsWith("Nominatim error:")) {
    return isCarioca
      ? "A busca de cidade travou aqui. Espera um tiquinho e tenta de novo."
      : "City search is temporarily unavailable. Please try again in a moment.";
  }
  const fallback = error instanceof Error ? error.message : String(error);
  if (!isCarioca) {
    return fallback || "Something went wrong. Please try again.";
  }
  return fallback ? `Deu ruim: ${fallback}` : "Deu merda aqui. Tenta de novo.";
}

function looksLikeChartResult(value: unknown): value is ChartResult {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ChartResult>;
  return (
    typeof candidate.input === "object" &&
    candidate.input !== null &&
    typeof candidate.normalized === "object" &&
    candidate.normalized !== null &&
    typeof candidate.planets === "object" &&
    candidate.planets !== null &&
    Array.isArray(candidate.aspects)
  );
}

function useSuggestionKeyboard(geo: { suggestions: GeoSuggestion[]; selectSuggestion: (s: GeoSuggestion) => void; showSuggestions: boolean }) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const currentIndex =
    activeIndex >= 0 && activeIndex < geo.suggestions.length ? activeIndex : -1;

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!geo.showSuggestions) return;
      const count = geo.suggestions.length;
      if (count === 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => {
          const base = prev >= 0 && prev < count ? prev : -1;
          return (base + 1) % count;
        });
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) => {
          const base = prev >= 0 && prev < count ? prev : 0;
          return base <= 0 ? count - 1 : base - 1;
        });
      } else if (event.key === "Enter" && currentIndex >= 0) {
        event.preventDefault();
        geo.selectSuggestion(geo.suggestions[currentIndex]);
        setActiveIndex(-1);
      } else if (event.key === "Escape") {
        event.preventDefault();
        setActiveIndex(-1);
      }
    },
    [currentIndex, geo]
  );

  return { activeIndex: currentIndex, onKeyDown };
}

function toDaylightSavingValue(ds: boolean | "auto"): string {
  return ds === "auto" ? "auto" : ds ? "true" : "false";
}

function parseDaylightSavingValue(value: string): boolean | "auto" {
  return value === "auto" ? "auto" : value === "true";
}

export { toDaylightSavingValue, parseDaylightSavingValue };

function chartToSuggestion(chart: ChartResult): GeoSuggestion {
  const lat = chart.input.location?.lat ?? chart.normalized.location.lat;
  const lon = chart.input.location?.lon ?? chart.normalized.location.lon;
  const timezone = chart.input.location?.timezone ?? chart.normalized.timezone;
  const label = toLocationLabel(chart.input.city, chart.input.country);
  return {
    id: `history-${chart.input.city}-${chart.input.country}-${lat}-${lon}-${timezone}`,
    label,
    city: chart.input.city,
    country: chart.input.country,
    lat,
    lon,
    timezone,
  };
}

function makeHistorySignature(
  analysisMode: AnalysisMode,
  duoMode: DuoMode,
  chartA: ChartResult,
  chartB: ChartResult | null
): string {
  return [
    analysisMode,
    duoMode,
    chartA.normalized.utcDateTime,
    chartA.normalized.timezone,
    chartB?.normalized.utcDateTime ?? "",
    chartB?.normalized.timezone ?? "",
  ].join("|");
}

type GeoSearchHandle = ReturnType<typeof useGeoSearch>;

export interface AppContextType {
  // Content mode
  mode: Mode;
  setMode: (mode: Mode) => void;
  isCarioca: boolean;
  content: ContentPack;

  // Privacy
  persistLocalData: boolean;
  setPersistLocalData: (value: boolean) => void;

  // Analysis config
  analysisMode: AnalysisMode;
  setAnalysisMode: React.Dispatch<React.SetStateAction<AnalysisMode>>;
  duoMode: DuoMode;
  setDuoMode: React.Dispatch<React.SetStateAction<DuoMode>>;
  chartSettings: ChartSettings;
  setChartSettings: React.Dispatch<React.SetStateAction<ChartSettings>>;

  // Time travel
  todayIso: string;
  timeTravelDate: string;
  setTimeTravelDate: React.Dispatch<React.SetStateAction<string>>;
  handleTimeTravelShift: (days: number) => void;
  handleTimeTravelReset: () => void;

  // Charts
  chartA: ChartResult | null;
  setChartA: React.Dispatch<React.SetStateAction<ChartResult | null>>;
  chartB: ChartResult | null;
  setChartB: React.Dispatch<React.SetStateAction<ChartResult | null>>;
  cards: CardModel[];
  setCards: React.Dispatch<React.SetStateAction<CardModel[]>>;
  placements: PlacementSummary[];
  setPlacements: React.Dispatch<React.SetStateAction<PlacementSummary[]>>;
  resultVersion: number;
  setResultVersion: React.Dispatch<React.SetStateAction<number>>;
  history: PersistedHistoryEntry[];
  setHistory: React.Dispatch<React.SetStateAction<PersistedHistoryEntry[]>>;
  progression: ProgressionState;
  setProgression: React.Dispatch<React.SetStateAction<ProgressionState>>;

  // UI state
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  exportMessage: string;
  setExportMessage: React.Dispatch<React.SetStateAction<string>>;
  showShootingStar: boolean;
  isMapModalOpen: boolean;
  setIsMapModalOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Transit pagination (persisted)
  transitDayPage: number;
  setTransitDayPage: React.Dispatch<React.SetStateAction<number>>;
  selectedTransitDate: string;
  setSelectedTransitDate: React.Dispatch<React.SetStateAction<string>>;

  // Reminders
  remindersEnabled: boolean;
  setRemindersEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  reminderLeadDays: number;
  setReminderLeadDays: React.Dispatch<React.SetStateAction<number>>;
  reminderMaxOrb: number;
  setReminderMaxOrb: React.Dispatch<React.SetStateAction<number>>;
  lastReminderKey: string;
  setLastReminderKey: React.Dispatch<React.SetStateAction<string>>;

  // Atlas
  atlasInspectorInput: string;
  setAtlasInspectorInput: React.Dispatch<React.SetStateAction<string>>;

  // Person form A
  dateA: string;
  setDateA: React.Dispatch<React.SetStateAction<string>>;
  timeA: string;
  setTimeA: React.Dispatch<React.SetStateAction<string>>;
  daylightSavingA: boolean | "auto";
  setDaylightSavingA: React.Dispatch<React.SetStateAction<boolean | "auto">>;
  showDaylightSavingOverrideA: boolean;
  setShowDaylightSavingOverrideA: React.Dispatch<React.SetStateAction<boolean>>;
  geoA: GeoSearchHandle;
  kbA: { activeIndex: number; onKeyDown: (e: React.KeyboardEvent) => void };

  // Person form B
  dateB: string;
  setDateB: React.Dispatch<React.SetStateAction<string>>;
  timeB: string;
  setTimeB: React.Dispatch<React.SetStateAction<string>>;
  daylightSavingB: boolean | "auto";
  setDaylightSavingB: React.Dispatch<React.SetStateAction<boolean | "auto">>;
  showDaylightSavingOverrideB: boolean;
  setShowDaylightSavingOverrideB: React.Dispatch<React.SetStateAction<boolean>>;
  geoB: GeoSearchHandle;
  kbB: { activeIndex: number; onKeyDown: (e: React.KeyboardEvent) => void };

  // Derived memos
  comparison: ChartComparison | null;
  astralMapModel: AstralMapModel | null;
  chartMeta: { location: string; datetime: string } | null;
  chartMetaB: { location: string; datetime: string } | null;

  // Refs
  reportExportRef: React.RefObject<HTMLDivElement | null>;
  sharedImportInputRef: React.RefObject<HTMLInputElement | null>;

  // Actions
  handleGenerateChart: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleLoadHistory: (entry: PersistedHistoryEntry) => void;
  handleClearLocalData: () => void;
  handleExportJson: () => void;
  handleExportReportPng: () => Promise<void>;
  handleExportReportPdf: () => Promise<void>;
  handleOpenSharedImport: () => void;
  handleSharedImportFile: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;

  // Quest helpers (used by RelationshipsView)
  buildQuestForCurrentCharts: () => RelationshipQuest | null;
  handleQuestComplete: (quest: RelationshipQuest) => void;
  handleQuestReflection: (quest: RelationshipQuest) => void;

  // Retention constant
  appStateRetentionDays: number;
}

const AppContext = createContext<AppContextType | null>(null);

export function useAppContext(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [location] = useLocation();
  const { mode, setMode, content } = useContentMode();
  const isCarioca = mode === "carioca";
  const persisted = useMemo(() => readPersistedAppState(), []);
  const todayIso = useMemo(() => formatIsoDate(new Date()), []);
  const sharedImportInputRef = useRef<HTMLInputElement | null>(null);
  const reportExportRef = useRef<HTMLDivElement | null>(null);

  const [persistLocalData, setPersistLocalData] = useState(
    () => readPrivacySettings().persistLocalData
  );
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>(
    () => persisted?.analysisMode ?? "single"
  );
  const [duoMode, setDuoMode] = useState<DuoMode>(() => persisted?.duoMode ?? "romantic");
  const [chartSettings, setChartSettings] = useState<ChartSettings>(
    () => persisted?.chartSettings ?? DEFAULT_CHART_SETTINGS
  );
  const [timeTravelDate, setTimeTravelDate] = useState<string>(
    () => persisted?.timeTravelDate ?? todayIso
  );

  // Person A state
  const [dateA, setDateA] = useState(() => persisted?.personA.date ?? "");
  const [timeA, setTimeA] = useState(() => persisted?.personA.time ?? "");
  const [daylightSavingA, setDaylightSavingA] = useState<boolean | "auto">(
    () => persisted?.personA.daylightSaving ?? "auto"
  );
  const [showDaylightSavingOverrideA, setShowDaylightSavingOverrideA] = useState(false);
  const geoA = useGeoSearch(
    persisted?.personA.locationInput ?? "",
    isCarioca
  );

  // Person B state
  const [dateB, setDateB] = useState(() => persisted?.personB.date ?? "");
  const [timeB, setTimeB] = useState(() => persisted?.personB.time ?? "");
  const [daylightSavingB, setDaylightSavingB] = useState<boolean | "auto">(
    () => persisted?.personB.daylightSaving ?? "auto"
  );
  const [showDaylightSavingOverrideB, setShowDaylightSavingOverrideB] = useState(false);
  const geoB = useGeoSearch(
    persisted?.personB.locationInput ?? "",
    isCarioca,
    analysisMode === "compatibility"
  );

  const kbA = useSuggestionKeyboard(geoA);
  const kbB = useSuggestionKeyboard(geoB);

  // Chart state
  const [chartA, setChartA] = useState<ChartResult | null>(() => persisted?.lastChartA ?? null);
  const [chartB, setChartB] = useState<ChartResult | null>(() => persisted?.lastChartB ?? null);
  const [cards, setCards] = useState<CardModel[]>([]);
  const [resultVersion, setResultVersion] = useState(0);
  const [history, setHistory] = useState<PersistedHistoryEntry[]>(() => persisted?.history ?? []);
  const [progression, setProgression] = useState(() => persisted?.progression ?? DEFAULT_PROGRESSION_STATE);
  const [placements, setPlacements] = useState<PlacementSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoRestored, setGeoRestored] = useState(false);
  const [showShootingStar, setShowShootingStar] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [transitDayPage, setTransitDayPage] = useState<number>(() => persisted?.transitDayPage ?? 0);
  const [selectedTransitDate, setSelectedTransitDate] = useState<string>(() => persisted?.selectedTransitDate ?? "");
  const [exportMessage, setExportMessage] = useState<string>("");
  const [remindersEnabled, setRemindersEnabled] = useState<boolean>(
    () => persisted?.reminders.enabled ?? DEFAULT_REMINDER_RULES.enabled
  );
  const [reminderLeadDays, setReminderLeadDays] = useState<number>(
    () => persisted?.reminders.leadDays ?? DEFAULT_REMINDER_RULES.leadDays
  );
  const [reminderMaxOrb, setReminderMaxOrb] = useState<number>(
    () => persisted?.reminders.maxOrb ?? DEFAULT_REMINDER_RULES.maxOrb
  );
  const [lastReminderKey, setLastReminderKey] = useState<string>(
    () => persisted?.reminders.lastSentKey ?? ""
  );
  const [atlasInspectorInput, setAtlasInspectorInput] = useState<string>(
    () => persisted?.atlasInspectorInput ?? persisted?.personA.locationInput ?? "Rio de Janeiro, BR"
  );

  // Derive primaryArea from URL for persistence (URL is source of truth)
  const primaryAreaFromUrl = useMemo((): PrimaryArea => {
    const area = location.replace(/^\//, "") || "chart";
    const valid: PrimaryArea[] = ["chart", "transits", "timing", "relationships", "atlas", "library"];
    return valid.includes(area as PrimaryArea) ? (area as PrimaryArea) : "chart";
  }, [location]);

  // Clear stale state when switching analysis mode
  useEffect(() => {
    if (analysisMode === "single") {
      setChartB(null);
      setShowDaylightSavingOverrideB(false);
    }
  }, [analysisMode]);

  // Recalculate cards and placements when content mode changes
  useEffect(() => {
    if (chartA) {
      setCards(buildCards(content, chartA, mode));
      setPlacements(buildPlacementsSummary(chartA));
    }
  }, [mode, content, chartA]);

  // Restore geo inputs from persisted charts on first load
  useEffect(() => {
    if (geoRestored) return;
    const savedChartA = persisted?.lastChartA ?? chartA;
    const savedChartB = persisted?.lastChartB ?? chartB;
    if (savedChartA) {
      geoA.applyResolved(chartToSuggestion(savedChartA));
    }
    if ((persisted?.analysisMode ?? analysisMode) === "compatibility" && savedChartB) {
      geoB.applyResolved(chartToSuggestion(savedChartB));
    }
    setGeoRestored(true);
  }, [
    analysisMode,
    chartA,
    chartB,
    geoA,
    geoB,
    geoRestored,
    persisted,
  ]);

  useEffect(() => {
    writePrivacySettings({ persistLocalData });
    if (!persistLocalData) {
      clearPersistedAppState();
    }
  }, [persistLocalData]);

  // Persist state
  useEffect(() => {
    if (!persistLocalData) return;
    writePersistedAppState({
      primaryArea: primaryAreaFromUrl,
      analysisMode,
      duoMode,
      chartSettings,
      timeTravelDate,
      transitDayPage,
      selectedTransitDate: selectedTransitDate || undefined,
      reminders: {
        enabled: remindersEnabled,
        leadDays: reminderLeadDays,
        maxOrb: reminderMaxOrb,
        lastSentKey: lastReminderKey || undefined,
      },
      atlasInspectorInput,
      personA: {
        date: dateA,
        time: timeA,
        daylightSaving: daylightSavingA,
        locationInput: geoA.locationInput,
      },
      personB: {
        date: dateB,
        time: timeB,
        daylightSaving: daylightSavingB,
        locationInput: geoB.locationInput,
      },
      lastChartA: chartA ?? undefined,
      lastChartB: chartB ?? undefined,
      history: history.slice(0, HISTORY_LIMIT),
      progression,
    });
  }, [
    analysisMode,
    chartSettings,
    chartA,
    chartB,
    dateA,
    dateB,
    daylightSavingA,
    daylightSavingB,
    duoMode,
    geoA.locationInput,
    geoB.locationInput,
    history,
    lastReminderKey,
    atlasInspectorInput,
    persistLocalData,
    primaryAreaFromUrl,
    progression,
    reminderLeadDays,
    reminderMaxOrb,
    remindersEnabled,
    selectedTransitDate,
    timeTravelDate,
    transitDayPage,
    timeA,
    timeB,
  ]);

  // Derived memos
  const chartLocale = isCarioca ? "pt-BR" : "en-US";

  const formatChartMeta = useCallback(
    (c: ChartResult) => {
      const { city, date, time: t } = c.input;
      const [year, month, day] = date.split("-").map(Number);
      const localDate = new Date(Date.UTC(year, month - 1, day));
      const formattedDate = localDate.toLocaleDateString(chartLocale, {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
      return { location: city, datetime: `${formattedDate}, ${t}` };
    },
    [chartLocale]
  );

  const chartMeta = useMemo(() => (chartA ? formatChartMeta(chartA) : null), [chartA, formatChartMeta]);
  const chartMetaB = useMemo(() => (chartB ? formatChartMeta(chartB) : null), [chartB, formatChartMeta]);

  const comparison = useMemo(() => {
    if (analysisMode !== "compatibility" || !chartA || !chartB) return null;
    return buildChartComparison(chartA, chartB, isCarioca ? "pt" : "en", duoMode);
  }, [analysisMode, chartA, chartB, duoMode, isCarioca]);

  const astralMapModel = useMemo(() => {
    if (analysisMode === "single") {
      if (!chartA) return null;
      return buildAstralMapModelSingle(chartA);
    }
    if (!chartA || !chartB || !comparison) return null;
    return buildAstralMapModelCompatibility(chartA, chartB, comparison);
  }, [analysisMode, chartA, chartB, comparison]);

  // Close map modal when astralMapModel becomes null
  useEffect(() => {
    if (!astralMapModel) setIsMapModalOpen(false);
  }, [astralMapModel]);

  // Time travel handlers
  function handleTimeTravelShift(days: number) {
    setTimeTravelDate((current) => shiftIsoDate(current, days));
  }

  function handleTimeTravelReset() {
    setTimeTravelDate(todayIso);
  }

  // Chart generation helpers
  function buildChartInput(
    date: string,
    time: string,
    daylightSaving: boolean | "auto",
    geo: { city: string; country: string; location: { lat: number; lon: number; timezone: string } | undefined }
  ): ChartInput {
    return {
      date,
      time,
      city: geo.city,
      country: geo.country,
      location: geo.location,
      daylight_saving: daylightSaving,
    };
  }

  async function ensureResolvedInput(
    date: string,
    time: string,
    daylightSaving: boolean | "auto",
    geo: {
      city: string;
      country: string;
      location: { lat: number; lon: number; timezone: string } | undefined;
      locationInput: string;
      applyResolved: (s: GeoSuggestion) => void;
      setSuggestions: (s: GeoSuggestion[]) => void;
      setSearchError: (e: string | null) => void;
    },
    personLabel?: string
  ): Promise<ChartInput | null> {
    const withPrefix = (message: string) =>
      personLabel ? `${personLabel}: ${message}` : message;

    let chartInput = buildChartInput(date, time, daylightSaving, geo);

    if (!geo.location) {
      const normalized = geo.locationInput.trim().toLowerCase().replace(/\s+/g, " ");
      if (normalized.length < 3) {
        setError(
          withPrefix(
            isCarioca
              ? "Manda pelo menos 3 letras da cidade, porra."
              : "Type at least 3 characters to search for a city."
          )
        );
        return null;
      }
      const candidates = await resolveLocationCandidates(geo.locationInput, isCarioca, 6);
      if (candidates === null) {
        setError(
          withPrefix(
            isCarioca
              ? "Nao deu pra buscar cidade agora, mermão. Tenta de novo ja ja."
              : "Could not search cities right now."
          )
        );
        return null;
      }
      if (candidates.length === 0) {
        setError(
          withPrefix(
            isCarioca
              ? "Nao achei essa cidade nem fudendo. Tenta botar cidade + pais certinho."
              : "Couldn't find that city. Try including the country code."
          )
        );
        return null;
      }
      if (candidates.length > 1) {
        geo.setSuggestions(candidates);
        geo.setSearchError(null);
        setError(
          withPrefix(
            isCarioca
              ? "Cidade ambigua pra caralho. Escolhe uma opcao da lista ai."
              : "Ambiguous city. Please select one option from the city suggestions list."
          )
        );
        return null;
      }
      const fallback = candidates[0];
      geo.applyResolved(fallback);
      chartInput = {
        ...chartInput,
        city: fallback.city,
        country: fallback.country,
        location: { lat: fallback.lat, lon: fallback.lon, timezone: fallback.timezone },
      };
    }

    const validation = validateChartInput(chartInput);
    if (!validation.valid) {
      setError(withPrefix(formatValidationMessages(validation.errors, isCarioca).join(". ")));
      return null;
    }
    return chartInput;
  }

  function appendHistoryEntry(nextChartA: ChartResult, nextChartB: ChartResult | null) {
    const entry: PersistedHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      createdAt: new Date().toISOString(),
      analysisMode: nextChartB ? "compatibility" : "single",
      duoMode,
      chartA: nextChartA,
      chartB: nextChartB ?? undefined,
    };
    const signature = makeHistorySignature(entry.analysisMode, entry.duoMode, entry.chartA, nextChartB);
    setHistory((prev) => {
      const deduped = prev.filter(
        (saved) =>
          makeHistorySignature(
            saved.analysisMode,
            saved.duoMode,
            saved.chartA,
            saved.chartB ?? null
          ) !== signature
      );
      return [entry, ...deduped].slice(0, HISTORY_LIMIT);
    });
  }

  function applyChartToForm(chartValue: ChartResult, person: "A" | "B") {
    const suggestion = chartToSuggestion(chartValue);
    if (person === "A") {
      setDateA(chartValue.input.date);
      setTimeA(chartValue.input.time);
      setDaylightSavingA(chartValue.input.daylight_saving);
      geoA.applyResolved(suggestion);
      return;
    }
    setDateB(chartValue.input.date);
    setTimeB(chartValue.input.time);
    setDaylightSavingB(chartValue.input.daylight_saving);
    geoB.applyResolved(suggestion);
  }

  function handleLoadHistory(entry: PersistedHistoryEntry) {
    setError(null);
    setExportMessage("");
    setShowDaylightSavingOverrideA(false);
    setShowDaylightSavingOverrideB(false);
    setAnalysisMode(entry.analysisMode);
    setDuoMode(entry.duoMode);
    applyChartToForm(entry.chartA, "A");
    setChartA(entry.chartA);

    if (entry.analysisMode === "compatibility" && entry.chartB) {
      applyChartToForm(entry.chartB, "B");
      setChartB(entry.chartB);
    } else {
      setChartB(null);
    }

    setResultVersion((prev) => prev + 1);
  }

  async function handleGenerateChart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setExportMessage("");
    setShowDaylightSavingOverrideA(false);
    setShowDaylightSavingOverrideB(false);
    setLoading(true);

    try {
      const inputA = await ensureResolvedInput(
        dateA,
        timeA,
        daylightSavingA,
        geoA,
        analysisMode === "compatibility" ? (isCarioca ? "Pessoa A" : "Person A") : undefined
      );
      if (!inputA) return;

      if (analysisMode === "single") {
        const newChart = await generateChartInWorker(inputA, chartSettings);
        setChartA(newChart);
        setChartB(null);
        setCards(buildCards(content, newChart, mode));
        setPlacements(buildPlacementsSummary(newChart));
        setShowDaylightSavingOverrideA(false);
        appendHistoryEntry(newChart, null);
        setResultVersion((prev) => prev + 1);
        return;
      }

      const inputResolvedB = await ensureResolvedInput(
        dateB,
        timeB,
        daylightSavingB,
        geoB,
        isCarioca ? "Pessoa B" : "Person B"
      );
      if (!inputResolvedB) return;

      const personALabel = isCarioca ? "Pessoa A" : "Person A";
      const personBLabel = isCarioca ? "Pessoa B" : "Person B";
      const [resultA, resultB] = await Promise.allSettled([
        generateChartInWorker(inputA, chartSettings),
        generateChartInWorker(inputResolvedB, chartSettings),
      ]);

      const ambiguousA =
        resultA.status === "rejected" && hasErrorName(resultA.reason, "AmbiguousLocalTimeError");
      const ambiguousB =
        resultB.status === "rejected" && hasErrorName(resultB.reason, "AmbiguousLocalTimeError");
      setShowDaylightSavingOverrideA(ambiguousA);
      setShowDaylightSavingOverrideB(ambiguousB);

      const errors: string[] = [];
      if (resultA.status === "rejected") {
        errors.push(`${personALabel}: ${formatRuntimeError(resultA.reason, isCarioca)}`);
      }
      if (resultB.status === "rejected") {
        errors.push(`${personBLabel}: ${formatRuntimeError(resultB.reason, isCarioca)}`);
      }
      if (errors.length > 0) {
        setError(errors.join(" "));
        return;
      }

      const chartAValue = (resultA as PromiseFulfilledResult<ChartResult>).value;
      const chartBValue = (resultB as PromiseFulfilledResult<ChartResult>).value;
      setChartA(chartAValue);
      setChartB(chartBValue);
      setCards(buildCards(content, chartAValue, mode));
      setPlacements(buildPlacementsSummary(chartAValue));
      setShowDaylightSavingOverrideA(false);
      setShowDaylightSavingOverrideB(false);
      appendHistoryEntry(chartAValue, chartBValue);
      setShowShootingStar(false);
      requestAnimationFrame(() => {
        setShowShootingStar(true);
        setTimeout(() => setShowShootingStar(false), 2000);
      });
      setResultVersion((prev) => prev + 1);
    } catch (err) {
      if (hasErrorName(err, "AmbiguousLocalTimeError")) {
        setShowDaylightSavingOverrideA(true);
      }
      setError(formatRuntimeError(err, isCarioca));
    } finally {
      setLoading(false);
    }
  }

  function handleClearLocalData() {
    clearPersistedAppState();
    setAnalysisMode("single");
    setDuoMode("romantic");
    setChartSettings(DEFAULT_CHART_SETTINGS);
    setDateA("");
    setTimeA("");
    setDaylightSavingA("auto");
    geoA.setLocationInput("");
    geoA.setSuggestions([]);
    geoA.setSearchError(null);
    setDateB("");
    setTimeB("");
    setDaylightSavingB("auto");
    geoB.setLocationInput("");
    geoB.setSuggestions([]);
    geoB.setSearchError(null);
    setShowDaylightSavingOverrideA(false);
    setShowDaylightSavingOverrideB(false);
    setChartA(null);
    setChartB(null);
    setCards([]);
    setPlacements([]);
    setHistory([]);
    setProgression(DEFAULT_PROGRESSION_STATE);
    setTimeTravelDate(todayIso);
    setTransitDayPage(0);
    setSelectedTransitDate("");
    setRemindersEnabled(DEFAULT_REMINDER_RULES.enabled);
    setReminderLeadDays(DEFAULT_REMINDER_RULES.leadDays);
    setReminderMaxOrb(DEFAULT_REMINDER_RULES.maxOrb);
    setLastReminderKey("");
    setAtlasInspectorInput("Rio de Janeiro, BR");
    setExportMessage("");
    setError(null);
    setResultVersion((prev) => prev + 1);
  }

  function handleExportJson() {
    if (!chartA) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      primaryArea: primaryAreaFromUrl,
      analysisMode,
      duoMode,
      chartSettings,
      chartA,
      chartB: analysisMode === "compatibility" ? chartB : null,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const now = new Date();
    const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
    const link = document.createElement("a");
    link.href = url;
    link.download = `stellar-export-${day}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function captureReportCanvas(): Promise<HTMLCanvasElement | null> {
    if (!reportExportRef.current) return null;
    const html2canvas = (await import("html2canvas")).default;
    return html2canvas(reportExportRef.current, {
      backgroundColor: "#090f1f",
      scale: 2,
      useCORS: true,
    });
  }

  function buildReportFileName(): string {
    const now = new Date();
    return `stellar-report-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  async function handleExportReportPng() {
    if (!chartA) return;
    const donePng = isCarioca ? "Relatorio PNG exportado." : "PNG report exported.";
    const errMsg = isCarioca ? "Nao foi possivel exportar o relatorio." : "Could not export report.";
    try {
      const canvas = await captureReportCanvas();
      if (!canvas) throw new Error("Missing capture canvas");
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `${buildReportFileName()}.png`;
      link.click();
      setExportMessage(donePng);
    } catch {
      setExportMessage(errMsg);
    }
  }

  async function handleExportReportPdf() {
    if (!chartA) return;
    const donePdf = isCarioca ? "Relatorio PDF exportado." : "PDF report exported.";
    const errMsg = isCarioca ? "Nao foi possivel exportar o relatorio." : "Could not export report.";
    try {
      const canvas = await captureReportCanvas();
      if (!canvas) throw new Error("Missing capture canvas");
      const image = canvas.toDataURL("image/png");
      const [{ jsPDF }] = await Promise.all([import("jspdf")]);
      const ratio = canvas.width / canvas.height;
      const width = 820;
      const height = Math.round(width / ratio);
      const pdf = new jsPDF({
        orientation: width > height ? "landscape" : "portrait",
        unit: "pt",
        format: [width, height],
      });
      pdf.addImage(image, "PNG", 0, 0, width, height);
      pdf.save(`${buildReportFileName()}.pdf`);
      setExportMessage(donePdf);
    } catch {
      setExportMessage(errMsg);
    }
  }

  function handleOpenSharedImport() {
    sharedImportInputRef.current?.click();
  }

  async function handleSharedImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as unknown;
      let imported: ChartResult | null = null;
      if (looksLikeChartResult(parsed)) {
        imported = parsed;
      } else if (typeof parsed === "object" && parsed !== null) {
        const payload = parsed as { chartA?: unknown; chartB?: unknown };
        if (looksLikeChartResult(payload.chartB)) {
          imported = payload.chartB;
        } else if (looksLikeChartResult(payload.chartA)) {
          imported = payload.chartA;
        }
      }

      if (!imported) {
        setError(
          isCarioca
            ? "Arquivo invalido. Importa um JSON de chart/export do Stellar."
            : "Invalid file. Import a Stellar chart/export JSON."
        );
        return;
      }

      setError(null);
      setExportMessage("");
      setShowDaylightSavingOverrideA(false);
      setShowDaylightSavingOverrideB(false);

      if (!chartA) {
        setAnalysisMode("single");
        setChartA(imported);
        setChartB(null);
        applyChartToForm(imported, "A");
        setCards(buildCards(content, imported, mode));
        setPlacements(buildPlacementsSummary(imported));
        appendHistoryEntry(imported, null);
      } else {
        setAnalysisMode("compatibility");
        setChartB(imported);
        applyChartToForm(imported, "B");
        appendHistoryEntry(chartA, imported);
      }
      setResultVersion((prev) => prev + 1);
    } catch {
      setError(
        isCarioca
          ? "Nao deu pra ler esse arquivo. Confere o JSON."
          : "Could not read this file. Check the JSON content."
      );
    }
  }

  // Quest helpers
  function buildQuestForCurrentCharts(): RelationshipQuest | null {
    if (analysisMode !== "compatibility" || !comparison || !chartA) return null;
    return buildRelationshipQuest(comparison, {
      locale: isCarioca ? "pt" : "en",
      duoMode,
      timeZone: chartA.normalized.timezone,
    });
  }

  function handleQuestComplete(quest: RelationshipQuest) {
    if (!chartA) return;
    const dayKey = getLocalDayKey(new Date(), chartA.normalized.timezone);
    setProgression((current) => awardQuestCompletion(current, quest.id, dayKey));
  }

  function handleQuestReflection(quest: RelationshipQuest) {
    if (!hasCompletedQuest(progression, quest.id)) return;
    if (hasReflectedQuest(progression, quest.id)) return;
    setProgression((current) => awardQuestReflection(current, quest.id));
  }

  const value: AppContextType = {
    mode,
    setMode,
    isCarioca,
    content,
    persistLocalData,
    setPersistLocalData,
    analysisMode,
    setAnalysisMode,
    duoMode,
    setDuoMode,
    chartSettings,
    setChartSettings,
    todayIso,
    timeTravelDate,
    setTimeTravelDate,
    handleTimeTravelShift,
    handleTimeTravelReset,
    chartA,
    setChartA,
    chartB,
    setChartB,
    cards,
    setCards,
    placements,
    setPlacements,
    resultVersion,
    setResultVersion,
    history,
    setHistory,
    progression,
    setProgression,
    loading,
    setLoading,
    error,
    setError,
    exportMessage,
    setExportMessage,
    showShootingStar,
    isMapModalOpen,
    setIsMapModalOpen,
    transitDayPage,
    setTransitDayPage,
    selectedTransitDate,
    setSelectedTransitDate,
    remindersEnabled,
    setRemindersEnabled,
    reminderLeadDays,
    setReminderLeadDays,
    reminderMaxOrb,
    setReminderMaxOrb,
    lastReminderKey,
    setLastReminderKey,
    atlasInspectorInput,
    setAtlasInspectorInput,
    dateA,
    setDateA,
    timeA,
    setTimeA,
    daylightSavingA,
    setDaylightSavingA,
    showDaylightSavingOverrideA,
    setShowDaylightSavingOverrideA,
    geoA,
    kbA,
    dateB,
    setDateB,
    timeB,
    setTimeB,
    daylightSavingB,
    setDaylightSavingB,
    showDaylightSavingOverrideB,
    setShowDaylightSavingOverrideB,
    geoB,
    kbB,
    comparison,
    astralMapModel,
    chartMeta,
    chartMetaB,
    reportExportRef,
    sharedImportInputRef,
    handleGenerateChart,
    handleLoadHistory,
    handleClearLocalData,
    handleExportJson,
    handleExportReportPng,
    handleExportReportPdf,
    handleOpenSharedImport,
    handleSharedImportFile,
    buildQuestForCurrentCharts,
    handleQuestComplete,
    handleQuestReflection,
    appStateRetentionDays: APP_STATE_RETENTION_DAYS,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
