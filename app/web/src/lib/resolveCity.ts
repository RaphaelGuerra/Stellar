import type { CityQuery, CityResolution } from "./types";

/**
 * Pure resolver: same input -> same output, no side effects.
 * Strategy ideas (choose one later):
 * - In-memory lookup table bundled with the app (JSON/CSV).
 * - Build-time generated index from a curated city database.
 * - Server-side adapter with caching; keep this function a pure wrapper.
 */
export function resolveCity(input: CityQuery): CityResolution {
  const key = `${input.city}`.trim().toLowerCase();
  const country = `${input.country}`.trim().toLowerCase();
  const mapKey = `${key}|${country}`;

  const cityMap: Record<string, CityResolution> = {
    "rio de janeiro|br": {
      lat: -22.9068,
      lon: -43.1729,
      timezone: "America/Sao_Paulo",
    },
    "sao paulo|br": {
      lat: -23.5505,
      lon: -46.6333,
      timezone: "America/Sao_Paulo",
    },
    "lisbon|pt": {
      lat: 38.7223,
      lon: -9.1393,
      timezone: "Europe/Lisbon",
    },
    "new york|us": {
      lat: 40.7128,
      lon: -74.006,
      timezone: "America/New_York",
    },
  };

  return (
    cityMap[mapKey] ?? {
      lat: 0,
      lon: 0,
      timezone: "UTC",
    }
  );
}
