/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatePicker } from "../src/components/DatePicker";

afterEach(() => {
  cleanup();
});

describe("DatePicker", () => {
  it("uses localized aria labels when provided", () => {
    render(
      <DatePicker
        value="2000-01-15"
        onChange={vi.fn()}
        locale="pt-BR"
        labels={{
          chooseDate: "Escolher data",
          year: "Ano",
          previousMonth: "Mes anterior",
          nextMonth: "Proximo mes",
        }}
      />
    );

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("dialog", { name: "Escolher data" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Ano" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mes anterior" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Proximo mes" })).toBeTruthy();
  });

  it("resyncs calendar month from value when reopened", () => {
    const { rerender } = render(
      <DatePicker value="2000-01-15" onChange={vi.fn()} locale="en-US" />
    );

    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);
    expect(screen.getByText(/January/i)).toBeTruthy();

    fireEvent.click(trigger);
    rerender(<DatePicker value="2000-03-15" onChange={vi.fn()} locale="en-US" />);

    fireEvent.click(trigger);
    expect(screen.getByText(/March/i)).toBeTruthy();
  });
});
