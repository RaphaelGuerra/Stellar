import { useState, useEffect, useMemo, useRef, type FormEvent } from "react";
import tzLookup from "tz-lookup";
import { useContentMode } from "./content/useContentMode";
import { ModeToggle } from "./components/ModeToggle";
import { buildCards, buildPlacementsSummary, type CardModel, type PlacementSummary } from "./lib/cards";
import { aspectSymbol } from "./lib/aspectContext";
import { AmbiguousLocalTimeError, NonexistentLocalTimeError, generateChart } from "./lib/engine";
import { buildChartComparison } from "./lib/synastry";
import { validateChartInput } from "./lib/validation";
import { SUPPORTED_CITIES } from "./lib/resolveCity";
import type { ChartInput, ChartResult } from "./lib/types";

interface CardProps {
  title: string;
  subtitle?: string;
  text: string;
  tags: readonly string[];
  element?: string;
  variant?: "hero" | "planet" | "aspect";
  degree?: number;
  orb?: number;
}

type AnalysisMode = "single" | "compatibility";

function parseLocationInput(value: string): { city: string; country: string } {
  const trimmed = value.trim();
  if (!trimmed) return { city: "", country: "" };

  const commaMatch = trimmed.match(/^(.+),\s*([A-Za-z]{2,3})$/);
  if (commaMatch) {
    return {
      city: commaMatch[1].trim(),
      country: commaMatch[2].trim().toUpperCase(),
    };
  }

  const parenMatch = trimmed.match(/^(.+)\(([^)]+)\)\s*$/);
  if (parenMatch) {
    return {
      city: parenMatch[1].trim(),
      country: parenMatch[2].trim().toUpperCase(),
    };
  }

  return { city: trimmed, country: "" };
}

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  country_code?: string;
}

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
}

interface GeoSuggestion {
  id: string;
  label: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  timezone: string;
}

interface CacheEntry {
  ts: number;
  results: GeoSuggestion[];
}

interface RequestTimestampRef {
  current: number;
}

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_EMAIL = "phaelixai@gmail.com";
const SEARCH_MIN_CHARS = 3;
const SEARCH_DEBOUNCE_MS = 450;
const SEARCH_RATE_LIMIT_MS = 1100;
const CACHE_KEY = "stellar-city-cache-v1";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const CACHE_LIMIT = 50;

const EN_VALIDATION_MESSAGES: Record<string, string> = {
  "Data é obrigatória": "Date is required.",
  "Formato de data inválido (esperado: YYYY-MM-DD)": "Invalid date format (expected: YYYY-MM-DD).",
  "Data inválida": "Invalid calendar date.",
  "Data deve ser posterior a 1900": "Date must be later than 1900.",
  "Hora é obrigatória": "Time is required.",
  "Formato de hora inválido (esperado: HH:mm)": "Invalid time format (expected: HH:mm).",
  "Cidade e país são obrigatórios (ex: Rio de Janeiro, BR)":
    "City and country are required (e.g. New York, US).",
  "Nome da cidade deve ter pelo menos 2 caracteres": "City name must have at least 2 characters.",
  "Código do país deve ter pelo menos 2 caracteres": "Country code must have at least 2 characters.",
  "Data não pode ser no futuro": "Date/time cannot be in the future.",
  "Timezone inválido para a localização informada": "Invalid timezone for the selected location.",
};

const CARIOCA_VALIDATION_MESSAGES: Record<string, string> = {
  "Data é obrigatória": "Sem data nao rola, porra.",
  "Formato de data inválido (esperado: YYYY-MM-DD)":
    "A data ta zoada, mermão. Usa YYYY-MM-DD sem inventar moda.",
  "Data inválida": "Essa data ai ta errada pra caralho.",
  "Data deve ser posterior a 1900": "Ta puxando data jurassica demais. Manda depois de 1900.",
  "Hora é obrigatória": "Sem hora nao tem mapa, caralho.",
  "Formato de hora inválido (esperado: HH:mm)":
    "Hora toda cagada. Usa HH:mm certinho.",
  "Cidade e país são obrigatórios (ex: Rio de Janeiro, BR)":
    "Manda cidade e pais direito, porra. Ex: Rio de Janeiro, BR.",
  "Nome da cidade deve ter pelo menos 2 caracteres":
    "Nome de cidade com 1 letra e sacanagem. Bota pelo menos 2.",
  "Código do país deve ter pelo menos 2 caracteres":
    "Codigo do pais ta curto pra cacete. Usa pelo menos 2 letras.",
  "Data não pode ser no futuro":
    "Nascer no futuro nao da, ne porra.",
  "Timezone inválido para a localização informada":
    "Timezone dessa localizacao veio toda errada.",
};

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getSearchLanguage(isCarioca: boolean): string {
  return isCarioca ? "pt-BR" : "en";
}

