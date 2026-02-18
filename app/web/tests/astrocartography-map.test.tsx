/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { AstrocartographyMap } from "../src/components/AstrocartographyMap";

describe("AstrocartographyMap", () => {
  it("renders map lines and location marker", () => {
    render(
      <AstrocartographyMap
        lines={[
          { point: "Sun", angle: "MC", longitude: -45 },
          { point: "Venus", angle: "DSC", longitude: 120 },
        ]}
        highlightedLabels={["Sun MC"]}
        location={{ label: "Rio", lat: -22.9, lon: -43.2 }}
      />
    );

    expect(screen.getByRole("img", { name: "Astrocartography world map" })).toBeTruthy();
    expect(screen.getByText("Rio")).toBeTruthy();
    expect(screen.getAllByText("MC").length).toBeGreaterThan(0);
    expect(screen.getAllByText("DSC").length).toBeGreaterThan(0);
  });
});
