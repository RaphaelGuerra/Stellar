import { describe, expect, it } from "vitest";
import { AmbiguousLocalTimeError, NonexistentLocalTimeError, generateChart } from "../src/lib/engine";
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

  it("keeps manual no-DST aligned with local-time candidates after political offset changes", async () => {
    const input: ChartInput = {
      ...baseInput,
      city: "Volgograd",
      country: "RU",
      date: "2020-12-30",
      time: "12:00",
      location: {
        lat: 48.708,
        lon: 44.513,
        timezone: "Europe/Volgograd",
      },
    };

    const autoChart = await generateChart({ ...input, daylight_saving: "auto" });
    const manualNoDstChart = await generateChart({ ...input, daylight_saving: false });

    expect(autoChart.normalized.utcDateTime).toBe("2020-12-30T09:00:00Z");
    expect(manualNoDstChart.normalized.utcDateTime).toBe("2020-12-30T09:00:00Z");
    expect(manualNoDstChart.normalized.offsetMinutes).toBe(-180);
    expect(manualNoDstChart.normalized.daylightSaving).toBe(false);
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

  it("rejects nonexistent local time during DST spring-forward in New York when auto", async () => {
    await expect(
      generateChart({
        ...baseInput,
        date: "2024-03-10",
        time: "02:30",
        daylight_saving: "auto",
      })
    ).rejects.toBeInstanceOf(NonexistentLocalTimeError);
  });

  it("rejects ambiguous local time during DST fallback in New York when auto", async () => {
    await expect(
      generateChart({
        ...baseInput,
        date: "2024-11-03",
        time: "01:30",
        daylight_saving: "auto",
      })
    ).rejects.toBeInstanceOf(AmbiguousLocalTimeError);
  });

  it("uses DST occurrence for ambiguous fallback time when manually set to daylight saving", async () => {
    const chart = await generateChart({
      ...baseInput,
      date: "2024-11-03",
      time: "01:30",
      daylight_saving: true,
    });
    expect(chart.normalized.offsetMinutes).toBe(240);
    expect(chart.normalized.daylightSaving).toBe(true);
    expect(chart.normalized.utcDateTime).toBe("2024-11-03T05:30:00Z");
  });

  it("uses standard-time occurrence for ambiguous fallback time when manually set to no daylight saving", async () => {
    const chart = await generateChart({
      ...baseInput,
      date: "2024-11-03",
      time: "01:30",
      daylight_saving: false,
    });
    expect(chart.normalized.offsetMinutes).toBe(300);
    expect(chart.normalized.daylightSaving).toBe(false);
    expect(chart.normalized.utcDateTime).toBe("2024-11-03T06:30:00Z");
  });
});
