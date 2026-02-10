import { useState, useEffect, useMemo, useCallback, type FormEvent } from "react";
import { useContentMode } from "./content/useContentMode";
import { ModeToggle } from "./components/ModeToggle";
import { Card } from "./components/Card";
import { Section } from "./components/Section";
import { PlacementsSummary } from "./components/PlacementsSummary";
import { LoadingState } from "./components/LoadingState";
import { PersonForm } from "./components/PersonForm";
import { buildCards, buildPlacementsSummary, type CardModel, type PlacementSummary } from "./lib/cards";
import { AmbiguousLocalTimeError, NonexistentLocalTimeError, generateChart } from "./lib/engine";
import { buildChartComparison } from "./lib/synastry";
import { buildDailyTransitOutlook } from "./lib/transits";
import {
  HISTORY_LIMIT,
  readPersistedAppState,
  writePersistedAppState,
  type PersistedHistoryEntry,
} from "./lib/appState";
import { validateChartInput, type ValidationErrorCode } from "./lib/validation";
import { useGeoSearch, resolveLocationCandidates, type GeoSuggestion } from "./lib/useGeoSearch";
import { SUPPORTED_CITIES } from "./lib/resolveCity";
import type { ChartInput, ChartResult, DuoMode } from "./lib/types";

type AnalysisMode = "single" | "compatibility";

function toLocationLabel(city: string, country: string): string {
  const trimmedCity = city.trim();
  const trimmedCountry = country.trim();
  if (!trimmedCity) return trimmedCountry;
  if (!trimmedCountry) return trimmedCity;
  return `${trimmedCity}, ${trimmedCountry}`;
}

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
  DATE_REQUIRED: "Sem data nao rola, porra.",
  DATE_FORMAT_INVALID: "A data ta zoada, mermão. Usa YYYY-MM-DD sem inventar moda.",
  DATE_INVALID: "Essa data ai ta errada pra caralho.",
  DATE_TOO_OLD: "Ta puxando data jurassica demais. Manda depois de 1900.",
  TIME_REQUIRED: "Sem hora nao tem mapa, caralho.",
  TIME_FORMAT_INVALID: "Hora toda cagada. Usa HH:mm certinho.",
  CITY_REQUIRED: "Manda cidade e pais direito, porra. Ex: Rio de Janeiro, BR.",
  CITY_TOO_SHORT: "Nome de cidade com 1 letra e sacanagem. Bota pelo menos 2.",
  COUNTRY_TOO_SHORT: "Codigo do pais ta curto pra cacete. Usa pelo menos 2 letras.",
  DATE_IN_FUTURE: "Nascer no futuro nao da, ne porra.",
  TIMEZONE_INVALID: "Timezone dessa localizacao veio toda errada.",
};

function formatValidationMessages(errors: readonly ValidationErrorCode[], isCarioca: boolean): string[] {
  const dictionary = isCarioca ? CARIOCA_VALIDATION_MESSAGES : EN_VALIDATION_MESSAGES;
  return errors.map((code) => dictionary[code]);
}

