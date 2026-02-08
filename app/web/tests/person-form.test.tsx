/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PersonForm } from "../src/components/PersonForm";

const labels = {
  date: "Date",
  time: "Time",
  cityAndCountry: "City & country",
  searchPlaceholder: "e.g. New York, US",
  searching: "Searching cities...",
  noResults: "No cities found.",
  cityHint: "Type to search cities worldwide.",
  daylightSaving: "Daylight saving",
  daylightSavingAuto: "Auto (recommended)",
  daylightSavingManual: "Manual daylight saving override",
  daylightSavingManualHint: "Use manual only for ambiguous fallback times.",
  yes: "Yes",
  no: "No",
};

const geo = {
  locationInput: "New York, US",
  setLocationInput: vi.fn(),
  city: "New York",
  country: "US",
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
};

afterEach(() => {
  cleanup();
});

describe("PersonForm daylight saving override", () => {
  it("keeps manual DST control collapsed by default and expands on demand", () => {
    render(
      <PersonForm
        date="2000-01-01"
        time="12:00"
        daylightSavingValue="auto"
        onDateChange={vi.fn()}
        onTimeChange={vi.fn()}
        onDaylightSavingChange={vi.fn()}
        geo={geo}
        labels={labels}
        hintId="hint-a"
        suggestionsId="suggestions-a"
        namePrefix="birth-a"
        activeIndex={-1}
        onKeyDown={vi.fn()}
      />
    );

    expect(screen.queryByText("Auto (recommended)")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Manual daylight saving override" }));
    expect(screen.getByText("Auto (recommended)")).toBeTruthy();
  });

  it("auto-opens manual DST control when exception flag is set", () => {
    render(
      <PersonForm
        date="2000-01-01"
        time="12:00"
        daylightSavingValue="auto"
        onDateChange={vi.fn()}
        onTimeChange={vi.fn()}
        onDaylightSavingChange={vi.fn()}
        geo={geo}
        labels={labels}
        hintId="hint-b"
        suggestionsId="suggestions-b"
        namePrefix="birth-b"
        activeIndex={-1}
        onKeyDown={vi.fn()}
        showDaylightSavingOverride
      />
    );

    expect(screen.getByText("Auto (recommended)")).toBeTruthy();
  });
});
