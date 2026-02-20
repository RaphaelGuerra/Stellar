/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { Router } from "wouter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { AppProvider } from "../src/context/AppContext";
import {
  APP_STATE_STORAGE_KEY,
  PRIVACY_SETTINGS_STORAGE_KEY,
} from "../src/lib/appState";
import type { ChartResult, PlanetName, ZodiacSign } from "../src/lib/types";

vi.mock("../src/lib/useGeoSearch", () => {
  const makeGeo = () => ({
    locationInput: "Rio de Janeiro, BR",
    setLocationInput: vi.fn(),
    city: "Rio de Janeiro",
    country: "BR",
    location: undefined,
    suggestions: [],
    setSuggestions: vi.fn(),
    isSearching: false,
    searchError: null,
    setSearchError: vi.fn(),
    showSuggestions: false,
    showNoResults: false,
    selectSuggestion: vi.fn(),
    applyResolved: vi.fn(),
  });

  return {
    useGeoSearch: () => makeGeo(),
    resolveLocationCandidates: vi.fn(),
  };
});

beforeEach(() => {
  window.history.pushState({}, "", "/");
  const store = new Map<string, string>();
  const storage: Storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });
});

afterEach(() => {
  cleanup();
});

const PLANETS: PlanetName[] = [
  "Sun",
  "Moon",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
  "Uranus",
  "Neptune",
  "Pluto",
];

const SIGNS: ZodiacSign[] = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];

function toPlacement(longitude: number) {
  const normalized = ((longitude % 360) + 360) % 360;
  const signIndex = Math.floor(normalized / 30);
  const degree = Math.round((normalized % 30) * 10) / 10;
  return {
    sign: SIGNS[signIndex],
    degree,
    longitude: normalized,
  };
}

function buildChart(longitudes: Partial<Record<PlanetName, number>>): ChartResult {
  const planets = {} as ChartResult["planets"];
  for (const planet of PLANETS) {
    planets[planet] = toPlacement(longitudes[planet] ?? 0);
  }
  return {
    input: {
      date: "1990-01-01",
      time: "12:00",
      city: "Rio de Janeiro",
      country: "BR",
      daylight_saving: "auto",
    },
    normalized: {
      localDateTime: "1990-01-01T12:00",
      utcDateTime: "1990-01-01T15:00:00Z",
      timezone: "America/Sao_Paulo",
      offsetMinutes: 180,
      daylightSaving: false,
      location: { lat: -22.9, lon: -43.2 },
    },
    planets,
    aspects: [],
  };
}

function renderApp() {
  return render(
    <Router>
      <AppProvider>
        <App />
      </AppProvider>
    </Router>
  );
}

