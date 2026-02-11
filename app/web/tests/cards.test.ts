import { describe, expect, it } from "vitest";
import { buildCards, type ContentPack } from "../src/lib/cards";
import type { ChartResult, PlanetName } from "../src/lib/types";

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

const baseContent: ContentPack = {
  sign: {
    Aries: {
      title: "Aries style",
      text: "Direct, active, and candid.",
      tags: ["initiative", "drive"],
    },
  },
  house: {},
  planet: {
    Sun: {
      title: "Sun core",
      text: "Identity and purpose.",
      tags: ["identity", "leadership"],
    },
  },
  aspect: {
    Trine: {
      title: "Easy flow",
      text: "This pair tends to cooperate naturally.",
      tags: ["flow", "cooperation"],
    },
  },
};

function buildChart(): ChartResult {
  const planets = {} as ChartResult["planets"];
  for (const planet of PLANETS) {
    planets[planet] = { sign: "Aries", degree: 10, longitude: 10 };
  }

  return {
    input: {
      date: "2000-01-01",
      time: "12:00",
      city: "Test",
      country: "TS",
      daylight_saving: "auto",
    },
    normalized: {
      localDateTime: "2000-01-01T12:00",
      utcDateTime: "2000-01-01T12:00:00Z",
      timezone: "UTC",
      offsetMinutes: 0,
      daylightSaving: false,
      location: { lat: 0, lon: 0 },
    },
    planets,
    aspects: [{ a: "Sun", b: "Moon", type: "Trine", orb: 0.8 }],
  };
}

describe("buildCards details", () => {
  it("adds structured English details for planet-sign and aspect cards", () => {
    const cards = buildCards(baseContent, buildChart(), "normal");

    const sunCard = cards.find((card) => card.category === "planet-sign" && card.planet === "Sun");
    expect(sunCard?.details?.length).toBeGreaterThan(0);
    expect(sunCard?.title).toContain("Sun ·");
    expect(sunCard?.subtitle).toContain("Planet placement");
    expect(sunCard?.details?.[0]?.title).toBe("How this shows up day to day");

    const aspectCard = cards.find((card) => card.category === "aspect");
    expect(aspectCard?.details?.length).toBeGreaterThan(0);
    expect(aspectCard?.subtitle).toContain("Aspect ·");
    expect(aspectCard?.details?.[0]?.title).toBe("Aspect dynamic");
    expect(aspectCard?.details?.[2]?.text).toContain("Very tight orb");
  });

  it("adds structured Carioca details for planet-sign and aspect cards", () => {
    const cards = buildCards(baseContent, buildChart(), "carioca");

    const sunCard = cards.find((card) => card.category === "planet-sign" && card.planet === "Sun");
    expect(sunCard?.details?.length).toBeGreaterThan(0);
    expect(sunCard?.title).toContain("Sun ·");
    expect(sunCard?.subtitle).toContain("Posicao planetaria");
    expect(sunCard?.details?.[0]?.title).toBe("Como isso aparece no dia a dia");

    const aspectCard = cards.find((card) => card.category === "aspect");
    expect(aspectCard?.details?.length).toBeGreaterThan(0);
    expect(aspectCard?.subtitle).toContain("Aspecto ·");
    expect(aspectCard?.details?.[0]?.title).toBe("Dinamica desse aspecto");
    expect(aspectCard?.details?.[2]?.text).toContain("Orb bem fechado");
  });
});