function formatRuntimeError(error: unknown, isCarioca: boolean): string {
  if (error instanceof NonexistentLocalTimeError) {
    return isCarioca
      ? "Esse horario nem existe nessa cidade, porra. Ajusta a hora e tenta de novo."
      : "That local time does not exist in this timezone. Please adjust the time and try again.";
  }
  if (error instanceof AmbiguousLocalTimeError) {
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

function App() {
  const { mode, setMode, content } = useContentMode();
  const isCarioca = mode === "carioca";
  const persisted = useMemo(() => readPersistedAppState(), []);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>(
    () => persisted?.analysisMode ?? "single"
  );
  const [duoMode, setDuoMode] = useState<DuoMode>(() => persisted?.duoMode ?? "romantic");

  // Person A state
  const [dateA, setDateA] = useState(() => persisted?.personA.date ?? "1990-01-01");
  const [timeA, setTimeA] = useState(() => persisted?.personA.time ?? "12:00");
  const [daylightSavingA, setDaylightSavingA] = useState<boolean | "auto">(
    () => persisted?.personA.daylightSaving ?? "auto"
  );
  const [showDaylightSavingOverrideA, setShowDaylightSavingOverrideA] = useState(false);
  const geoA = useGeoSearch(
    persisted?.personA.locationInput ?? "Rio de Janeiro, BR",
    isCarioca
  );

  // Person B state
  const [dateB, setDateB] = useState(() => persisted?.personB.date ?? "1990-01-01");
  const [timeB, setTimeB] = useState(() => persisted?.personB.time ?? "12:00");
  const [daylightSavingB, setDaylightSavingB] = useState<boolean | "auto">(
    () => persisted?.personB.daylightSaving ?? "auto"
  );
  const [showDaylightSavingOverrideB, setShowDaylightSavingOverrideB] = useState(false);
  const geoB = useGeoSearch(
    persisted?.personB.locationInput ?? "New York, US",
    isCarioca,
    analysisMode === "compatibility"
  );

  // Keyboard nav for suggestion lists
  const kbA = useSuggestionKeyboard(geoA);
  const kbB = useSuggestionKeyboard(geoB);

  // Chart state
  const [chart, setChart] = useState<ChartResult | null>(() => persisted?.lastChartA ?? null);
  const [chartB, setChartB] = useState<ChartResult | null>(() => persisted?.lastChartB ?? null);
  const [cards, setCards] = useState<CardModel[]>([]);
  const [resultVersion, setResultVersion] = useState(0);
  const [history, setHistory] = useState<PersistedHistoryEntry[]>(() => persisted?.history ?? []);
  const [placements, setPlacements] = useState<PlacementSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoRestored, setGeoRestored] = useState(false);

  // Clear stale state when switching analysis mode
  useEffect(() => {
    if (analysisMode === "single") {
      setChartB(null);
      setShowDaylightSavingOverrideB(false);
    }
  }, [analysisMode]);

  // Recalculate cards and placements when mode changes
  useEffect(() => {
    if (chart) {
      setCards(buildCards(content, chart, mode));
      setPlacements(buildPlacementsSummary(chart));
    }
  }, [mode, content, chart]);

  useEffect(() => {
    if (geoRestored) return;
    const savedChartA = persisted?.lastChartA ?? chart;
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
    chart,
    chartB,
    geoA,
    geoB,
    geoRestored,
    persisted,
  ]);

  useEffect(() => {
    writePersistedAppState({
      analysisMode,
      duoMode,
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
      lastChartA: chart ?? undefined,
      lastChartB: chartB ?? undefined,
      history: history.slice(0, HISTORY_LIMIT),
    });
  }, [
    analysisMode,
    chart,
    chartB,
    dateA,
    dateB,
    daylightSavingA,
    daylightSavingB,
    duoMode,
    geoA.locationInput,
    geoB.locationInput,
    history,
    timeA,
    timeB,
  ]);

  const { heroCards, planetCards, aspectCards } = useMemo(() => {
    const HERO_PLANETS = new Set(["Sun", "Moon"]);
    const hero: CardModel[] = [];
    const planets: CardModel[] = [];
    const aspects: CardModel[] = [];

    for (const card of cards) {
      if (card.category === "aspect") {
        aspects.push(card);
      } else if (card.planet && HERO_PLANETS.has(card.planet)) {
        hero.push(card);
      } else if (card.planet) {
        planets.push(card);
      }
    }

    return { heroCards: hero, planetCards: planets, aspectCards: aspects };
  }, [cards]);

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

  const chartMeta = useMemo(() => (chart ? formatChartMeta(chart) : null), [chart, formatChartMeta]);
  const chartMetaB = useMemo(() => (chartB ? formatChartMeta(chartB) : null), [chartB, formatChartMeta]);

  const placementsB = useMemo(() => {
    if (!chartB) return [];
    return buildPlacementsSummary(chartB);
  }, [chartB]);

  const comparison = useMemo(() => {
    if (analysisMode !== "compatibility" || !chart || !chartB) return null;
    return buildChartComparison(chart, chartB, isCarioca ? "pt" : "en", duoMode);
  }, [analysisMode, chart, chartB, duoMode, isCarioca]);

  const dailyOutlook = useMemo(() => {
    if (analysisMode !== "compatibility" || !chart || !chartB) return null;
    return buildDailyTransitOutlook(chart, chartB, {
      locale: isCarioca ? "pt" : "en",
      duoMode,
    });
  }, [analysisMode, chart, chartB, duoMode, isCarioca]);

  const comparisonCards = useMemo(() => {
    if (!comparison) return [];
    return comparison.highlights.map((highlight) => ({
      key: highlight.key,
      title: highlight.title,
      subtitle: highlight.subtitle,
      text: highlight.text,
      tags: highlight.tags,
      details: highlight.details,
      tone: highlight.tone,
      orb: highlight.related?.aspect?.orb,
    }));
  }, [comparison]);

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

  function applyChartToForm(
    chartValue: ChartResult,
    person: "A" | "B"
  ) {
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
    setShowDaylightSavingOverrideA(false);
    setShowDaylightSavingOverrideB(false);
    setAnalysisMode(entry.analysisMode);
    setDuoMode(entry.duoMode);
    applyChartToForm(entry.chartA, "A");
    setChart(entry.chartA);

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
        const newChart = await generateChart(inputA);
        setChart(newChart);
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
        generateChart(inputA),
        generateChart(inputResolvedB),
      ]);

      const ambiguousA =
        resultA.status === "rejected" && resultA.reason instanceof AmbiguousLocalTimeError;
      const ambiguousB =
        resultB.status === "rejected" && resultB.reason instanceof AmbiguousLocalTimeError;
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
      setChart(chartAValue);
      setChartB(chartBValue);
      setCards(buildCards(content, chartAValue, mode));
      setPlacements(buildPlacementsSummary(chartAValue));
      setShowDaylightSavingOverrideA(false);
      setShowDaylightSavingOverrideB(false);
      appendHistoryEntry(chartAValue, chartBValue);
      setResultVersion((prev) => prev + 1);
    } catch (err) {
      if (err instanceof AmbiguousLocalTimeError) {
        setShowDaylightSavingOverrideA(true);
      }
      setError(formatRuntimeError(err, isCarioca));
    } finally {
      setLoading(false);
    }
  }

  const formLabels = {
    date: isCarioca ? "Data" : "Date",
    time: isCarioca ? "Hora" : "Time",
    cityAndCountry: isCarioca ? "Cidade e pais, sem caozada" : "City & country",
    searchPlaceholder: isCarioca ? "Ex: Rio de Janeiro, BR" : "e.g. New York, US",
    searching: isCarioca ? "Caçando cidade..." : "Searching cities...",
    noResults: isCarioca ? "Nao achei porra nenhuma." : "No cities found.",
    cityHint: isCarioca
      ? `Manda a cidade com pais certinho, mermão. Ou usa um exemplo: ${SUPPORTED_CITIES.join(", ")}`
      : `Type to search cities worldwide or try: ${SUPPORTED_CITIES.join(", ")}`,
    datePickerDialog: isCarioca ? "Escolher data" : "Choose date",
    datePickerYear: isCarioca ? "Ano" : "Year",
    datePickerPreviousMonth: isCarioca ? "Mes anterior" : "Previous month",
    datePickerNextMonth: isCarioca ? "Proximo mes" : "Next month",
    daylightSaving: isCarioca ? "Horario de verao" : "Daylight saving",
    daylightSavingAuto: isCarioca ? "Auto (recomendado)" : "Auto (recommended)",
    daylightSavingManual: isCarioca ? "Ajuste manual de horario de verao" : "Manual daylight saving override",
    daylightSavingManualHint: isCarioca
      ? "Deixa no auto na maior parte dos casos. So abre isso se o horario nascer duplicado."
      : "Keep Auto for most cases. Use manual only when a birth time is duplicated by DST fallback.",
    yes: isCarioca ? "Sim, porra" : "Yes",
    no: isCarioca ? "Nao, porra" : "No",
  };

  const t = {
    modeLabel: isCarioca ? "Carioca raiz, porra" : "English",
    singleMode: isCarioca ? "Mapa solo bolado" : "Single chart",
    compatibilityMode: isCarioca ? "Sinastria braba" : "Compatibility",
    personA: isCarioca ? "Pessoa A (tu)" : "Person A",
    personB: isCarioca ? "Pessoa B (o outro)" : "Person B",
    generating: isCarioca ? "Gerando essa porra..." : "Generating...",
    generateNew: isCarioca ? "Gerar outro mapa, caralho" : "New chart",
    generate: isCarioca ? "Gerar mapa, porra" : "Generate chart",
    error: isCarioca ? "Deu merda no mapa" : "Error generating chart",
    normalizedTitle: isCarioca ? "Dados no papo reto" : "Normalized data",
    dstLabel: isCarioca ? "Horario de verao" : "Daylight saving",
    emptyState: isCarioca
      ? 'Clica em "Gerar mapa, porra" pra ver os cards desse mapa.'
      : 'Click "Generate chart" to see your birth chart cards.',
    loading: isCarioca ? "Calculando os planetas nessa porra" : "Calculating planetary positions",
    planetsTitle: isCarioca ? "Planetas no caos" : "Planets",
    aspectsTitle: isCarioca ? "Aspectos na porrada" : "Aspects",
    aspectsBadge: (n: number) => isCarioca ? `${n} conexoes brabas` : `${n} connections`,
    compatibilityTitle: isCarioca ? "Sinastria de cria" : "Synastry",
    compatibilityBadge: (n: number) => isCarioca ? `${n} aspectos brabos` : `${n} aspects`,
    compatibilityEmpty: isCarioca
      ? 'Clica em "Gerar mapa, porra" pra ver a treta entre Pessoa A e Pessoa B.'
      : 'Click "Generate chart" to see aspects between Person A and Person B.',
    compatibilityStatsTitle: isCarioca ? "Stats da relacao" : "Relationship stats",
    compatibilityStatsBadge: isCarioca ? "modo RPG" : "RPG mode",
    todayForUsTitle: isCarioca ? "Hoje pra dupla" : "Today for Us",
    todayForUsBadge: isCarioca ? "transitos ativos" : "live transits",
    duoModeLabel: isCarioca ? "Tipo de dupla" : "Duo mode",
    duoModeRomantic: isCarioca ? "Romantico" : "Romantic",
    duoModeFriend: isCarioca ? "Amizade" : "Friend",
    historyTitle: isCarioca ? "Historico salvo" : "Saved history",
    historyLoad: isCarioca ? "Carregar" : "Load",
    historySingle: isCarioca ? "Solo" : "Single",
    historyCompatibility: isCarioca ? "Sinastria" : "Compatibility",
  };
  const ariaLabels = {
    chartInfo: isCarioca ? "Dados atuais do mapa" : "Current chart info",
    chartGenerator: isCarioca ? "Gerador de mapa astral" : "Birth chart generator",
    birthDataForm: isCarioca ? "Formulario de dados de nascimento" : "Birth data form",
    analysisMode: isCarioca ? "Modo de analise" : "Analysis mode",
    contentMode: isCarioca ? "Modo de conteudo" : "Content mode",
    duoMode: isCarioca ? "Modo de dupla" : "Duo mode",
  };
  const cardExpandLabels = isCarioca
    ? { more: "Abrir mais", less: "Fechar" }
    : { more: "Show more", less: "Show less" };

  return (
    <>
      <div className="starfield" aria-hidden="true">
        <div className="starfield__layer starfield__layer--1" />
        <div className="starfield__layer starfield__layer--2" />
        <div className="starfield__layer starfield__layer--3" />
      </div>
      <div className="app">
      <div className="container">
        <header className="header" role="banner">
          <div className="header__brand">
            <h1 className="header__title">stellar</h1>
            <div
              className="header__meta"
              aria-label={ariaLabels.chartInfo}
              aria-live="polite"
              aria-atomic="true"
            >
              <span>{t.modeLabel}</span>
              {chartMeta && (
                <>
                  <span className="header__meta-divider" />
                  <span>{chartMeta.location}</span>
                  <span className="header__meta-divider" />
                  <span>{chartMeta.datetime}</span>
                </>
              )}
            </div>
          </div>
          <ModeToggle mode={mode} setMode={setMode} ariaLabel={ariaLabels.contentMode} />
        </header>

        <main role="main" aria-label={ariaLabels.chartGenerator}>
          <section className={`action-section ${cards.length > 0 ? "action-section--compact" : ""}`}>
            <form className="form" onSubmit={handleGenerateChart} aria-label={ariaLabels.birthDataForm}>
              <div className="analysis-mode" role="group" aria-label={ariaLabels.analysisMode}>
                <button
                  type="button"
                  className={`analysis-mode__btn ${analysisMode === "single" ? "analysis-mode__btn--active" : ""}`}
                  onClick={() => {
                    setError(null);
                    setAnalysisMode("single");
                  }}
                >
                  {t.singleMode}
                </button>
                <button
                  type="button"
                  className={`analysis-mode__btn ${analysisMode === "compatibility" ? "analysis-mode__btn--active" : ""}`}
                  onClick={() => {
                    setError(null);
                    setAnalysisMode("compatibility");
                  }}
                >
                  {t.compatibilityMode}
                </button>
              </div>

              {analysisMode === "compatibility" && (
                <div className="duo-mode" role="group" aria-label={ariaLabels.duoMode}>
                  <button
                    type="button"
                    className={`duo-mode__btn ${duoMode === "romantic" ? "duo-mode__btn--active" : ""}`}
                    onClick={() => setDuoMode("romantic")}
                  >
                    {t.duoModeRomantic}
                  </button>
                  <button
                    type="button"
                    className={`duo-mode__btn ${duoMode === "friend" ? "duo-mode__btn--active" : ""}`}
                    onClick={() => setDuoMode("friend")}
                  >
                    {t.duoModeFriend}
                  </button>
                </div>
              )}

              <PersonForm
                title={analysisMode === "compatibility" ? t.personA : undefined}
                framed={analysisMode === "compatibility"}
                locale={isCarioca ? "pt-BR" : "en-US"}
                date={dateA}
                time={timeA}
                daylightSavingValue={toDaylightSavingValue(daylightSavingA)}
                onDateChange={setDateA}
                onTimeChange={setTimeA}
                onDaylightSavingChange={(v) => setDaylightSavingA(parseDaylightSavingValue(v))}
                geo={geoA}
                labels={formLabels}
                hintId="city-hint-a"
                suggestionsId="city-suggestions-a"
                namePrefix="birth"
                activeIndex={kbA.activeIndex}
                onKeyDown={kbA.onKeyDown}
                showDaylightSavingOverride={showDaylightSavingOverrideA}
              />

              {analysisMode === "single" && (
                <div className="form__row form__row--actions">
                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? t.generating : chart ? t.generateNew : t.generate}
                  </button>
                </div>
              )}

              {analysisMode === "compatibility" && (
                <>
                  <PersonForm
                    title={t.personB}
                    framed
                    locale={isCarioca ? "pt-BR" : "en-US"}
                    date={dateB}
                    time={timeB}
                    daylightSavingValue={toDaylightSavingValue(daylightSavingB)}
                    onDateChange={setDateB}
                    onTimeChange={setTimeB}
                    onDaylightSavingChange={(v) => setDaylightSavingB(parseDaylightSavingValue(v))}
                    geo={geoB}
                    labels={formLabels}
                    hintId="city-hint-b"
                    suggestionsId="city-suggestions-b"
                    namePrefix="birth-b"
                    activeIndex={kbB.activeIndex}
                    onKeyDown={kbB.onKeyDown}
                    showDaylightSavingOverride={showDaylightSavingOverrideB}
                  />
                  <div className="form__row form__row--actions">
                    <button type="submit" className="btn-primary" disabled={loading}>
                      {loading ? t.generating : chart && chartB ? t.generateNew : t.generate}
                    </button>
                  </div>
                </>
              )}

              {error && (
                <p className="form__error" role="alert">
                  {t.error}: {error}
                </p>
              )}
            </form>
          </section>

          {!loading && analysisMode === "single" && chart && (
            <Section icon="🧭" title={t.normalizedTitle}>
              <div className="normalized">
                <p>Timezone: {chart.normalized.timezone}</p>
                <p>UTC: {chart.normalized.utcDateTime}</p>
                <p>Local: {chart.normalized.localDateTime}</p>
                <p>Offset: {chart.normalized.offsetMinutes} min</p>
                <p>
                  Lat/Lon: {chart.normalized.location.lat},{" "}
                  {chart.normalized.location.lon}
                </p>
                <p>
                  {t.dstLabel}: {chart.normalized.daylightSaving ? formLabels.yes : formLabels.no}
                </p>
              </div>
            </Section>
          )}

          {!loading && analysisMode === "compatibility" && chart && chartB && (
            <Section icon="🧭" title={t.normalizedTitle}>
              <div className="normalized normalized--comparison">
                <div className="normalized__card">
                  <h3 className="normalized__title">{t.personA}</h3>
                  <p>{chartMeta?.location}</p>
                  <p>{chartMeta?.datetime}</p>
                  <p>Timezone: {chart.normalized.timezone}</p>
                  <p>UTC: {chart.normalized.utcDateTime}</p>
                  <p>{t.dstLabel}: {chart.normalized.daylightSaving ? formLabels.yes : formLabels.no}</p>
                </div>
                <div className="normalized__card">
                  <h3 className="normalized__title">{t.personB}</h3>
                  <p>{chartMetaB?.location}</p>
                  <p>{chartMetaB?.datetime}</p>
                  <p>Timezone: {chartB.normalized.timezone}</p>
                  <p>UTC: {chartB.normalized.utcDateTime}</p>
                  <p>{t.dstLabel}: {chartB.normalized.daylightSaving ? formLabels.yes : formLabels.no}</p>
                </div>
              </div>
              <div className="comparison-placements">
                <div>
                  <h3 className="comparison-placements__title">{t.personA}</h3>
                  <PlacementsSummary placements={placements} />
                </div>
                <div>
                  <h3 className="comparison-placements__title">{t.personB}</h3>
                  <PlacementsSummary placements={placementsB} />
                </div>
              </div>
            </Section>
          )}

          {loading && <LoadingState label={t.loading} />}

          {!loading && history.length > 0 && (
            <Section icon="🗂️" title={t.historyTitle} badge={`${history.length}`}>
              <div className="history-list">
                {history.map((entry) => {
                  const when = new Date(entry.createdAt);
                  const modeLabel =
                    entry.analysisMode === "compatibility"
                      ? `${t.historyCompatibility} · ${entry.duoMode === "friend" ? t.duoModeFriend : t.duoModeRomantic}`
                      : t.historySingle;
                  const cities =
                    entry.analysisMode === "compatibility" && entry.chartB
                      ? `${entry.chartA.input.city} + ${entry.chartB.input.city}`
                      : entry.chartA.input.city;
                  return (
                    <div key={entry.id} className="history-item">
                      <div className="history-item__meta">
                        <p className="history-item__title">{cities}</p>
                        <p className="history-item__subtitle">
                          {modeLabel} · {when.toLocaleString(isCarioca ? "pt-BR" : "en-US")}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="history-item__load"
                        onClick={() => handleLoadHistory(entry)}
                      >
                        {t.historyLoad}
                      </button>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {!loading && analysisMode === "single" && cards.length === 0 && (
            <p className="empty-state">
              {t.emptyState}
            </p>
          )}

          {!loading && analysisMode === "compatibility" && !comparison && (
            <p className="empty-state">
              {t.compatibilityEmpty}
            </p>
          )}

          {!loading && analysisMode === "single" && placements.length > 0 && (
            <PlacementsSummary placements={placements} />
          )}

          {!loading && analysisMode === "single" && heroCards.length > 0 && (
            <Section icon="☀️" title="Big 3" badge={`${heroCards.length} cards`}>
              <div className="cards-grid--hero">
                {heroCards.map((card) => (
                  <Card
                    key={`${resultVersion}-${card.key}`}
                    title={card.title}
                    subtitle={card.subtitle}
                    text={card.text}
                    tags={card.tags}
                    details={card.details}
                    element={card.element}
                    variant="hero"
                    degree={card.degree}
                    expandLabels={cardExpandLabels}
                  />
                ))}
              </div>
            </Section>
          )}

          {!loading && analysisMode === "single" && planetCards.length > 0 && (
            <Section
              icon="🪐"
              title={t.planetsTitle}
              badge={`${planetCards.length} cards`}
            >
              <div className="cards-grid--planets">
                {planetCards.map((card) => (
                  <Card
                    key={`${resultVersion}-${card.key}`}
                    title={card.title}
                    subtitle={card.subtitle}
                    text={card.text}
                    tags={card.tags}
                    details={card.details}
                    element={card.element}
                    variant="planet"
                    degree={card.degree}
                    expandLabels={cardExpandLabels}
                  />
                ))}
              </div>
            </Section>
          )}

          {!loading && analysisMode === "single" && aspectCards.length > 0 && (
            <Section
              icon="🔗"
              title={t.aspectsTitle}
              badge={t.aspectsBadge(aspectCards.length)}
              badgeAccent
            >
              <div className="cards-grid--aspects">
                {aspectCards.map((card) => (
                  <Card
                    key={`${resultVersion}-${card.key}`}
                    title={card.title}
                    subtitle={card.subtitle}
                    text={card.text}
                    tags={card.tags}
                    details={card.details}
                    variant="aspect"
                    orb={card.orb}
                    expandLabels={cardExpandLabels}
                  />
                ))}
              </div>
            </Section>
          )}

          {!loading && analysisMode === "compatibility" && comparison && comparison.stats.length > 0 && (
            <Section icon="🎮" title={t.compatibilityStatsTitle} badge={t.compatibilityStatsBadge}>
              <div className="synastry-stats">
                {comparison.stats.map((stat) => (
                  <div key={stat.key} className="synastry-stats__item">
                    <div className="synastry-stats__head">
                      <h3 className="synastry-stats__label">{stat.label}</h3>
                      <span className="synastry-stats__value">{stat.score}%</span>
                    </div>
                    <p className="synastry-stats__summary">{stat.summary}</p>
                    <div className="synastry-stats__track" aria-hidden="true">
                      <div
                        className={`synastry-stats__bar synastry-stats__bar--${stat.key}`}
                        style={{ width: `${stat.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {!loading && analysisMode === "compatibility" && dailyOutlook && (
            <Section icon="📆" title={t.todayForUsTitle} badge={`${t.todayForUsBadge} · ${dailyOutlook.dateLabel}`}>
              <div className="cards-grid--today">
                <Card
                  key={`${resultVersion}-${dailyOutlook.opportunity.key}`}
                  title={dailyOutlook.opportunity.title}
                  subtitle={dailyOutlook.opportunity.subtitle}
                  text={dailyOutlook.opportunity.text}
                  tags={dailyOutlook.opportunity.tags}
                  details={dailyOutlook.opportunity.details}
                  tone={dailyOutlook.opportunity.tone}
                  variant="synastry"
                  orb={dailyOutlook.opportunity.orb}
                  expandLabels={cardExpandLabels}
                />
                <Card
                  key={`${resultVersion}-${dailyOutlook.watchout.key}`}
                  title={dailyOutlook.watchout.title}
                  subtitle={dailyOutlook.watchout.subtitle}
                  text={dailyOutlook.watchout.text}
                  tags={dailyOutlook.watchout.tags}
                  details={dailyOutlook.watchout.details}
                  tone={dailyOutlook.watchout.tone}
                  variant="synastry"
                  orb={dailyOutlook.watchout.orb}
                  expandLabels={cardExpandLabels}
                />
              </div>
            </Section>
          )}

          {!loading && analysisMode === "compatibility" && comparison && comparisonCards.length > 0 && (
            <Section
              icon="🤝"
              title={t.compatibilityTitle}
              badge={t.compatibilityBadge(comparisonCards.length)}
              badgeAccent
            >
              <div className="cards-grid--synastry">
                {comparisonCards.map((card) => (
                  <Card
                    key={`${resultVersion}-${card.key}`}
                    title={card.title}
                    subtitle={card.subtitle}
                    text={card.text}
                    tags={card.tags}
                    details={card.details}
                    tone={card.tone}
                    variant="synastry"
                    orb={card.orb}
                    expandLabels={cardExpandLabels}
                  />
                ))}
              </div>
            </Section>
          )}
        </main>
      </div>
    </div>
    </>
  );
}

export default App;
