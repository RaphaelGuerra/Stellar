import type { CityQuery, CityResolution } from "./types";

const norm = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const mapKey = (city: string, country: string) => `${norm(city)}|${norm(country)}`;

const CITY_MAP: Record<string, CityResolution> = {
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

export const SUPPORTED_CITIES = [
  "Rio de Janeiro, BR",
  "São Paulo, BR",
  "Nova Iguaçu, BR",
  "Lisbon, PT",
  "New York, US",
  "Montreal, CA",
  "Ottawa, CA",
] as const;

export class CityNotFoundError extends Error {
  constructor(city: string, country: string) {
    super(`Cidade não encontrada: ${city}, ${country}. Cidades suportadas: ${SUPPORTED_CITIES.join(", ")}`);
    this.name = "CityNotFoundError";
  }
}

export function resolveCity(input: CityQuery): CityResolution {
  const key = mapKey(input.city, input.country);
  const hit = CITY_MAP[key];

  if (hit) return hit;

  throw new CityNotFoundError(input.city, input.country);
}
