import { resolveCity } from "./resolveCity";
import type { ChartInput } from "./types";

interface DateParts {
  year: number;
  month: number;
  day: number;
}

interface TimeParts {
  hour: number;
  minute: number;
}

interface LocalDateTimeParts extends DateParts, TimeParts {
  second: number;
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string) {
  const cached = FORMATTER_CACHE.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  FORMATTER_CACHE.set(timeZone, formatter);
  return formatter;
}

function parseDateParts(value: string): DateParts | null {
  if (!DATE_REGEX.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  return { year, month, day };
}

function parseTimeParts(value: string): TimeParts | null {
  if (!TIME_REGEX.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null;
  }
  return { hour, minute };
}

function isValidCalendarDate(parts: DateParts): boolean {
  const utcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return (
    utcDate.getUTCFullYear() === parts.year &&
    utcDate.getUTCMonth() === parts.month - 1 &&
    utcDate.getUTCDate() === parts.day
  );
}

function resolveInputTimeZone(input: ChartInput): string | null {
  const locationTz = input.location?.timezone?.trim();
  if (locationTz) return locationTz;
  const city = input.city?.trim();
  const country = input.country?.trim();
  if (!city || !country) return null;
  try {
    return resolveCity({ city, country }).timezone;
  } catch {
    return null;
  }
}

function getNowInTimeZone(timeZone: string): LocalDateTimeParts {
  const formatted = getFormatter(timeZone).formatToParts(new Date());
  const map: Partial<LocalDateTimeParts> = {};
  for (const part of formatted) {
    if (part.type === "year") map.year = Number(part.value);
    if (part.type === "month") map.month = Number(part.value);
    if (part.type === "day") map.day = Number(part.value);
    if (part.type === "hour") map.hour = Number(part.value);
    if (part.type === "minute") map.minute = Number(part.value);
    if (part.type === "second") map.second = Number(part.value);
  }
  return {
    year: map.year ?? 0,
    month: map.month ?? 0,
    day: map.day ?? 0,
    hour: map.hour ?? 0,
    minute: map.minute ?? 0,
    second: map.second ?? 0,
  };
}

function compareLocalDateTime(left: LocalDateTimeParts, right: LocalDateTimeParts): number {
  if (left.year !== right.year) return left.year - right.year;
  if (left.month !== right.month) return left.month - right.month;
  if (left.day !== right.day) return left.day - right.day;
  if (left.hour !== right.hour) return left.hour - right.hour;
  if (left.minute !== right.minute) return left.minute - right.minute;
  return left.second - right.second;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateChartInput(input: ChartInput): ValidationResult {
  const errors: string[] = [];
  const dateParts = parseDateParts(input.date);
  const timeParts = parseTimeParts(input.time);
  const hasValidCalendarDate = !!dateParts && isValidCalendarDate(dateParts);

  // Validate date
  if (!input.date) {
    errors.push("Data é obrigatória");
  } else {
    if (!dateParts) {
      errors.push("Formato de data inválido (esperado: YYYY-MM-DD)");
    } else if (!hasValidCalendarDate) {
      errors.push("Data inválida");
    } else if (dateParts.year < 1900) {
      errors.push("Data deve ser posterior a 1900");
    }
  }

  // Validate time
  if (!input.time) {
    errors.push("Hora é obrigatória");
  } else if (!timeParts) {
    errors.push("Formato de hora inválido (esperado: HH:mm)");
  }

  // Validate city
  const city = input.city?.trim() ?? "";
  const country = input.country?.trim() ?? "";
  const hasLocation =
    !!input.location &&
    Number.isFinite(input.location.lat) &&
    Number.isFinite(input.location.lon) &&
    input.location.timezone.trim().length > 0;

  if (!city || !country) {
    if (!hasLocation) {
      errors.push("Cidade e país são obrigatórios (ex: Rio de Janeiro, BR)");
    }
  }
  if (city && city.length < 2) {
    errors.push("Nome da cidade deve ter pelo menos 2 caracteres");
  }
  if (country && country.length < 2) {
    errors.push("Código do país deve ter pelo menos 2 caracteres");
  }

  if (hasValidCalendarDate && timeParts) {
    const timezone = resolveInputTimeZone(input);
    if (timezone) {
      try {
        const now = getNowInTimeZone(timezone);
        const inputDateTime: LocalDateTimeParts = {
          ...dateParts,
          ...timeParts,
          second: 0,
        };
        if (compareLocalDateTime(inputDateTime, now) > 0) {
          errors.push("Data não pode ser no futuro");
        }
      } catch {
        errors.push("Timezone inválido para a localização informada");
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
