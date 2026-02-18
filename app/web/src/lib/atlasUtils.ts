import type { AstrocartographyLine, AstrocartographyResult } from "./engine";
import { SUPPORTED_CITIES, resolveCity } from "./resolveCity";
import type { GeoSuggestion } from "./useGeoSearch";

export interface AtlasShortlistEntry {
  label: string;
  score: number;
  nearestLines: string[];
}

export type AtlasGoalFocus = "career" | "relationships" | "home" | "growth";

export interface AtlasCrossingEntry {
  key: string;
  pairLabel: string;
  distance: number;
  interpretation: string;
}

export interface AtlasInspectorLineEntry {
  key: string;
  label: string;
  distance: number;
  interpretation: string;
}

export interface AtlasInspectorResultEntry {
  locationLabel: string;
  locationLat: number;
  locationLon: number;
  nearestLines: AtlasInspectorLineEntry[];
  strongestCrossing?: AtlasCrossingEntry;
}

export function toSignedLongitude(value: number): number {
  const normalized = ((value % 360) + 360) % 360;
  return normalized > 180 ? normalized - 360 : normalized;
}

export function longitudeDistanceDegrees(a: number, b: number): number {
  const delta = Math.abs(a - b);
  return delta > 180 ? 360 - delta : delta;
}

export function parseSupportedCityLabel(label: string): { city: string; country: string } | null {
  const parts = label.split(",");
  if (parts.length < 2) return null;
  const country = parts[parts.length - 1]?.trim();
  const city = parts.slice(0, -1).join(",").trim();
  if (!city || !country) return null;
  return { city, country };
}

export function classifyAtlasPoint(point: AstrocartographyLine["point"]): "supportive" | "intense" | "neutral" {
  if (point === "Venus" || point === "Jupiter" || point === "Sun") return "supportive";
  if (point === "Mars" || point === "Saturn" || point === "Pluto") return "intense";
  return "neutral";
}

export function buildCrossingInterpretation(
  left: AstrocartographyLine,
  right: AstrocartographyLine,
  isCarioca: boolean
): string {
  const toneLeft = classifyAtlasPoint(left.point);
  const toneRight = classifyAtlasPoint(right.point);
  const hasCareerAngle = left.angle === "MC" || right.angle === "MC";
  const hasRelationshipAngle = left.angle === "DSC" || right.angle === "DSC";
  const hasIdentityAngle = left.angle === "ASC" || right.angle === "ASC";

  if (toneLeft === "supportive" && toneRight === "supportive") {
    return isCarioca
      ? "Zona boa pra crescimento com apoio natural."
      : "Supportive zone with strong growth potential.";
  }
  if (toneLeft === "intense" || toneRight === "intense") {
    return isCarioca
      ? "Zona de pressao; pede disciplina e ajuste fino."
      : "Pressure zone that rewards discipline and clear boundaries.";
  }
  if (hasCareerAngle) {
    return isCarioca ? "Foco forte em carreira e direcao publica." : "Strong emphasis on career and public direction.";
  }
  if (hasRelationshipAngle) {
    return isCarioca
      ? "Ativa relacoes e pactos com outras pessoas."
      : "Activates relationship dynamics and partnership commitments.";
  }
  if (hasIdentityAngle) {
    return isCarioca ? "Puxa reinvencao pessoal e autonomia." : "Pulls personal reinvention and autonomy.";
  }
  return isCarioca ? "Mistura neutra; observa no dia a dia." : "Mixed neutral crossing; validate through lived experience.";
}

export function buildAtlasLineInterpretation(line: AstrocartographyLine, isCarioca: boolean): string {
  const tone = classifyAtlasPoint(line.point);
  if (line.angle === "MC") {
    return isCarioca
      ? "Linha de visibilidade publica e direcao de carreira."
      : "Career and public visibility line.";
  }
  if (line.angle === "ASC") {
    return isCarioca ? "Linha de identidade e reinvencao pessoal." : "Identity and personal reinvention line.";
  }
  if (line.angle === "DSC") {
    return isCarioca ? "Linha de encontros, parceria e espelhamento." : "Partnership and relational mirroring line.";
  }
  if (tone === "supportive") {
    return isCarioca ? "Tom favoravel, com apoio natural." : "Supportive tone with natural ease.";
  }
  if (tone === "intense") {
    return isCarioca ? "Tom intenso, pede estrategia e limite." : "Intense tone that rewards strategy and boundaries.";
  }
  return isCarioca ? "Tom neutro, valida no cotidiano." : "Neutral tone; validate through lived experience.";
}

