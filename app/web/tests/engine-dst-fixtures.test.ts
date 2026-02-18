import { describe, expect, it } from "vitest";
import { AmbiguousLocalTimeError, NonexistentLocalTimeError, generateChartWithAdapter } from "../src/lib/engine";
import type { ChartInput } from "../src/lib/types";

function buildInput(input: {
  date: string;
  time: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  timezone: string;
  daylightSaving: boolean | "auto";
}): ChartInput {
  return {
    date: input.date,
    time: input.time,
    city: input.city,
    country: input.country,
    daylight_saving: input.daylightSaving,
    location: {
      lat: input.lat,
      lon: input.lon,
      timezone: input.timezone,
    },
  };
}

describe("DST fixture coverage", () => {
  it("rejects nonexistent spring-forward time in London when set to auto", async () => {
    const input = buildInput({
      date: "2024-03-31",
      time: "01:30",
      city: "London",
      country: "GB",
      lat: 51.5074,
      lon: -0.1278,
      timezone: "Europe/London",
      daylightSaving: "auto",
    });
    await expect(generateChartWithAdapter(input, "AstronomyEngineAdapter")).rejects.toBeInstanceOf(
      NonexistentLocalTimeError
    );
  });

  it("rejects ambiguous fallback time in London when set to auto", async () => {
    const input = buildInput({
      date: "2024-10-27",
      time: "01:30",
      city: "London",
      country: "GB",
      lat: 51.5074,
      lon: -0.1278,
      timezone: "Europe/London",
      daylightSaving: "auto",
    });
    await expect(generateChartWithAdapter(input, "AstronomyEngineAdapter")).rejects.toBeInstanceOf(
      AmbiguousLocalTimeError
    );
  });

  it("resolves London fallback ambiguity using manual DST yes/no", async () => {
    const yesInput = buildInput({
      date: "2024-10-27",
      time: "01:30",
      city: "London",
      country: "GB",
      lat: 51.5074,
      lon: -0.1278,
      timezone: "Europe/London",
      daylightSaving: true,
    });
    const noInput = buildInput({
      date: "2024-10-27",
      time: "01:30",
      city: "London",
      country: "GB",
      lat: 51.5074,
      lon: -0.1278,
      timezone: "Europe/London",
      daylightSaving: false,
    });

    const yesChart = await generateChartWithAdapter(yesInput, "AstronomyEngineAdapter");
    const noChart = await generateChartWithAdapter(noInput, "AstronomyEngineAdapter");

    expect(yesChart.normalized.offsetMinutes).toBe(-60);
    expect(yesChart.normalized.daylightSaving).toBe(true);
    expect(yesChart.normalized.utcDateTime).toBe("2024-10-27T00:30:00Z");

    expect(noChart.normalized.offsetMinutes).toBe(0);
    expect(noChart.normalized.daylightSaving).toBe(false);
    expect(noChart.normalized.utcDateTime).toBe("2024-10-27T01:30:00Z");
  });

  it("rejects nonexistent spring-forward time in Sydney when set to auto", async () => {
    const input = buildInput({
      date: "2024-10-06",
      time: "02:30",
      city: "Sydney",
      country: "AU",
      lat: -33.8688,
      lon: 151.2093,
      timezone: "Australia/Sydney",
      daylightSaving: "auto",
    });
    await expect(generateChartWithAdapter(input, "AstronomyEngineAdapter")).rejects.toBeInstanceOf(
      NonexistentLocalTimeError
    );
  });

  it("rejects ambiguous fallback time in Sydney when set to auto", async () => {
    const input = buildInput({
      date: "2024-04-07",
      time: "02:30",
      city: "Sydney",
      country: "AU",
      lat: -33.8688,
      lon: 151.2093,
      timezone: "Australia/Sydney",
      daylightSaving: "auto",
    });
    await expect(generateChartWithAdapter(input, "AstronomyEngineAdapter")).rejects.toBeInstanceOf(
      AmbiguousLocalTimeError
    );
  });

  it("resolves Sydney fallback ambiguity using manual DST yes/no", async () => {
    const yesInput = buildInput({
      date: "2024-04-07",
      time: "02:30",
      city: "Sydney",
      country: "AU",
      lat: -33.8688,
      lon: 151.2093,
      timezone: "Australia/Sydney",
      daylightSaving: true,
    });
    const noInput = buildInput({
      date: "2024-04-07",
      time: "02:30",
      city: "Sydney",
      country: "AU",
      lat: -33.8688,
      lon: 151.2093,
      timezone: "Australia/Sydney",
      daylightSaving: false,
    });

    const yesChart = await generateChartWithAdapter(yesInput, "AstronomyEngineAdapter");
    const noChart = await generateChartWithAdapter(noInput, "AstronomyEngineAdapter");

    expect(yesChart.normalized.offsetMinutes).toBe(-660);
    expect(yesChart.normalized.daylightSaving).toBe(true);
    expect(yesChart.normalized.utcDateTime).toBe("2024-04-06T15:30:00Z");

    expect(noChart.normalized.offsetMinutes).toBe(-600);
    expect(noChart.normalized.daylightSaving).toBe(false);
    expect(noChart.normalized.utcDateTime).toBe("2024-04-06T16:30:00Z");
  });
});