function buildCacheKey(normalizedQuery: string, language: string): string {
  return `${language}|${normalizedQuery}`;
}

function formatValidationMessages(errors: readonly string[], isCarioca: boolean): string[] {
  const dictionary = isCarioca ? CARIOCA_VALIDATION_MESSAGES : EN_VALIDATION_MESSAGES;
  return errors.map((message) => dictionary[message] ?? message);
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

function pickCityName(address?: NominatimAddress): string | null {
  if (!address) return null;
  return (
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    address.state ||
    null
  );
}

function buildSuggestion(result: NominatimResult): GeoSuggestion | null {
  const lat = Number(result.lat);
  const lon = Number(result.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const city = pickCityName(result.address);
  const country = result.address?.country_code?.toUpperCase() ?? "";
  if (!city || !country) return null;

  const region = result.address?.state && result.address.state !== city ? result.address.state : "";
  const labelParts = [city, region, country].filter(Boolean);
  const label = labelParts.join(", ");

  return {
    id: String(result.place_id ?? `${lat},${lon}`),
    label,
    city,
    country,
    lat,
    lon,
    timezone: tzLookup(lat, lon),
  };
}

function toUniqueSuggestions(results: NominatimResult[]): GeoSuggestion[] {
  const unique = new Map<string, GeoSuggestion>();
  for (const item of results) {
    const suggestion = buildSuggestion(item);
    if (!suggestion) continue;
    const key = `${suggestion.label}|${suggestion.lat}|${suggestion.lon}`;
    if (!unique.has(key)) {
      unique.set(key, suggestion);
    }
  }
  return Array.from(unique.values());
}

function waitFor(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (signal) signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timeout);
      if (signal) signal.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort);
    }
  });
}

function pruneCache(cache: Map<string, CacheEntry>) {
  if (cache.size <= CACHE_LIMIT) return;
  const entries = Array.from(cache.entries()).sort((a, b) => b[1].ts - a[1].ts);
  cache.clear();
  for (const [query, entry] of entries.slice(0, CACHE_LIMIT)) {
    cache.set(query, entry);
  }
}

function persistCache(cache: Map<string, CacheEntry>) {
  if (typeof window === "undefined") return;
  pruneCache(cache);
  const entries = Array.from(cache.entries())
    .map(([query, entry]) => ({
      query,
      ts: entry.ts,
      results: entry.results,
    }))
    .sort((a, b) => b.ts - a.ts);
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage failures (quota, disabled).
  }
}

function loadCacheFromStorage(): Map<string, CacheEntry> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Array<{
      query: string;
      ts: number;
      results: GeoSuggestion[];
    }>;
    const now = Date.now();
    const cache = new Map<string, CacheEntry>();
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (!entry || typeof entry.query !== "string" || typeof entry.ts !== "number") {
          continue;
        }
        if (!Array.isArray(entry.results)) continue;
        if (now - entry.ts > CACHE_TTL_MS) continue;
        cache.set(entry.query, { ts: entry.ts, results: entry.results });
      }
    }
    pruneCache(cache);
    return cache;
  } catch {
    return new Map();
  }
}

function getCachedResults(query: string, cache: Map<string, CacheEntry>): GeoSuggestion[] | null {
  const entry = cache.get(query);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(query);
    persistCache(cache);
    return null;
  }
  return entry.results;
}

function setCachedResults(query: string, results: GeoSuggestion[], cache: Map<string, CacheEntry>) {
  cache.set(query, { ts: Date.now(), results });
  persistCache(cache);
}

