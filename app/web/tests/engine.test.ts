import { describe, expect, it } from "vitest";
import { generateChart } from "../src/lib/engine";
import type { ChartInput } from "../src/lib/types";

const baseInput: ChartInput = {
  date: "2024-01-15",
  time: "12:00",
  city: "New York",
  country: "US",
  daylight_saving: "auto",
};

describe("generateChart normalization", () => {
  it("computes standard offset and UTC for winter in New York", async () => {
    const chart = await generateChart({ ...baseInput, date: "2024-01-15", time: "12:00" });
    expect(chart.normalized.offsetMinutes).toBe(300);
    expect(chart.normalized.daylightSaving).toBe(false);
    expect(chart.normalized.utcDateTime).toBe("2024-01-15T17:00:00Z");
  });

  it("computes DST offset and UTC for summer in New York", async () => {
    const chart = await generateChart({ ...baseInput, date: "2024-07-01", time: "12:00" });
    expect(chart.normalized.offsetMinutes).toBe(240);
    expect(chart.normalized.daylightSaving).toBe(true);
    expect(chart.normalized.utcDateTime).toBe("2024-07-01T16:00:00Z");
  });

  it("respects manual daylight saving override", async () => {
    const chart = await generateChart({
      ...baseInput,
      date: "2024-01-15",
      time: "12:00",
      daylight_saving: true,
    });
    expect(chart.normalized.offsetMinutes).toBe(240);
    expect(chart.normalized.daylightSaving).toBe(true);
    expect(chart.normalized.utcDateTime).toBe("2024-01-15T16:00:00Z");
  });

  it("reports no DST for Sao Paulo in 2024", async () => {
    const chart = await generateChart({
      ...baseInput,
      city: "Rio de Janeiro",
      country: "BR",
      date: "2024-02-10",
      time: "12:00",
    });
    expect(chart.normalized.offsetMinutes).toBe(180);
    expect(chart.normalized.daylightSaving).toBe(false);
    expect(chart.normalized.utcDateTime).toBe("2024-02-10T15:00:00Z");
  });

  it("assigns Sagittarius to the Sun on 1990-12-16 in Rio", async () => {
    const chart = await generateChart({
      ...baseInput,
      city: "Rio de Janeiro",
      country: "BR",
      date: "1990-12-16",
      time: "12:00",
    });
    expect(chart.planets.Sun.sign).toBe("Sagittarius");
  });
});
