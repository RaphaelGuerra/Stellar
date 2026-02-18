export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseIsoDate(value: string): Date {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return new Date();
  return new Date(parsed);
}

export function shiftIsoDate(value: string, days: number): string {
  const next = parseIsoDate(value);
  next.setUTCDate(next.getUTCDate() + days);
  return formatIsoDate(next);
}

export function dayDistanceFrom(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return Number.NaN;
  return Math.round((end - start) / 86400000);
}

export function toLocationLabel(city: string, country: string): string {
  const trimmedCity = city.trim();
  const trimmedCountry = country.trim();
  if (!trimmedCity) return trimmedCountry;
  if (!trimmedCountry) return trimmedCity;
  return `${trimmedCity}, ${trimmedCountry}`;
}