describe("App aria labels localization", () => {
  it("switches landmark/group labels from English to Carioca mode", () => {
    renderApp();

    expect(screen.getByRole("main").getAttribute("aria-label")).toBe("Birth chart generator");
    expect(screen.getByRole("group", { name: "Content mode" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Analysis mode" })).toBeTruthy();
    expect(screen.getByLabelText("Current chart info")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Carioca" }));

    expect(screen.getByRole("main").getAttribute("aria-label")).toBe("Gerador de mapa astral");
    expect(screen.getByRole("group", { name: "Idioma" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Modo de analise" })).toBeTruthy();
    expect(screen.getByLabelText("Dados atuais do mapa")).toBeTruthy();
  });

  it("shows duo mode toggle only in compatibility mode", () => {
    renderApp();

    expect(screen.queryByRole("group", { name: "Duo mode" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Compatibility" }));
    expect(screen.getByRole("group", { name: "Duo mode" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Romantic" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Friend" })).toBeTruthy();
  });

  it("renders the Today for Us section for saved compatibility charts", async () => {
    const chartA = buildChart({ Sun: 0, Moon: 90, Venus: 120 });
    const chartB = buildChart({ Sun: 180, Moon: 270, Venus: 300 });
    window.localStorage.setItem(
      APP_STATE_STORAGE_KEY,
      JSON.stringify({
        analysisMode: "compatibility",
        duoMode: "romantic",
        personA: {
          date: "1990-01-01",
          time: "12:00",
          daylightSaving: "auto",
          locationInput: "Rio de Janeiro, BR",
        },
        personB: {
          date: "1992-02-02",
          time: "18:00",
          daylightSaving: "auto",
          locationInput: "New York, US",
        },
        lastChartA: chartA,
        lastChartB: chartB,
        history: [],
      })
    );

    renderApp();

    fireEvent.click(screen.getByRole("button", { name: "Chart" }));
    const mapHeading = screen.getByRole("heading", { name: "Astral map" });
    const normalizedHeading = screen.getByRole("heading", { name: "Normalized data" });
    expect(mapHeading).toBeTruthy();
    expect(
      (mapHeading.compareDocumentPosition(normalizedHeading) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    ).toBe(true);
    expect(screen.getByRole("heading", { name: "Sun, Moon, Ascendant" })).toBeTruthy();
    expect(screen.getAllByText("House cusps calculated using the selected system.").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Transits" }));
    expect(await screen.findByRole("heading", { name: "Today for Us" })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Compatibility timeline" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Relationships" }));
    expect(await screen.findByRole("heading", { name: "Advanced overlays" })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Synastry" })).toBeTruthy();
  });

  it("opens and closes the full-resolution astral map modal", () => {
    const chartA = buildChart({ Sun: 0, Moon: 90, Venus: 120 });
    const chartB = buildChart({ Sun: 180, Moon: 270, Venus: 300 });
    window.localStorage.setItem(
      APP_STATE_STORAGE_KEY,
      JSON.stringify({
        analysisMode: "compatibility",
        duoMode: "romantic",
        personA: {
          date: "1990-01-01",
          time: "12:00",
          daylightSaving: "auto",
          locationInput: "Rio de Janeiro, BR",
        },
        personB: {
          date: "1992-02-02",
          time: "18:00",
          daylightSaving: "auto",
          locationInput: "New York, US",
        },
        lastChartA: chartA,
        lastChartB: chartB,
        history: [],
      })
    );

    renderApp();

    fireEvent.click(screen.getByRole("button", { name: "Chart" }));
    fireEvent.click(screen.getByRole("button", { name: "Open full-resolution map" }));
    expect(screen.getByRole("dialog", { name: "Full-resolution astral map" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Full-resolution astral map" })).toBeNull();
  });

  it("localizes Today for Us section in Carioca mode", async () => {
    const chartA = buildChart({ Sun: 0, Moon: 90, Venus: 120 });
    const chartB = buildChart({ Sun: 180, Moon: 270, Venus: 300 });
    window.localStorage.setItem(
      APP_STATE_STORAGE_KEY,
      JSON.stringify({
        analysisMode: "compatibility",
        duoMode: "friend",
        personA: {
          date: "1990-01-01",
          time: "12:00",
          daylightSaving: "auto",
          locationInput: "Rio de Janeiro, BR",
        },
        personB: {
          date: "1992-02-02",
          time: "18:00",
          daylightSaving: "auto",
          locationInput: "New York, US",
        },
        lastChartA: chartA,
        lastChartB: chartB,
        history: [],
      })
    );

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Carioca" }));
    fireEvent.click(screen.getByRole("button", { name: "Transitos" }));

    expect(await screen.findByRole("heading", { name: "Hoje pra parceria" })).toBeTruthy();
    expect(await screen.findByText(/Janela de|Janela estavel/)).toBeTruthy();
  });

  it("tracks mission reflection bonus and updates labels", async () => {
    const chartA = buildChart({ Sun: 0, Moon: 90, Venus: 120 });
    const chartB = buildChart({ Sun: 180, Moon: 270, Venus: 300 });
    const todayUtc = new Date().toISOString().slice(0, 10);
    window.localStorage.setItem(
      APP_STATE_STORAGE_KEY,
      JSON.stringify({
        analysisMode: "compatibility",
        duoMode: "romantic",
        personA: {
          date: "1990-01-01",
          time: "12:00",
          daylightSaving: "auto",
          locationInput: "Rio de Janeiro, BR",
        },
        personB: {
          date: "1992-02-02",
          time: "18:00",
          daylightSaving: "auto",
          locationInput: "New York, US",
        },
        lastChartA: chartA,
        lastChartB: chartB,
        history: [],
        progression: {
          xp: 0,
          streak: 0,
          completedQuestIds: [`daily-mission:${todayUtc}`],
          reflectedQuestIds: [],
          unlockedInsights: [],
        },
      })
    );

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Relationships" }));

    expect(await screen.findByRole("heading", { name: "Relationship quest" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Complete quest (+40 XP)" })).toBeNull();
    const reflect = await screen.findByRole("button", { name: "Log reflection (+bonus insight)" });
    expect((reflect as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(reflect);
    expect(await screen.findByRole("button", { name: "Reflection bonus claimed" })).toBeTruthy();
  });

  it("allows disabling persistence and clearing local data", () => {
    const chartA = buildChart({ Sun: 0, Moon: 90, Venus: 120 });
    window.localStorage.setItem(
      APP_STATE_STORAGE_KEY,
      JSON.stringify({
        analysisMode: "single",
        duoMode: "romantic",
        personA: {
          date: "1990-01-01",
          time: "12:00",
          daylightSaving: "auto",
          locationInput: "Rio de Janeiro, BR",
        },
        personB: {
          date: "1992-02-02",
          time: "18:00",
          daylightSaving: "auto",
          locationInput: "New York, US",
        },
        lastChartA: chartA,
        history: [],
      })
    );

    renderApp();

    const persistToggle = screen.getByRole("checkbox", { name: "Save data on this device" });
    fireEvent.click(persistToggle);
    expect(window.localStorage.getItem(APP_STATE_STORAGE_KEY)).toBeNull();

    const clearButton = screen.getByRole("button", { name: "Clear local data now" });
    fireEvent.click(clearButton);
    expect(window.localStorage.getItem(APP_STATE_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(PRIVACY_SETTINGS_STORAGE_KEY)).not.toBeNull();
  });
});
