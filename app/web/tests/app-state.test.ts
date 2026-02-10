/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  APP_STATE_STORAGE_KEY,
  readPersistedAppState,
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
    };

    writePersistedAppState(state);
    const loaded = readPersistedAppState();

    expect(loaded).not.toBeNull();
    expect(loaded?.analysisMode).toBe("compatibility");
    expect(loaded?.duoMode).toBe("friend");
    expect(loaded?.personA.locationInput).toBe("Rio de Janeiro, BR");
    expect(loaded?.personB.daylightSaving).toBe(false);
  });

  it("returns safe defaults for invalid stored payload", () => {
    window.localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify({ analysisMode: "weird" }));
    const loaded = readPersistedAppState();

    expect(loaded).not.toBeNull();
    expect(loaded?.analysisMode).toBe("single");
    expect(loaded?.duoMode).toBe("romantic");
    expect(loaded?.personA.locationInput).toBe("Rio de Janeiro, BR");
    expect(loaded?.history).toEqual([]);
  });
});
