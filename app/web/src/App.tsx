import { useState, useEffect, useMemo, useRef, type FormEvent } from "react";
import tzLookup from "tz-lookup";
import { useContentMode } from "./content/useContentMode";
import { ModeToggle } from "./components/ModeToggle";
import { buildCards, type CardModel } from "./lib/cards";
import { generateChart } from "./lib/engine";
import { validateChartInput } from "./lib/validation";
import { SUPPORTED_CITIES } from "./lib/resolveCity";
import type { ChartInput, ChartResult } from "./lib/types";

interface CardProps {
  title: string;
  subtitle?: string;
  text: string;
  tags: readonly string[];
}

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

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
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
  } catch (err) {
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
  } catch (err) {
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
  params.set("accept-language", "pt-BR");

  const response = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, { signal });
  if (!response.ok) {
    throw new Error(`Nominatim error: ${response.status}`);
  }
  return (await response.json()) as NominatimResult[];
}

function Card({ title, subtitle, text, tags }: CardProps) {
  return (
    <article className="card">
      <h3 className="card__title">{title}</h3>
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

function LoadingState() {
  return (
    <div className="loading-state" role="status" aria-live="polite" aria-busy="true">
      <div className="spinner" aria-hidden="true" />
      <p className="loading-text">Calculando posições planetárias</p>
    </div>
  );
}

function App() {
  const { mode, setMode, content } = useContentMode();
  const [input, setInput] = useState<ChartInput>({
    date: "1990-01-01",
    time: "12:00",
    city: "Rio de Janeiro",
    country: "BR",
    daylight_saving: "auto",
  });
  const [locationInput, setLocationInput] = useState(
    `${input.city}, ${input.country}`
  );
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedLocationLabel, setSelectedLocationLabel] = useState<string | null>(null);
  const searchCache = useRef<Map<string, CacheEntry>>(loadCacheFromStorage());
  const lastRequestAt = useRef(0);
  const [chart, setChart] = useState<ChartResult | null>(null);
  const [cards, setCards] = useState<CardModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recalculate cards when mode changes (if chart exists)
  useEffect(() => {
    if (chart) {
      setCards(buildCards(content, chart, mode));
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
    const query = locationInput.trim();
    const normalized = normalizeQuery(query);

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

    const cached = getCachedResults(normalized, searchCache.current);
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
        const data = await fetchNominatim(query, 6, lastRequestAt, controller.signal);
        const unique = new Map<string, GeoSuggestion>();
        for (const item of data) {
          const suggestion = buildSuggestion(item);
          if (!suggestion) continue;
          const key = `${suggestion.label}|${suggestion.lat}|${suggestion.lon}`;
          if (!unique.has(key)) {
            unique.set(key, suggestion);
          }
        }
        const results = Array.from(unique.values());
        setCachedResults(normalized, results, searchCache.current);
        setSuggestions(results);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setSuggestions([]);
        setSearchError("Não foi possível buscar cidades agora.");
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
  }, [locationInput, selectedLocationLabel]);

  // Separate cards into sections using category field
  const { big3Cards, aspectCards } = useMemo(() => {
    const BIG3_PLANETS = new Set(["Sun", "Moon"]);
    const big3: CardModel[] = [];
    const aspects: CardModel[] = [];

    for (const card of cards) {
      if (card.category === "aspect") {
        aspects.push(card);
      } else if (card.planet && BIG3_PLANETS.has(card.planet)) {
        big3.push(card);
      }
    }

    return { big3Cards: big3, aspectCards: aspects };
  }, [cards]);

  // Format chart meta info
  const chartMeta = useMemo(() => {
    if (!chart?.input) return null;
    const { city, date, time } = chart.input;
    const formattedDate = new Date(`${date}T${time}`).toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return { location: city, datetime: `${formattedDate}, ${time}` };
  }, [chart]);

  const daylightSavingValue =
    input.daylight_saving === "auto"
      ? "auto"
      : input.daylight_saving
      ? "true"
      : "false";

  const showSuggestions = suggestions.length > 0;
  const showNoResults =
    !isSearching &&
    !searchError &&
    suggestions.length === 0 &&
    normalizeQuery(locationInput).length >= SEARCH_MIN_CHARS &&
    locationInput !== selectedLocationLabel;

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

  async function resolveLocationFromQuery(query: string): Promise<GeoSuggestion | null> {
    const normalized = normalizeQuery(query);
    const cached = getCachedResults(normalized, searchCache.current);
    if (cached && cached.length > 0) return cached[0];

    try {
      const data = await fetchNominatim(query, 1, lastRequestAt);
      const suggestion = data.map(buildSuggestion).find(Boolean) as GeoSuggestion | undefined;
      if (suggestion) {
        setCachedResults(normalized, [suggestion], searchCache.current);
        return suggestion;
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  async function handleGenerateChart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validation = validateChartInput(input);
    if (!validation.valid) {
      setError(validation.errors.join(". "));
      return;
    }

    setLoading(true);
    try {
      let nextInput = input;
      if (!input.location) {
        const fallback = await resolveLocationFromQuery(locationInput);
        if (!fallback) {
          setError("Selecione uma cidade sugerida para continuar.");
          return;
        }
        nextInput = {
          ...input,
          city: fallback.city,
          country: fallback.country,
          location: {
            lat: fallback.lat,
            lon: fallback.lon,
            timezone: fallback.timezone,
          },
        };
        setSelectedLocationLabel(fallback.label);
        setLocationInput(fallback.label);
        setInput(nextInput);
      }
      const newChart = await generateChart(nextInput);
      setChart(newChart);
      setCards(buildCards(content, newChart, mode));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const modeLabel = mode === "carioca" ? "Carioca" : "Normal";

  return (
    <div className="app">
      <div className="container">
        <header className="header" role="banner">
          <div className="header__brand">
            <h1 className="header__title">stellar</h1>
            <div className="header__meta" aria-label="Informações do mapa atual">
              <span>Modo {modeLabel}</span>
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

        <main role="main" aria-label="Gerador de mapa astral">
          <section className={`action-section ${cards.length > 0 ? "action-section--compact" : ""}`}>
            <form className="form" onSubmit={handleGenerateChart} aria-label="Formulário de dados de nascimento">
              <div className="form__row">
                <label className="form__label">
                  Data
                  <input
                    type="date"
                    value={input.date}
                    onChange={(event) =>
                      setInput((prev) => ({ ...prev, date: event.target.value }))
                    }
                    required
                  />
                </label>
                <label className="form__label">
                  Hora
                  <input
                    type="time"
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
                  Cidade e país
                  <div className="city-search">
                    <input
                      type="text"
                      value={locationInput}
                      onChange={(event) => setLocationInput(event.target.value)}
                      required
                      aria-describedby="city-hint"
                      aria-expanded={showSuggestions}
                      placeholder="Ex: Rio de Janeiro, BR"
                    />
                    {isSearching && (
                      <span className="city-search__status">Buscando cidades...</span>
                    )}
                    {searchError && (
                      <span className="city-search__status city-search__status--error">
                        {searchError}
                      </span>
                    )}
                    {showNoResults && (
                      <span className="city-search__status">Nenhuma cidade encontrada.</span>
                    )}
                    {showSuggestions && (
                      <ul className="city-search__list" role="listbox">
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
              <p id="city-hint" className="form__hint">
                Digite para buscar cidades do mundo inteiro ou escolha um exemplo:{" "}
                {SUPPORTED_CITIES.join(", ")}
              </p>
              <div className="form__row">
                <label className="form__label">
                  Horário de verão
                  <select
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
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                  </select>
                </label>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? "Gerando..." : chart ? "Gerar novo mapa" : "Gerar mapa"}
                </button>
              </div>
              {error && (
                <p className="form__error" role="alert">
                  Erro ao gerar mapa: {error}
                </p>
              )}
            </form>
          </section>

          {!loading && chart && (
            <Section icon="🧭" title="Dados normalizados">
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
                  Horário de verão: {chart.normalized.daylightSaving ? "Sim" : "Não"}
                </p>
              </div>
            </Section>
          )}

          {loading && <LoadingState />}

          {!loading && cards.length === 0 && (
            <p className="empty-state">
              Clique em "Gerar mapa" para ver os cards do mapa astral.
            </p>
          )}

          {!loading && big3Cards.length > 0 && (
            <Section icon="☀️" title="Big 3" badge={`${big3Cards.length} cards`}>
              <div className="cards-grid">
                {big3Cards.map((card) => (
                  <Card
                    key={card.key}
                    title={card.title}
                    subtitle={card.subtitle}
                    text={card.text}
                    tags={card.tags}
                  />
                ))}
              </div>
            </Section>
          )}

          {!loading && aspectCards.length > 0 && (
            <Section
              icon="🔗"
              title="Aspectos"
              badge={`${aspectCards.length} conexoes`}
              badgeAccent
            >
              <div className="cards-grid">
                {aspectCards.map((card) => (
                  <Card
                    key={card.key}
                    title={card.title}
                    subtitle={card.subtitle}
                    text={card.text}
                    tags={card.tags}
                  />
                ))}
              </div>
            </Section>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