export function buildAtlasCrossings(
  astrocartography: AstrocartographyResult | null,
  isCarioca: boolean
): AtlasCrossingEntry[] {
  if (!astrocartography || astrocartography.lines.length < 2) return [];
  const entries: AtlasCrossingEntry[] = [];
  for (let i = 0; i < astrocartography.lines.length; i++) {
    for (let j = i + 1; j < astrocartography.lines.length; j++) {
      const left = astrocartography.lines[i];
      const right = astrocartography.lines[j];
      if (left.point === right.point && left.angle === right.angle) continue;
      const distance = longitudeDistanceDegrees(left.longitude, right.longitude);
      if (distance > 1.5) continue;
      const pairLabel = `${left.point} ${left.angle} × ${right.point} ${right.angle}`;
      entries.push({
        key: `${left.point}-${left.angle}-${right.point}-${right.angle}`,
        pairLabel,
        distance: Math.round(distance * 10) / 10,
        interpretation: buildCrossingInterpretation(left, right, isCarioca),
      });
    }
  }
  return entries.sort((a, b) => a.distance - b.distance).slice(0, 8);
}

export function atlasGoalWeight(line: AstrocartographyLine, goal: AtlasGoalFocus): number {
  if (goal === "career") {
    if (line.angle === "MC" && (line.point === "Sun" || line.point === "Jupiter")) return 2.2;
    if (line.angle === "MC" || line.angle === "ASC") return 1.5;
    if (line.point === "Saturn") return 1.2;
    return 1;
  }
  if (goal === "relationships") {
    if (line.angle === "DSC" && (line.point === "Venus" || line.point === "Moon")) return 2.3;
    if (line.angle === "DSC") return 1.7;
    if (line.point === "Venus" || line.point === "Jupiter") return 1.4;
    return 1;
  }
  if (goal === "home") {
    if (line.angle === "IC" && (line.point === "Moon" || line.point === "Venus")) return 2.3;
    if (line.angle === "IC") return 1.7;
    if (line.point === "Moon") return 1.5;
    return 1;
  }
  if (line.point === "Jupiter" || line.point === "Sun") return 2;
  if (line.angle === "ASC" || line.angle === "MC") return 1.6;
  return 1.1;
}

export function buildAtlasShortlist(
  astrocartography: AstrocartographyResult | null,
  goal: AtlasGoalFocus
): AtlasShortlistEntry[] {
  if (!astrocartography || astrocartography.lines.length === 0) return [];
  const candidates: AtlasShortlistEntry[] = [];
  for (const label of SUPPORTED_CITIES) {
    const parsed = parseSupportedCityLabel(label);
    if (!parsed) continue;
    try {
      const resolved = resolveCity(parsed);
      const cityLongitude = toSignedLongitude(resolved.lon);
      const nearest = astrocartography.lines
        .map((line) => ({
          line,
          distance: longitudeDistanceDegrees(cityLongitude, line.longitude),
        }))
        .sort((left, right) => left.distance - right.distance)
        .slice(0, 4);
      if (nearest.length === 0 || nearest[0].distance > 6) continue;
      const score = nearest.reduce(
        (sum, hit) => sum + Math.max(0, 6 - hit.distance) * atlasGoalWeight(hit.line, goal),
        0
      );
      candidates.push({
        label,
        score: Math.round(score * 10) / 10,
        nearestLines: nearest.slice(0, 3).map((hit) => `${hit.line.point} ${hit.line.angle} (${hit.distance.toFixed(1)}deg)`),
      });
    } catch {
      // Skip any malformed fallback labels.
    }
  }
  return candidates.sort((left, right) => right.score - left.score).slice(0, 6);
}

export function buildAtlasInspectorResult(
  astrocartography: AstrocartographyResult | null,
  location: GeoSuggestion,
  crossings: AtlasCrossingEntry[],
  isCarioca: boolean
): AtlasInspectorResultEntry | null {
  if (!astrocartography || astrocartography.lines.length === 0) return null;
  const signedLongitude = toSignedLongitude(location.lon);
  const nearestLines = astrocartography.lines
    .map((line) => ({
      line,
      distance: longitudeDistanceDegrees(signedLongitude, line.longitude),
    }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, 5)
    .map((entry) => ({
      key: `${entry.line.point}-${entry.line.angle}-${entry.line.longitude}`,
      label: `${entry.line.point} ${entry.line.angle}`,
      distance: Math.round(entry.distance * 10) / 10,
      interpretation: buildAtlasLineInterpretation(entry.line, isCarioca),
    }));
  const nearestLabels = new Set(nearestLines.map((line) => line.label));
  const strongestCrossing = crossings.find((crossing) => {
    const [left, right] = crossing.pairLabel.split(" × ");
    return nearestLabels.has(left) || nearestLabels.has(right);
  });
  return {
    locationLabel: location.label,
    locationLat: location.lat,
    locationLon: location.lon,
    nearestLines,
    strongestCrossing,
  };
}
