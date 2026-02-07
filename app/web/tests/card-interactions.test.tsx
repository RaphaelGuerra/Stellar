/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Card } from "../src/components/Card";

afterEach(() => {
  cleanup();
});

function renderCard() {
  return render(
    <Card
      title="Card Title"
      subtitle="Card Subtitle"
      text="Short summary text."
      tags={["focus"]}
      details={[
        {
          title: "Action step",
          text: "Deep explanation",
        },
      ]}
    />
  );
}

describe("Card interactions", () => {
  it("expands and collapses when clicking the card surface", () => {
    const { container } = renderCard();
    const card = container.querySelector("article");
    expect(card).toBeTruthy();

    expect(screen.queryByText("Deep explanation")).toBeNull();

    fireEvent.click(card!);
    expect(screen.getByText("Deep explanation")).toBeTruthy();

    fireEvent.click(card!);
    expect(screen.queryByText("Deep explanation")).toBeNull();
  });

  it("expands and collapses with Enter and Space on the focused card", () => {
    const { container } = renderCard();
    const card = container.querySelector("article");
    expect(card).toBeTruthy();

    card!.focus();
    expect(document.activeElement).toBe(card);
    expect(screen.queryByText("Deep explanation")).toBeNull();

    fireEvent.keyDown(card!, { key: "Enter" });
    expect(screen.getByText("Deep explanation")).toBeTruthy();

    fireEvent.keyDown(card!, { key: " " });
    expect(screen.queryByText("Deep explanation")).toBeNull();
  });

  it("expand label reflects state and toggles when clicked", () => {
    renderCard();

    const openLabel = screen.getByText("Show more");
    fireEvent.click(openLabel);

    expect(screen.getByText("Deep explanation")).toBeTruthy();
    expect(screen.getByText("Show less")).toBeTruthy();

    fireEvent.click(screen.getByText("Show less"));
    expect(screen.queryByText("Deep explanation")).toBeNull();
  });

  it("does not render expand controls for non-overflow text without details", () => {
    render(
      <Card
        title="Compact card"
        text="No extra content."
        tags={["compact"]}
      />
    );

    expect(screen.queryByText("Show more")).toBeNull();
    expect(screen.queryByText("Show less")).toBeNull();
  });
});
