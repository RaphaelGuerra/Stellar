import type { ChartInput } from "./types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateChartInput(input: ChartInput): ValidationResult {
  const errors: string[] = [];

  // Validate date
  if (!input.date) {
    errors.push("Data é obrigatória");
  } else {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(input.date)) {
      errors.push("Formato de data inválido (esperado: YYYY-MM-DD)");
    } else {
      const date = new Date(input.date);
      if (isNaN(date.getTime())) {
        errors.push("Data inválida");
      } else if (date > new Date()) {
        errors.push("Data não pode ser no futuro");
      } else if (date.getFullYear() < 1900) {
        errors.push("Data deve ser posterior a 1900");
      }
    }
  }

  // Validate time
  if (!input.time) {
    errors.push("Hora é obrigatória");
  } else {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(input.time)) {
      errors.push("Formato de hora inválido (esperado: HH:mm)");
    }
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

  return {
    valid: errors.length === 0,
    errors,
  };
}
