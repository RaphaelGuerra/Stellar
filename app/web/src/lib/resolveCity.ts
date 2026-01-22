import type { CityQuery, CityResolution } from "./types";

/**
 * Pure resolver: same input -> same output, no side effects.
 * Strategy ideas (choose one later):
 * - In-memory lookup table bundled with the app (JSON/CSV).
 * - Build-time generated index from a curated city database.
 * - Server-side adapter with caching; keep this function a pure wrapper.
 */
export function resolveCity(input: CityQuery): CityResolution {
  const norm = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const mapKey = (city: string, country: string) => `${norm(city)}|${norm(country)}`;

  const cityMap: Record<string, CityResolution> = {
    [mapKey("rio de janeiro", "br")]: {
      lat: -22.9068,
      lon: -43.1729,
      timezone: "America/Sao_Paulo",
    },
    [mapKey("sao paulo", "br")]: {
      lat: -23.5505,
      lon: -46.6333,
      timezone: "America/Sao_Paulo",
    },
    [mapKey("nova iguacu", "br")]: {
      lat: -22.7592,
      lon: -43.4513,
      timezone: "America/Sao_Paulo",
    },
    [mapKey("lisbon", "pt")]: {
      lat: 38.7223,
      lon: -9.1393,
      timezone: "Europe/Lisbon",
    },
    [mapKey("new york", "us")]: {
      lat: 40.7128,
      lon: -74.006,
      timezone: "America/New_York",
    },
    [mapKey("montreal", "ca")]: {
      lat: 45.5017,
      lon: -73.5673,
      timezone: "America/Toronto",
    },
    [mapKey("ottawa", "ca")]: {
      lat: 45.4215,
      lon: -75.6972,
      timezone: "America/Toronto",
    },
  };

  const key = mapKey(input.city, input.country);
  const hit = cityMap[key];

  if (hit) return hit;

  return {
    lat: 0,
    lon: 0,
    timezone: "UTC",
  };
}