async function fetchNominatim(
  query: string,
  limit: number,
  lastRequestAt: RequestTimestampRef,
  language: string,
  signal?: AbortSignal
): Promise<NominatimResult[]> {
  const sinceLast = Date.now() - lastRequestAt.current;
  const waitMs = Math.max(0, SEARCH_RATE_LIMIT_MS - sinceLast);
  if (waitMs > 0) {
    await waitFor(waitMs, signal);
  }
  lastRequestAt.current = Date.now();

  const params = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    limit: String(limit),
    q: query,
    email: NOMINATIM_EMAIL,
  });
  params.set("accept-language", language);

  const response = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, { signal });
  if (!response.ok) {
    throw new Error(`Nominatim error: ${response.status}`);
  }
  return (await response.json()) as NominatimResult[];
}

function Card({ title, subtitle, text, tags, element, variant, degree, orb }: CardProps) {
  const classes = [
    "card",
    element ? `card--${element}` : "",
    variant ? `card--${variant}` : "",
  ].filter(Boolean).join(" ");

  const hasBadge = (degree != null) || (orb != null);

  return (
    <article className={classes}>
      {hasBadge ? (
        <div className="card__header">
          <h3 className="card__title">{title}</h3>
          {degree != null && (
            <span className="card__degree-badge">{degree.toFixed(1)}&deg;</span>
          )}
          {orb != null && (
            <span className="card__orb-badge">{orb.toFixed(1)}&deg; orb</span>
          )}
        </div>
      ) : (
        <h3 className="card__title">{title}</h3>
      )}
      {subtitle && <p className="card__subtitle">{subtitle}</p>}
      <p className="card__text">{text}</p>
      <div className="card__tags">
        {tags.map((tag) => (
          <span key={tag} className="tag">
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
}

function PlacementsSummary({ placements }: { placements: PlacementSummary[] }) {
  if (placements.length === 0) return null;
  return (
    <div className="placements-strip">
      {placements.map((p) => (
        <span key={p.planet} className={`placements-strip__item placements-strip__item--${p.element}`}>
          {p.planetSymbol} {p.signSymbol}
          {p.degree != null && (
            <span className="placements-strip__degree">{p.degree.toFixed(1)}&deg;</span>
          )}
        </span>
      ))}
    </div>
  );
}

interface SectionProps {
  icon: string;
  title: string;
  badge?: string;
  badgeAccent?: boolean;
  children: React.ReactNode;
}

function Section({ icon, title, badge, badgeAccent, children }: SectionProps) {
  return (
    <section className="section">
      <div className="section__header">
        <span className="section__icon">{icon}</span>
        <h2 className="section__title">{title}</h2>
        {badge && (
          <span className={`section__badge ${badgeAccent ? "section__badge--accent" : ""}`}>
            {badge}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="loading-state" role="status" aria-live="polite" aria-busy="true">
      <div className="spinner" aria-hidden="true" />
      <p className="loading-text">{label}</p>
    </div>
  );
}

function App() {
  const { mode, setMode, content } = useContentMode();
  const isCarioca = mode === "carioca";
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("single");
  const [input, setInput] = useState<ChartInput>({
    date: "1990-01-01",
    time: "12:00",
    city: "Rio de Janeiro",
    country: "BR",
    daylight_saving: "auto",
  });
  const [inputB, setInputB] = useState<ChartInput>({
    date: "1990-01-01",
    time: "12:00",
    city: "New York",
    country: "US",
    daylight_saving: "auto",
  });
  const [locationInput, setLocationInput] = useState(
    `${input.city}, ${input.country}`
  );
  const [locationInputB, setLocationInputB] = useState(
    `${inputB.city}, ${inputB.country}`
  );
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [suggestionsB, setSuggestionsB] = useState<GeoSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchingB, setIsSearchingB] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchErrorB, setSearchErrorB] = useState<string | null>(null);
  const [selectedLocationLabel, setSelectedLocationLabel] = useState<string | null>(null);
  const [selectedLocationLabelB, setSelectedLocationLabelB] = useState<string | null>(null);
  const searchCache = useRef<Map<string, CacheEntry>>(loadCacheFromStorage());
  const lastRequestAt = useRef(0);
  const [chart, setChart] = useState<ChartResult | null>(null);
  const [chartB, setChartB] = useState<ChartResult | null>(null);
  const [cards, setCards] = useState<CardModel[]>([]);
  const [placements, setPlacements] = useState<PlacementSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recalculate cards and placements when mode changes (if chart exists)
  useEffect(() => {
    if (chart) {
      setCards(buildCards(content, chart, mode));
      setPlacements(buildPlacementsSummary(chart));
    }
  }, [mode, content, chart]);

  useEffect(() => {
    const parsed = parseLocationInput(locationInput);
    setInput((prev) => ({
      ...prev,
      city: parsed.city,
      country: parsed.country,
      location: selectedLocationLabel === locationInput ? prev.location : undefined,
    }));
    if (selectedLocationLabel && selectedLocationLabel !== locationInput) {
      setSelectedLocationLabel(null);
    }
  }, [locationInput, selectedLocationLabel]);

  useEffect(() => {
    const parsed = parseLocationInput(locationInputB);
    setInputB((prev) => ({
      ...prev,
      city: parsed.city,
      country: parsed.country,
      location: selectedLocationLabelB === locationInputB ? prev.location : undefined,
    }));
    if (selectedLocationLabelB && selectedLocationLabelB !== locationInputB) {
      setSelectedLocationLabelB(null);
    }
  }, [locationInputB, selectedLocationLabelB]);

  useEffect(() => {
    const query = locationInput.trim();
    const normalized = normalizeQuery(query);
    const language = getSearchLanguage(isCarioca);
    const cacheKey = buildCacheKey(normalized, language);

    if (selectedLocationLabel && locationInput === selectedLocationLabel) {
      setSuggestions([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    if (normalized.length < SEARCH_MIN_CHARS) {
      setSuggestions([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    const cached = getCachedResults(cacheKey, searchCache.current);
    if (cached !== null) {
      setSuggestions(cached);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setSearchError(null);
      setIsSearching(true);
      try {
        const data = await fetchNominatim(query, 6, lastRequestAt, language, controller.signal);
        const results = toUniqueSuggestions(data);
        setCachedResults(cacheKey, results, searchCache.current);
        setSuggestions(results);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setSuggestions([]);
        setSearchError(
          isCarioca ? "Nao deu pra buscar cidade agora, mermão. Tenta de novo ja ja." : "Could not search cities right now."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [isCarioca, locationInput, selectedLocationLabel]);

  useEffect(() => {
    if (analysisMode !== "compatibility") {
      setSuggestionsB([]);
      setSearchErrorB(null);
      setIsSearchingB(false);
      return;
    }

    const query = locationInputB.trim();
    const normalized = normalizeQuery(query);
    const language = getSearchLanguage(isCarioca);
    const cacheKey = buildCacheKey(normalized, language);

    if (selectedLocationLabelB && locationInputB === selectedLocationLabelB) {
      setSuggestionsB([]);
      setSearchErrorB(null);
      setIsSearchingB(false);
      return;
    }

    if (normalized.length < SEARCH_MIN_CHARS) {
      setSuggestionsB([]);
      setSearchErrorB(null);
      setIsSearchingB(false);
      return;
    }

    const cached = getCachedResults(cacheKey, searchCache.current);
    if (cached !== null) {
      setSuggestionsB(cached);
      setSearchErrorB(null);
      setIsSearchingB(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setSearchErrorB(null);
      setIsSearchingB(true);
      try {
        const data = await fetchNominatim(query, 6, lastRequestAt, language, controller.signal);
        const results = toUniqueSuggestions(data);
        setCachedResults(cacheKey, results, searchCache.current);
        setSuggestionsB(results);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setSuggestionsB([]);
        setSearchErrorB(
          isCarioca ? "Nao deu pra buscar cidade agora, mermão. Tenta de novo ja ja." : "Could not search cities right now."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingB(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [analysisMode, isCarioca, locationInputB, selectedLocationLabelB]);

  // Separate cards into hero / planet / aspect sections
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

  // Format chart meta info
  const chartLocale = isCarioca ? "pt-BR" : "en-US";

  const chartMeta = useMemo(() => {
    if (!chart?.input) return null;
    const { city, date, time } = chart.input;
    const formattedDate = new Date(`${date}T${time}`).toLocaleDateString(chartLocale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return { location: city, datetime: `${formattedDate}, ${time}` };
  }, [chart, chartLocale]);

  const chartMetaB = useMemo(() => {
    if (!chartB?.input) return null;
    const { city, date, time } = chartB.input;
    const formattedDate = new Date(`${date}T${time}`).toLocaleDateString(chartLocale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return { location: city, datetime: `${formattedDate}, ${time}` };
  }, [chartB, chartLocale]);

  const placementsB = useMemo(() => {
    if (!chartB) return [];
    return buildPlacementsSummary(chartB);
  }, [chartB]);

  const comparison = useMemo(() => {
    if (analysisMode !== "compatibility" || !chart || !chartB) return null;
    return buildChartComparison(chart, chartB, isCarioca ? "pt" : "en");
  }, [analysisMode, chart, chartB, isCarioca]);

  const comparisonCards = useMemo(() => {
    if (!comparison) return [];
    return comparison.highlights.map((highlight) => ({
      key: highlight.key,
      title: highlight.title,
      text: highlight.text,
      tags: highlight.tags,
      subtitle: highlight.related?.aspect
        ? `${highlight.related.aspect.a.planet} ${aspectSymbol(highlight.related.aspect.type)} ${highlight.related.aspect.b.planet}`
        : undefined,
      orb: highlight.related?.aspect?.orb,
    }));
  }, [comparison]);

  const daylightSavingValue =
    input.daylight_saving === "auto"
      ? "auto"
      : input.daylight_saving
      ? "true"
      : "false";

  const daylightSavingValueB =
    inputB.daylight_saving === "auto"
      ? "auto"
      : inputB.daylight_saving
      ? "true"
      : "false";

  const showSuggestions = suggestions.length > 0;
  const showNoResults =
    !isSearching &&
    !searchError &&
    suggestions.length === 0 &&
    normalizeQuery(locationInput).length >= SEARCH_MIN_CHARS &&
    locationInput !== selectedLocationLabel;
  const showSuggestionsB = suggestionsB.length > 0;
  const showNoResultsB =
    !isSearchingB &&
    !searchErrorB &&
    suggestionsB.length === 0 &&
    normalizeQuery(locationInputB).length >= SEARCH_MIN_CHARS &&
    locationInputB !== selectedLocationLabelB;

  function handleSelectSuggestion(suggestion: GeoSuggestion) {
    setSelectedLocationLabel(suggestion.label);
    setLocationInput(suggestion.label);
    setSuggestions([]);
    setSearchError(null);
    setInput((prev) => ({
      ...prev,
      city: suggestion.city,
      country: suggestion.country,
      location: {
        lat: suggestion.lat,
        lon: suggestion.lon,
        timezone: suggestion.timezone,
      },
    }));
  }

  function handleSelectSuggestionB(suggestion: GeoSuggestion) {
    setSelectedLocationLabelB(suggestion.label);
    setLocationInputB(suggestion.label);
    setSuggestionsB([]);
    setSearchErrorB(null);
    setInputB((prev) => ({
      ...prev,
      city: suggestion.city,
      country: suggestion.country,
      location: {
        lat: suggestion.lat,
        lon: suggestion.lon,
        timezone: suggestion.timezone,
      },
    }));
  }

  async function resolveLocationCandidates(query: string, limit = 6): Promise<GeoSuggestion[] | null> {
    const normalized = normalizeQuery(query);
    const language = getSearchLanguage(isCarioca);
    const cacheKey = buildCacheKey(normalized, language);
    const cached = getCachedResults(cacheKey, searchCache.current);
    if (cached && cached.length > 0) {
      if (limit <= 1 || cached.length > 1) {
        return cached.slice(0, limit);
      }
    }

    try {
      const data = await fetchNominatim(query, limit, lastRequestAt, language);
      const results = toUniqueSuggestions(data);
      if (results.length > 0) {
        setCachedResults(cacheKey, results, searchCache.current);
      }
      return results;
    } catch {
      return null;
    }
  }

  async function ensureResolvedInput(
    currentInput: ChartInput,
    currentLocationInput: string,
    options?: {
      personLabel?: string;
      onResolved?: (suggestion: GeoSuggestion, resolvedInput: ChartInput) => void;
      onAmbiguous?: (candidates: GeoSuggestion[]) => void;
    }
  ): Promise<ChartInput | null> {
    const withPrefix = (message: string) =>
      options?.personLabel ? `${options.personLabel}: ${message}` : message;

    let nextInput = currentInput;
    if (!currentInput.location) {
      if (normalizeQuery(currentLocationInput).length < SEARCH_MIN_CHARS) {
        setError(
          withPrefix(
            isCarioca
              ? "Manda pelo menos 3 letras da cidade, porra."
              : "Type at least 3 characters to search for a city."
          )
        );
        return null;
      }
      const candidates = await resolveLocationCandidates(currentLocationInput, 6);
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
        options?.onAmbiguous?.(candidates);
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
      nextInput = {
        ...currentInput,
        city: fallback.city,
        country: fallback.country,
        location: {
          lat: fallback.lat,
          lon: fallback.lon,
          timezone: fallback.timezone,
        },
      };
      options?.onResolved?.(fallback, nextInput);
    }

    const validation = validateChartInput(nextInput);
    if (!validation.valid) {
      setError(withPrefix(formatValidationMessages(validation.errors, isCarioca).join(". ")));
      return null;
    }
    return nextInput;
  }

  async function handleGenerateChart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    setLoading(true);
    try {
      const inputA = await ensureResolvedInput(input, locationInput, {
        personLabel: analysisMode === "compatibility" ? (isCarioca ? "Pessoa A" : "Person A") : undefined,
        onResolved: (fallback, resolvedInput) => {
          setSelectedLocationLabel(fallback.label);
          setLocationInput(fallback.label);
          setSuggestions([]);
          setSearchError(null);
          setInput(resolvedInput);
        },
        onAmbiguous: (candidates) => {
          setSuggestions(candidates);
          setSearchError(null);
        },
      });
      if (!inputA) return;

      if (analysisMode === "single") {
        const newChart = await generateChart(inputA);
        setChart(newChart);
        setChartB(null);
        setCards(buildCards(content, newChart, mode));
        setPlacements(buildPlacementsSummary(newChart));
        return;
      }

      const inputResolvedB = await ensureResolvedInput(inputB, locationInputB, {
        personLabel: isCarioca ? "Pessoa B" : "Person B",
        onResolved: (fallback, resolvedInput) => {
          setSelectedLocationLabelB(fallback.label);
          setLocationInputB(fallback.label);
          setSuggestionsB([]);
          setSearchErrorB(null);
          setInputB(resolvedInput);
        },
        onAmbiguous: (candidates) => {
          setSuggestionsB(candidates);
          setSearchErrorB(null);
        },
      });
      if (!inputResolvedB) return;

      const [newChartA, newChartB] = await Promise.all([
        generateChart(inputA),
        generateChart(inputResolvedB),
      ]);
      setChart(newChartA);
      setChartB(newChartB);
      setCards(buildCards(content, newChartA, mode));
      setPlacements(buildPlacementsSummary(newChartA));
    } catch (err) {
      setError(formatRuntimeError(err, isCarioca));
    } finally {
      setLoading(false);
    }
  }

  const t = {
    modeLabel: isCarioca ? "Carioca raiz, porra" : "English",
    singleMode: isCarioca ? "Mapa solo bolado" : "Single chart",
    compatibilityMode: isCarioca ? "Sinastria braba" : "Compatibility",
    personA: isCarioca ? "Pessoa A (tu)" : "Person A",
    personB: isCarioca ? "Pessoa B (o outro)" : "Person B",
    date: isCarioca ? "Data" : "Date",
    time: isCarioca ? "Hora" : "Time",
    cityAndCountry: isCarioca ? "Cidade e pais, sem caozada" : "City & country",
    searchPlaceholder: isCarioca ? "Ex: Rio de Janeiro, BR" : "e.g. New York, US",
    searching: isCarioca ? "Caçando cidade..." : "Searching cities...",
    noResults: isCarioca ? "Nao achei porra nenhuma." : "No cities found.",
    cityHint: isCarioca
      ? `Manda a cidade com pais certinho, mermão. Ou usa um exemplo: ${SUPPORTED_CITIES.join(", ")}`
      : `Type to search cities worldwide or try: ${SUPPORTED_CITIES.join(", ")}`,
    daylightSaving: isCarioca ? "Horario de verao" : "Daylight saving",
    yes: isCarioca ? "Sim, porra" : "Yes",
    no: isCarioca ? "Nao, porra" : "No",
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
  };

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
              aria-label="Current chart info"
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
          <ModeToggle mode={mode} setMode={setMode} />
        </header>

        <main role="main" aria-label="Birth chart generator">
          <section className={`action-section ${cards.length > 0 ? "action-section--compact" : ""}`}>
            <form className="form" onSubmit={handleGenerateChart} aria-label="Birth data form">
              <div className="analysis-mode" role="group" aria-label="Analysis mode">
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

              <div className={`form__person ${analysisMode === "compatibility" ? "form__person--framed" : ""}`}>
                {analysisMode === "compatibility" && <h3 className="form__person-title">{t.personA}</h3>}
                <div className="form__row">
                  <label className="form__label">
                    {t.date}
                    <input
                      type="date"
                      name="birth-date"
                      autoComplete="bday"
                      value={input.date}
                      onChange={(event) =>
                        setInput((prev) => ({ ...prev, date: event.target.value }))
                      }
                      required
                    />
                  </label>
                  <label className="form__label">
                    {t.time}
                    <input
                      type="time"
                      name="birth-time"
                      autoComplete="off"
                      value={input.time}
                      onChange={(event) =>
                        setInput((prev) => ({ ...prev, time: event.target.value }))
                      }
                      required
                    />
                  </label>
                </div>
                <div className="form__row">
                  <label className="form__label">
                    {t.cityAndCountry}
                    <div className="city-search">
                      <input
                        type="text"
                        name="birth-location"
                        value={locationInput}
                        onChange={(event) => setLocationInput(event.target.value)}
                        required
                        aria-describedby="city-hint-a"
                        aria-autocomplete="list"
                        aria-controls="city-suggestions-a"
                        aria-expanded={showSuggestions}
                        autoComplete="off"
                        inputMode="search"
                        placeholder={t.searchPlaceholder}
                      />
                      <div className="city-search__status-area" role="status" aria-live="polite">
                        {isSearching && (
                          <span className="city-search__status">{t.searching}</span>
                        )}
                        {searchError && (
                          <span className="city-search__status city-search__status--error">
                            {searchError}
                          </span>
                        )}
                        {showNoResults && (
                          <span className="city-search__status">{t.noResults}</span>
                        )}
                      </div>
                      {showSuggestions && (
                        <ul className="city-search__list" role="listbox" id="city-suggestions-a">
                          {suggestions.map((suggestion) => (
                            <li key={suggestion.id} className="city-search__item">
                              <button
                                type="button"
                                className="city-search__option"
                                onClick={() => handleSelectSuggestion(suggestion)}
                              >
                                <span className="city-search__option-label">
                                  {suggestion.label}
                                </span>
                                <span className="city-search__option-meta">
                                  {suggestion.timezone}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </label>
                </div>
                <p id="city-hint-a" className="form__hint">
                  {t.cityHint}
                </p>
                <div className="form__row">
                  <label className="form__label">
                    {t.daylightSaving}
                    <select
                      name="daylight-saving"
                      value={daylightSavingValue}
                      onChange={(event) => {
                        const value = event.target.value;
                        const nextValue =
                          value === "auto" ? "auto" : value === "true";
                        setInput((prev) => ({
                          ...prev,
                          daylight_saving: nextValue,
                        }));
                      }}
                    >
                      <option value="auto">Auto</option>
                      <option value="true">{t.yes}</option>
                      <option value="false">{t.no}</option>
                    </select>
                  </label>
                  {analysisMode === "single" && (
                    <button type="submit" className="btn-primary" disabled={loading}>
                      {loading ? t.generating : chart ? t.generateNew : t.generate}
                    </button>
                  )}
                </div>
              </div>

              {analysisMode === "compatibility" && (
                <div className="form__person form__person--framed">
                  <h3 className="form__person-title">{t.personB}</h3>
                  <div className="form__row">
                    <label className="form__label">
                      {t.date}
                      <input
                        type="date"
                        name="birth-date-b"
                        autoComplete="bday"
                        value={inputB.date}
                        onChange={(event) =>
                          setInputB((prev) => ({ ...prev, date: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <label className="form__label">
                      {t.time}
                      <input
                        type="time"
                        name="birth-time-b"
                        autoComplete="off"
                        value={inputB.time}
                        onChange={(event) =>
                          setInputB((prev) => ({ ...prev, time: event.target.value }))
                        }
                        required
                      />
                    </label>
                  </div>
                  <div className="form__row">
                    <label className="form__label">
                      {t.cityAndCountry}
                      <div className="city-search">
                        <input
                          type="text"
                          name="birth-location-b"
                          value={locationInputB}
                          onChange={(event) => setLocationInputB(event.target.value)}
                          required
                          aria-describedby="city-hint-b"
                          aria-autocomplete="list"
                          aria-controls="city-suggestions-b"
                          aria-expanded={showSuggestionsB}
                          autoComplete="off"
                          inputMode="search"
                          placeholder={t.searchPlaceholder}
                        />
                        <div className="city-search__status-area" role="status" aria-live="polite">
                          {isSearchingB && (
                            <span className="city-search__status">{t.searching}</span>
                          )}
                          {searchErrorB && (
                            <span className="city-search__status city-search__status--error">
                              {searchErrorB}
                            </span>
                          )}
                          {showNoResultsB && (
                            <span className="city-search__status">{t.noResults}</span>
                          )}
                        </div>
                        {showSuggestionsB && (
                          <ul className="city-search__list" role="listbox" id="city-suggestions-b">
                            {suggestionsB.map((suggestion) => (
                              <li key={suggestion.id} className="city-search__item">
                                <button
                                  type="button"
                                  className="city-search__option"
                                  onClick={() => handleSelectSuggestionB(suggestion)}
                                >
                                  <span className="city-search__option-label">
                                    {suggestion.label}
                                  </span>
                                  <span className="city-search__option-meta">
                                    {suggestion.timezone}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </label>
                  </div>
                  <p id="city-hint-b" className="form__hint">
                    {t.cityHint}
                  </p>
                  <div className="form__row">
                    <label className="form__label">
                      {t.daylightSaving}
                      <select
                        name="daylight-saving-b"
                        value={daylightSavingValueB}
                        onChange={(event) => {
                          const value = event.target.value;
                          const nextValue =
                            value === "auto" ? "auto" : value === "true";
                          setInputB((prev) => ({
                            ...prev,
                            daylight_saving: nextValue,
                          }));
                        }}
                      >
                        <option value="auto">Auto</option>
                        <option value="true">{t.yes}</option>
                        <option value="false">{t.no}</option>
                      </select>
                    </label>
                  </div>
                </div>
              )}

              {analysisMode === "compatibility" && (
                <div className="form__row form__row--actions">
                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? t.generating : chart && chartB ? t.generateNew : t.generate}
                  </button>
                </div>
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
                  {t.dstLabel}: {chart.normalized.daylightSaving ? t.yes : t.no}
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
                  <p>{t.dstLabel}: {chart.normalized.daylightSaving ? t.yes : t.no}</p>
                </div>
                <div className="normalized__card">
                  <h3 className="normalized__title">{t.personB}</h3>
                  <p>{chartMetaB?.location}</p>
                  <p>{chartMetaB?.datetime}</p>
                  <p>Timezone: {chartB.normalized.timezone}</p>
                  <p>UTC: {chartB.normalized.utcDateTime}</p>
                  <p>{t.dstLabel}: {chartB.normalized.daylightSaving ? t.yes : t.no}</p>
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
                    key={card.key}
                    title={card.title}
                    subtitle={card.subtitle}
                    text={card.text}
                    tags={card.tags}
                    element={card.element}
                    variant="hero"
                    degree={card.degree}
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
                    key={card.key}
                    title={card.title}
                    subtitle={card.subtitle}
                    text={card.text}
                    tags={card.tags}
                    element={card.element}
                    variant="planet"
                    degree={card.degree}
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
                    key={card.key}
                    title={card.title}
                    subtitle={card.subtitle}
                    text={card.text}
                    tags={card.tags}
                    variant="aspect"
                    orb={card.orb}
                  />
                ))}
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
              <div className="cards-grid--aspects">
                {comparisonCards.map((card) => (
                  <Card
                    key={card.key}
                    title={card.title}
                    subtitle={card.subtitle}
                    text={card.text}
                    tags={card.tags}
                    variant="aspect"
                    orb={card.orb}
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
