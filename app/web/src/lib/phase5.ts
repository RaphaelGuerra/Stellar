import { SIGNS, normalizeAngle } from "./constants";
import { getLocalDayKey } from "./progression";
import { buildDailyTransitOutlook, type TransitLocale } from "./transits";
import type { ChartResult, DuoMode, PlanetName, PlanetPlacement } from "./types";

export type ForecastRange = 7 | 14;

export interface CompatibilityForecastDay {
  dayKey: string;
  dateLabel: string;
  vibeScore: number;
  riskScore: number;
  summary: string;
}

export interface CompatibilityForecast {
  days: CompatibilityForecastDay[];
  bestDay: CompatibilityForecastDay;
  toughestDay: CompatibilityForecastDay;
}

export interface OverlayMetric {
  key: string;
  label: string;
  value: string;
}

export interface AdvancedOverlaySummary {
  compositeCore: OverlayMetric[];
  midpointHighlights: OverlayMetric[];
}

interface BuildPhase5Options {
  locale?: TransitLocale;
  duoMode?: DuoMode;
  now?: Date;
  timeZone?: string;
}

const PLANET_ORDER: PlanetName[] = ["Sun", "Moon", "Mercury", "Venus", "Mars"];

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function toneWeight(tone: string, mode: "vibe" | "risk"): number {
  if (mode === "vibe") {
    if (tone === "harmonious") return 24;
    if (tone === "intense") return 14;
    return 8;
  }
  if (tone === "challenging") return 22;
  if (tone === "intense") return 14;
  return 8;
}

function vibeSummary(score: number, locale: TransitLocale): string {
  if (locale === "pt") {
    if (score >= 70) return "Janela forte pra construir junto.";
    if (score >= 45) return "Dia estavel com ajustes pontuais.";
    return "Dia sensivel: combina tudo no claro.";
  }
  if (score >= 70) return "Strong window to build together.";
  if (score >= 45) return "Stable day with minor adjustments.";
  return "Sensitive day: use explicit agreements.";
}

function formatLongitude(longitude: number): string {
  const normalized = normalizeAngle(longitude);
  const signIndex = Math.floor(normalized / 30);
  const degree = normalized % 30;
  return `${SIGNS[signIndex]} ${degree.toFixed(1)}°`;
}

function placementLongitude(placement: PlanetPlacement | undefined): number {
  if (!placement) return 0;
  if (typeof placement.longitude === "number" && Number.isFinite(placement.longitude)) {
    return normalizeAngle(placement.longitude);
  }
  const signIndex = SIGNS.indexOf(placement.sign);
  return normalizeAngle(signIndex * 30 + (placement.degree ?? 0));
}

function circularMidpoint(a: number, b: number): number {
  const aRad = a * Math.PI / 180;
  const bRad = b * Math.PI / 180;
  const x = Math.cos(aRad) + Math.cos(bRad);
  const y = Math.sin(aRad) + Math.sin(bRad);
  if (Math.abs(x) < 1e-10 && Math.abs(y) < 1e-10) {
    return normalizeAngle(a + 180);
  }
  return normalizeAngle(Math.atan2(y, x) * 180 / Math.PI);
}

export function buildCompatibilityForecast(
  chartA: ChartResult,
  chartB: ChartResult,
  duration: ForecastRange,
  options: BuildPhase5Options = {}
): CompatibilityForecast {
  const locale = options.locale ?? "pt";
  const duoMode = options.duoMode ?? "romantic";
  const now = options.now ?? new Date();
  const timeZone = options.timeZone ?? chartA.normalized.timezone;

  const days: CompatibilityForecastDay[] = [];
  for (let offset = 0; offset < duration; offset++) {
    const date = new Date(now.getTime() + offset * 86400000);
    const outlook = buildDailyTransitOutlook(chartA, chartB, {
      locale,
      duoMode,
      now: date,
    });

    const orbOpportunityBoost = Math.max(0, 8 - (outlook.opportunity.orb ?? 0));
    const orbRiskBoost = Math.max(0, 8 - (outlook.watchout.orb ?? 0));
    const vibeScore = clamp(
      50
        + toneWeight(outlook.opportunity.tone, "vibe")
        + orbOpportunityBoost
        - toneWeight(outlook.watchout.tone, "risk")
        - orbRiskBoost
    );
    const riskScore = clamp(
      18
        + toneWeight(outlook.watchout.tone, "risk") * 3
        + orbRiskBoost * 4
        - toneWeight(outlook.opportunity.tone, "vibe")
    );
    days.push({
      dayKey: getLocalDayKey(date, timeZone),
      dateLabel: outlook.dateLabel,
      vibeScore,
      riskScore,
      summary: vibeSummary(vibeScore, locale),
    });
  }

  const bestDay = [...days].sort((left, right) => right.vibeScore - left.vibeScore)[0];
  const toughestDay = [...days].sort((left, right) => right.riskScore - left.riskScore)[0];
  return { days, bestDay, toughestDay };
}

export function buildAdvancedOverlaySummary(
  chartA: ChartResult,
  chartB: ChartResult,
  locale: TransitLocale = "pt"
): AdvancedOverlaySummary {
  const compositeCore: OverlayMetric[] = PLANET_ORDER.map((planet) => {
    const lonA = placementLongitude(chartA.planets[planet]);
    const lonB = placementLongitude(chartB.planets[planet]);
    const composite = circularMidpoint(lonA, lonB);
    return {
      key: `composite-${planet}`,
      label: locale === "pt" ? `${planet} composto` : `${planet} composite`,
      value: formatLongitude(composite),
    };
  });

  const ascA = placementLongitude(chartA.angles?.ascendant);
  const ascB = placementLongitude(chartB.angles?.ascendant);
  const midpointHighlights: OverlayMetric[] = [
    {
      key: "midpoint-sun-moon",
      label: locale === "pt" ? "Ponto medio Sol/Lua" : "Sun/Moon midpoint",
      value: formatLongitude(
        circularMidpoint(
          placementLongitude(chartA.planets.Sun),
          placementLongitude(chartB.planets.Moon)
        )
      ),
    },
    {
      key: "midpoint-venus-mars",
      label: locale === "pt" ? "Ponto medio Venus/Marte" : "Venus/Mars midpoint",
      value: formatLongitude(
        circularMidpoint(
          placementLongitude(chartA.planets.Venus),
          placementLongitude(chartB.planets.Mars)
        )
      ),
    },
    {
      key: "midpoint-asc",
      label: locale === "pt" ? "Ascendente medio" : "Ascendant midpoint",
      value: formatLongitude(circularMidpoint(ascA, ascB)),
    },
  ];

  return {
    compositeCore,
    midpointHighlights,
  };
}
