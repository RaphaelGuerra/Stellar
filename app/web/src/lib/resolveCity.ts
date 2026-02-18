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
  [mapKey("los angeles", "us")]: {
    lat: 34.0522,
    lon: -118.2437,
    timezone: "America/Los_Angeles",
  },
  [mapKey("chicago", "us")]: {
    lat: 41.8781,
    lon: -87.6298,
    timezone: "America/Chicago",
  },
  [mapKey("miami", "us")]: {
    lat: 25.7617,
    lon: -80.1918,
    timezone: "America/New_York",
  },
  [mapKey("london", "gb")]: {
    lat: 51.5072,
    lon: -0.1276,
    timezone: "Europe/London",
  },
  [mapKey("madrid", "es")]: {
    lat: 40.4168,
    lon: -3.7038,
    timezone: "Europe/Madrid",
  },
  [mapKey("paris", "fr")]: {
    lat: 48.8566,
    lon: 2.3522,
    timezone: "Europe/Paris",
  },
  [mapKey("berlin", "de")]: {
    lat: 52.52,
    lon: 13.405,
    timezone: "Europe/Berlin",
  },
  [mapKey("rome", "it")]: {
    lat: 41.9028,
    lon: 12.4964,
    timezone: "Europe/Rome",
  },
  [mapKey("athens", "gr")]: {
    lat: 37.9838,
    lon: 23.7275,
    timezone: "Europe/Athens",
  },
  [mapKey("istanbul", "tr")]: {
    lat: 41.0082,
    lon: 28.9784,
    timezone: "Europe/Istanbul",
  },
  [mapKey("dubai", "ae")]: {
    lat: 25.2048,
    lon: 55.2708,
    timezone: "Asia/Dubai",
  },
  [mapKey("mumbai", "in")]: {
    lat: 19.076,
    lon: 72.8777,
    timezone: "Asia/Kolkata",
  },
  [mapKey("delhi", "in")]: {
    lat: 28.6139,
    lon: 77.209,
    timezone: "Asia/Kolkata",
  },
  [mapKey("bangkok", "th")]: {
    lat: 13.7563,
    lon: 100.5018,
    timezone: "Asia/Bangkok",
  },
  [mapKey("singapore", "sg")]: {
    lat: 1.3521,
    lon: 103.8198,
    timezone: "Asia/Singapore",
  },
  [mapKey("tokyo", "jp")]: {
    lat: 35.6762,
    lon: 139.6503,
    timezone: "Asia/Tokyo",
  },
  [mapKey("seoul", "kr")]: {
    lat: 37.5665,
    lon: 126.978,
    timezone: "Asia/Seoul",
  },
  [mapKey("sydney", "au")]: {
    lat: -33.8688,
    lon: 151.2093,
    timezone: "Australia/Sydney",
  },
  [mapKey("melbourne", "au")]: {
    lat: -37.8136,
    lon: 144.9631,
    timezone: "Australia/Melbourne",
  },
  [mapKey("auckland", "nz")]: {
    lat: -36.8509,
    lon: 174.7645,
    timezone: "Pacific/Auckland",
  },
  [mapKey("cape town", "za")]: {
    lat: -33.9249,
    lon: 18.4241,
    timezone: "Africa/Johannesburg",
  },
  [mapKey("lagos", "ng")]: {
    lat: 6.5244,
    lon: 3.3792,
    timezone: "Africa/Lagos",
  },
  [mapKey("nairobi", "ke")]: {
    lat: -1.2921,
    lon: 36.8219,
    timezone: "Africa/Nairobi",
  },
  [mapKey("mexico city", "mx")]: {
    lat: 19.4326,
    lon: -99.1332,
    timezone: "America/Mexico_City",
  },
  [mapKey("buenos aires", "ar")]: {
    lat: -34.6037,
    lon: -58.3816,
    timezone: "America/Argentina/Buenos_Aires",
  },
  [mapKey("santiago", "cl")]: {
    lat: -33.4489,
    lon: -70.6693,
    timezone: "America/Santiago",
  },
  [mapKey("bogota", "co")]: {
    lat: 4.711,
    lon: -74.0721,
    timezone: "America/Bogota",
  },
  [mapKey("lima", "pe")]: {
    lat: -12.0464,
    lon: -77.0428,
    timezone: "America/Lima",
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
  "Los Angeles, US",
  "Chicago, US",
  "Miami, US",
  "London, GB",
  "Madrid, ES",
  "Paris, FR",
  "Berlin, DE",
  "Rome, IT",
  "Athens, GR",
  "Istanbul, TR",
  "Dubai, AE",
  "Mumbai, IN",
  "Delhi, IN",
  "Bangkok, TH",
  "Singapore, SG",
  "Tokyo, JP",
  "Seoul, KR",
  "Sydney, AU",
  "Melbourne, AU",
  "Auckland, NZ",
  "Cape Town, ZA",
  "Lagos, NG",
  "Nairobi, KE",
  "Mexico City, MX",
  "Buenos Aires, AR",
  "Santiago, CL",
  "Bogota, CO",
  "Lima, PE",
] as const;

export class CityNotFoundError extends Error {
  constructor(city: string, country: string) {
    super(
      `Cidade não encontrada localmente: ${city}, ${country}. Exemplos: ${SUPPORTED_CITIES.join(", ")}`
    );
    this.name = "CityNotFoundError";
  }
}

export function resolveCity(input: CityQuery): CityResolution {
  const key = mapKey(input.city, input.country);
  const hit = CITY_MAP[key];

  if (hit) return hit;

  throw new CityNotFoundError(input.city, input.country);
}
