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
  if (!input.city || input.city.trim().length === 0) {
    errors.push("Cidade é obrigatória");
  } else if (input.city.trim().length < 2) {
    errors.push("Nome da cidade deve ter pelo menos 2 caracteres");
  }

  // Validate country
  if (!input.country || input.country.trim().length === 0) {
    errors.push("País é obrigatório");
  } else if (input.country.trim().length < 2) {
    errors.push("Código do país deve ter pelo menos 2 caracteres");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
