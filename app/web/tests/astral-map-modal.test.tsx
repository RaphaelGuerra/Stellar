/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AstralMapModal } from "../src/components/AstralMapModal";
import type { AstralMapModel, MapPlanetPoint } from "../src/lib/types";

function makePoint(id: string, chart: "A" | "B", x: number, y: number): MapPlanetPoint {
  const planet = (id === "1" ? "Sun" : id === "2" ? "Moon" : "Venus") as MapPlanetPoint["planet"];
  return {
    chart,
    planet,
    longitude: 0,
    x,
    y,
  };
}

const pointA = makePoint("1", "A", 50, 20);
const pointB = makePoint("2", "A", 20, 60);
const pointC = makePoint("3", "B", 75, 65);

const model: AstralMapModel = {
  mode: "compatibility",
  usedAscendantFallback: false,
  houses: Array.from({ length: 12 }, (_, index) => ({
    house: index + 1,
    cuspLongitude: index * 30,
    sign: "Aries",
    degree: 0,
    beta: true,
  })),
  planets: [pointA, pointB, pointC],
  lines: [
    { type: "Square", tone: "challenging", from: pointA, to: pointB, orb: 1 },
    { type: "Trine", tone: "harmonious", from: pointA, to: pointC, orb: 1 },
    { type: "Conjunction", tone: "intense", from: pointB, to: pointC, orb: 1 },
  ],
};

const labels = {
  close: "Close",
  download: "Download PNG",
  downloadDone: "PNG downloaded successfully.",
  downloadError: "Could not generate PNG.",
  filters: "Aspect filters",
  allAspects: "All",
  legendOuterA: "outer ring",
  legendInnerB: "inner ring",
  legendFlow: "flow",
  legendTension: "tension",
  legendIntense: "intense",
};

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(() => "blob:map"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(() => undefined),
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    fillStyle: "",
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,abc");
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

  class MockImage {
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    set src(_value: string) {
      this.onload?.();
    }
  }

  vi.stubGlobal("Image", MockImage as unknown as typeof Image);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AstralMapModal", () => {
  it("opens and closes with escape", () => {
    const onClose = vi.fn();
    render(
      <AstralMapModal
        isOpen
        model={model}
        title="Full-resolution astral map"
        onClose={onClose}
        labels={labels}
      />
    );

    expect(screen.getByRole("dialog", { name: "Full-resolution astral map" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("exports PNG and shows success feedback", async () => {
    render(
      <AstralMapModal
        isOpen
        model={model}
        title="Full-resolution astral map"
        onClose={vi.fn()}
        labels={labels}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Download PNG" }));

    expect(await screen.findByText("PNG downloaded successfully.")).toBeTruthy();
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it("filters visible aspect lines by aspect button", () => {
    render(
      <AstralMapModal
        isOpen
        model={model}
        title="Full-resolution astral map"
        onClose={vi.fn()}
        labels={labels}
      />
    );

    const before = document.querySelectorAll(".astral-map__aspect").length;
    expect(before).toBe(3);

    fireEvent.click(screen.getByRole("button", { name: "Square" }));

    const after = document.querySelectorAll(".astral-map__aspect").length;
    expect(after).toBe(2);
  });
});
