import { useEffect, useState } from "react";
import tzLookup from "tz-lookup";
import type { CityResolution } from "./types";

export interface GeoSuggestion {
  id: string;
  label: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  timezone: string;
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

interface CacheEntry {
  ts: number;
  results: GeoSuggestion[];
}

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_EMAIL = import.meta.env.VITE_NOMINATIM_EMAIL;
const SEARCH_MIN_CHARS = 3;
const SEARCH_DEBOUNCE_MS = 450;
const SEARCH_RATE_LIMIT_MS = 1100;
const CACHE_KEY = "stellar-city-cache-v1";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const CACHE_LIMIT = 50;

// Module-level shared state — shared across all hook instances.
let sharedCacheLoaded = false;
const searchCache = new Map<string, CacheEntry>();
const lastRequestAt = { current: 0 };

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildCacheKey(normalizedQuery: string, language: string): string {
  return `${language}|${normalizedQuery}`;
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

function loadCacheFromStorage() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Array<{
      query: string;
      ts: number;
      results: GeoSuggestion[];
    }>;
    const now = Date.now();
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (!entry || typeof entry.query !== "string" || typeof entry.ts !== "number") {
          continue;
        }
        if (!Array.isArray(entry.results)) continue;
        if (now - entry.ts > CACHE_TTL_MS) continue;
        searchCache.set(entry.query, { ts: entry.ts, results: entry.results });
      }
    }
    pruneCache(searchCache);
  } catch {
    // Ignore corrupted storage.
  }
}

function getCachedResults(query: string): GeoSuggestion[] | null {
  const entry = searchCache.get(query);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    searchCache.delete(query);
    persistCache(searchCache);
    return null;
  }
  return entry.results;
}

function setCachedResults(query: string, results: GeoSuggestion[]) {
  searchCache.set(query, { ts: Date.now(), results });
  persistCache(searchCache);
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

async function fetchNominatim(
  query: string,
  limit: number,
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
  });
  if (typeof NOMINATIM_EMAIL === "string" && NOMINATIM_EMAIL.trim().length > 0) {
    params.set("email", NOMINATIM_EMAIL.trim());
  }
  params.set("accept-language", language);

  const response = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, { signal });
  if (!response.ok) {
    throw new Error(`Nominatim error: ${response.status}`);
  }
  return (await response.json()) as NominatimResult[];
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

export function parseLocationInput(value: string): { city: string; country: string } {
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

export async function resolveLocationCandidates(
  query: string,
  isCarioca: boolean,
  limit = 6
): Promise<GeoSuggestion[] | null> {
  const normalized = normalizeQuery(query);
  const language = isCarioca ? "pt-BR" : "en";
  const cacheKey = buildCacheKey(normalized, language);
  const cached = getCachedResults(cacheKey);
  if (cached !== null) {
    return cached.slice(0, limit);
  }

  try {
    const data = await fetchNominatim(query, limit, language);
    const results = toUniqueSuggestions(data);
    setCachedResults(cacheKey, results);
    return results;
  } catch {
    return null;
  }
}

export interface UseGeoSearchReturn {
  locationInput: string;
  setLocationInput: (value: string) => void;
  city: string;
  country: string;
  location: CityResolution | undefined;
  suggestions: GeoSuggestion[];
  setSuggestions: (s: GeoSuggestion[]) => void;
  isSearching: boolean;
  searchError: string | null;
  setSearchError: (e: string | null) => void;
  showSuggestions: boolean;
  showNoResults: boolean;
  selectSuggestion: (s: GeoSuggestion) => void;
  applyResolved: (s: GeoSuggestion) => void;
}

export function useGeoSearch(
  initialLocation: string,
  isCarioca: boolean,
  enabled = true
): UseGeoSearchReturn {
  const [locationInput, setLocationInput] = useState(initialLocation);
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(initialLocation || null);
  const [resolvedLocation, setResolvedLocation] = useState<CityResolution | undefined>(undefined);
  const [resolvedCity, setResolvedCity] = useState<string | undefined>(undefined);
  const [resolvedCountry, setResolvedCountry] = useState<string | undefined>(undefined);

  const parsed = parseLocationInput(locationInput);
  const isSelectedLabel = selectedLabel === locationInput;
  const city = isSelectedLabel ? (resolvedCity ?? parsed.city) : parsed.city;
  const country = isSelectedLabel ? (resolvedCountry ?? parsed.country) : parsed.country;
  const location = selectedLabel === locationInput ? resolvedLocation : undefined;

  // Load shared cache lazily after mount to keep render side-effect free.
  useEffect(() => {
    if (sharedCacheLoaded) return;
    loadCacheFromStorage();
    sharedCacheLoaded = true;
  }, []);

  function selectSuggestion(s: GeoSuggestion) {
    setSelectedLabel(s.label);
    setLocationInput(s.label);
    setSuggestions([]);
    setSearchError(null);
    setResolvedCity(s.city);
    setResolvedCountry(s.country);
    setResolvedLocation({ lat: s.lat, lon: s.lon, timezone: s.timezone });
  }

  function applyResolved(s: GeoSuggestion) {
    selectSuggestion(s);
  }

  // Debounced search effect.
  useEffect(() => {
    if (!enabled) {
      setSuggestions([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    const query = locationInput.trim();
    const normalized = normalizeQuery(query);
    const language = isCarioca ? "pt-BR" : "en";
    const cacheKeyStr = buildCacheKey(normalized, language);

    if (selectedLabel && locationInput === selectedLabel) {
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

    const cached = getCachedResults(cacheKeyStr);
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
        const data = await fetchNominatim(query, 6, language, controller.signal);
        const results = toUniqueSuggestions(data);
        setCachedResults(cacheKeyStr, results);
        setSuggestions(results);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setSuggestions([]);
        setSearchError(
          isCarioca
            ? "Nao deu pra buscar cidade agora, mermão. Tenta de novo ja ja."
            : "Could not search cities right now."
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
  }, [enabled, isCarioca, locationInput, selectedLabel]);

  const showSuggestions = suggestions.length > 0;
  const showNoResults =
    !isSearching &&
    !searchError &&
    suggestions.length === 0 &&
    normalizeQuery(locationInput).length >= SEARCH_MIN_CHARS &&
    locationInput !== selectedLabel;

  return {
    locationInput,
    setLocationInput,
    city,
    country,
    location,
    suggestions,
    setSuggestions,
    isSearching,
    searchError,
    setSearchError,
    showSuggestions,
    showNoResults,
    selectSuggestion,
    applyResolved,
  };
}
