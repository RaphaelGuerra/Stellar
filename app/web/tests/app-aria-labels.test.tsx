/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";

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

describe("App aria labels localization", () => {
  it("switches landmark/group labels from English to Carioca mode", () => {
    render(<App />);

    expect(screen.getByRole("main").getAttribute("aria-label")).toBe("Birth chart generator");
    expect(screen.getByRole("group", { name: "Content mode" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Analysis mode" })).toBeTruthy();
    expect(screen.getByLabelText("Current chart info")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Carioca, porra" }));

    expect(screen.getByRole("main").getAttribute("aria-label")).toBe("Gerador de mapa astral");
    expect(screen.getByRole("group", { name: "Modo de conteudo" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Modo de analise" })).toBeTruthy();
    expect(screen.getByLabelText("Dados atuais do mapa")).toBeTruthy();
  });

  it("shows duo mode toggle only in compatibility mode", () => {
    render(<App />);

    expect(screen.queryByRole("group", { name: "Duo mode" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Compatibility" }));
    expect(screen.getByRole("group", { name: "Duo mode" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Romantic" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Friend" })).toBeTruthy();
  });
});
