import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateChartInput } from "../src/lib/validation";
import type { ChartInput } from "../src/lib/types";

const baseInput: ChartInput = {
  date: "2024-01-15",
  time: "12:00",
  city: "New York",
  country: "US",
  daylight_saving: "auto",
  location: {
    lat: 40.7128,
    lon: -74.006,
    timezone: "America/New_York",
  },
};

describe("validateChartInput", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects impossible calendar dates", () => {
    vi.setSystemTime(new Date("2026-02-06T12:00:00Z"));
    const result = validateChartInput({
      ...baseInput,
      date: "2024-02-31",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("DATE_INVALID");
  });

  it("accepts a local datetime that is not in the future in chart timezone", () => {
    vi.setSystemTime(new Date("2026-02-05T10:30:00Z"));
    const result = validateChartInput({
      ...baseInput,
      date: "2026-02-06",
      time: "00:00",
      city: "Kiritimati",
      country: "KI",
      location: {
        lat: 1.87,
        lon: -157.36,
        timezone: "Pacific/Kiritimati",
      },
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a local datetime that is in the future in chart timezone", () => {
    vi.setSystemTime(new Date("2026-02-05T10:30:00Z"));
    const result = validateChartInput({
      ...baseInput,
      date: "2026-02-06",
      time: "00:45",
      city: "Kiritimati",
      country: "KI",
      location: {
        lat: 1.87,
        lon: -157.36,
        timezone: "Pacific/Kiritimati",
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("DATE_IN_FUTURE");
  });
});
