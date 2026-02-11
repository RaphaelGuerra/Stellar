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
      analysisMode: "compatibility",
      duoMode: "friend",
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
    expect(loaded?.analysisMode).toBe("compatibility");
    expect(loaded?.duoMode).toBe("friend");
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
    expect(loaded?.personA.locationInput).toBe("Rio de Janeiro, BR");
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
      analysisMode: "single",
      duoMode: "romantic",
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
});
