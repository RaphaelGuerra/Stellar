/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  APP_STATE_RETENTION_DAYS,
  APP_STATE_STORAGE_KEY,
  PRIVACY_SETTINGS_STORAGE_KEY,
  clearPersistedAppState,
  readPersistedAppState,
  readPrivacySettings,
  writePrivacySettings,
  writePersistedAppState,
  type PersistedAppState,
} from "../src/lib/appState";

function installMockStorage() {
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
}

beforeEach(() => {
  installMockStorage();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("app state persistence", () => {
  it("writes and reads persisted app state", () => {
    const state: PersistedAppState = {
      primaryArea: "relationships",
      analysisMode: "compatibility",
      duoMode: "friend",
      chartSettings: {
        zodiac: "tropical",
        houseSystem: "WholeSign",
        aspectProfile: "major",
        orbMode: "tight",
        includeMinorAspects: true,
      },
      timeTravelDate: "2026-02-14",
      transitDayPage: 2,
      selectedTransitDate: "2026-02-16",
      reminders: {
        enabled: true,
        leadDays: 2,
        maxOrb: 0.5,
        lastSentKey: "k-1",
      },
      atlasInspectorInput: "Lisbon, PT",
      personA: {
        date: "1991-05-10",
        time: "08:30",
        daylightSaving: "auto",
        locationInput: "Rio de Janeiro, BR",
      },
      personB: {
        date: "1992-07-20",
        time: "14:45",
        daylightSaving: false,
        locationInput: "Lisbon, PT",
      },
      history: [],
      progression: {
        xp: 120,
        streak: 3,
        lastCompletionDay: "2026-02-10",
        completedQuestIds: ["q-1"],
        reflectedQuestIds: ["q-1"],
      },
    };

    writePersistedAppState(state);
    const loaded = readPersistedAppState();

    expect(loaded).not.toBeNull();
    expect(loaded?.primaryArea).toBe("relationships");
    expect(loaded?.analysisMode).toBe("compatibility");
    expect(loaded?.duoMode).toBe("friend");
    expect(loaded?.chartSettings.houseSystem).toBe("WholeSign");
    expect(loaded?.timeTravelDate).toBe("2026-02-14");
    expect(loaded?.transitDayPage).toBe(2);
    expect(loaded?.selectedTransitDate).toBe("2026-02-16");
    expect(loaded?.reminders.enabled).toBe(true);
    expect(loaded?.reminders.maxOrb).toBe(0.5);
    expect(loaded?.atlasInspectorInput).toBe("Lisbon, PT");
    expect(loaded?.personA.locationInput).toBe("Rio de Janeiro, BR");
    expect(loaded?.personB.daylightSaving).toBe(false);
    expect(loaded?.progression.xp).toBe(120);
    expect(loaded?.progression.streak).toBe(3);
    expect(loaded?.progression.completedQuestIds).toEqual(["q-1"]);
  });

  it("returns safe defaults for invalid stored payload", () => {
    window.localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify({ analysisMode: "weird" }));
    const loaded = readPersistedAppState();

    expect(loaded).not.toBeNull();
    expect(loaded?.analysisMode).toBe("single");
    expect(loaded?.duoMode).toBe("romantic");
    expect(loaded?.primaryArea).toBe("chart");
    expect(loaded?.chartSettings.houseSystem).toBe("Placidus");
    expect(loaded?.timeTravelDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(loaded?.transitDayPage).toBe(0);
    expect(loaded?.selectedTransitDate).toBeUndefined();
    expect(loaded?.reminders).toEqual({
      enabled: false,
      leadDays: 1,
      maxOrb: 0.4,
      lastSentKey: undefined,
    });
    expect(loaded?.personA.locationInput).toBe("");
    expect(loaded?.history).toEqual([]);
    expect(loaded?.progression).toEqual({
      xp: 0,
      streak: 0,
      completedQuestIds: [],
      reflectedQuestIds: [],
      lastCompletionDay: undefined,
    });
  });

  it("drops expired persisted payloads", () => {
    const staleUpdatedAt = new Date(
      Date.now() - (APP_STATE_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000
    ).toISOString();
    window.localStorage.setItem(
      APP_STATE_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 2,
        updatedAt: staleUpdatedAt,
        state: {
          analysisMode: "single",
          duoMode: "romantic",
          primaryArea: "chart",
          chartSettings: {
            zodiac: "tropical",
            houseSystem: "Placidus",
            aspectProfile: "major",
            orbMode: "standard",
            includeMinorAspects: false,
          },
          timeTravelDate: "2025-01-01",
          transitDayPage: 0,
          reminders: {
            enabled: false,
            leadDays: 1,
            maxOrb: 0.4,
          },
          atlasInspectorInput: "Rio de Janeiro, BR",
          personA: {
            date: "1990-01-01",
            time: "12:00",
            daylightSaving: "auto",
            locationInput: "Rio de Janeiro, BR",
          },
          personB: {
            date: "1990-01-01",
            time: "12:00",
            daylightSaving: "auto",
            locationInput: "New York, US",
          },
          history: [],
          progression: {
            xp: 0,
            streak: 0,
            completedQuestIds: [],
            reflectedQuestIds: [],
          },
        },
      })
    );

    expect(readPersistedAppState()).toBeNull();
    expect(window.localStorage.getItem(APP_STATE_STORAGE_KEY)).toBeNull();
  });

  it("supports local privacy settings", () => {
    expect(readPrivacySettings().persistLocalData).toBe(true);

    writePrivacySettings({ persistLocalData: false });
    expect(readPrivacySettings().persistLocalData).toBe(false);

    const raw = window.localStorage.getItem(PRIVACY_SETTINGS_STORAGE_KEY);
    expect(raw).not.toBeNull();
  });

  it("clears persisted app state on demand", () => {
    writePersistedAppState({
      primaryArea: "chart",
      analysisMode: "single",
      duoMode: "romantic",
      chartSettings: {
        zodiac: "tropical",
        houseSystem: "Placidus",
        aspectProfile: "major",
        orbMode: "standard",
        includeMinorAspects: false,
      },
      timeTravelDate: "2026-02-01",
      transitDayPage: 0,
      reminders: {
        enabled: false,
        leadDays: 1,
        maxOrb: 0.4,
      },
      atlasInspectorInput: "Rio de Janeiro, BR",
      personA: {
        date: "1990-01-01",
        time: "12:00",
        daylightSaving: "auto",
        locationInput: "Rio de Janeiro, BR",
      },
      personB: {
        date: "1990-01-01",
        time: "12:00",
        daylightSaving: "auto",
        locationInput: "New York, US",
      },
      history: [],
      progression: {
        xp: 0,
        streak: 0,
        completedQuestIds: [],
        reflectedQuestIds: [],
      },
    });

    expect(window.localStorage.getItem(APP_STATE_STORAGE_KEY)).not.toBeNull();
    clearPersistedAppState();
    expect(window.localStorage.getItem(APP_STATE_STORAGE_KEY)).toBeNull();
  });

  it("migrates v2 payloads without primaryArea or chartSettings into v3 defaults", () => {
    window.localStorage.setItem(
      APP_STATE_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 2,
        updatedAt: new Date().toISOString(),
        state: {
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
          history: [],
          progression: {
            xp: 0,
            streak: 0,
            completedQuestIds: [],
            reflectedQuestIds: [],
          },
        },
      })
    );

    const loaded = readPersistedAppState();
    expect(loaded).not.toBeNull();
    expect(loaded?.primaryArea).toBe("chart");
    expect(loaded?.chartSettings.houseSystem).toBe("Placidus");
    expect(loaded?.analysisMode).toBe("compatibility");
    expect(loaded?.timeTravelDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(loaded?.reminders.enabled).toBe(false);
    expect(loaded?.atlasInspectorInput).toBe("Rio de Janeiro, BR");
  });
});
