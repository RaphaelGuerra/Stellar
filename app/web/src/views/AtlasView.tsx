import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAppContext } from "../context/AppContext";
import { Section } from "../components/Section";
import { AstrocartographyMap } from "../components/AstrocartographyMap";
import { runAstroWorkerTask } from "../lib/astroWorkerClient";
import {
  buildAtlasShortlist,
  buildAtlasCrossings,
  buildAtlasInspectorResult,
  type AtlasGoalFocus,
  type AtlasInspectorResultEntry,
} from "../lib/atlasUtils";
import { resolveLocationCandidates } from "../lib/useGeoSearch";
import type { AstrocartographyResult } from "../lib/engine";

export function AtlasView() {
  const {
    chartA,
    chartSettings,
    isCarioca,
    loading,
    atlasInspectorInput,
    setAtlasInspectorInput,
  } = useAppContext();

  const t = {
    atlasTitle: isCarioca ? "Astrocartografia" : "Astrocartography",
    atlasMapTitle: isCarioca ? "Mapa global de linhas" : "Global line map",
    atlasMapBadge: isCarioca ? "MC/IC/ASC/DSC" : "MC/IC/ASC/DSC",
    atlasMapHint: isCarioca
      ? "Linhas verticais mostram onde cada ponto angular fica mais forte."
      : "Vertical lines show where each angle expression is strongest globally.",
    atlasShortlistTitle: isCarioca ? "Melhores cidades por linhas" : "Best-fit location shortlist",
    atlasShortlistBadge: isCarioca ? "proximidade de linhas" : "line proximity",
    atlasGoalFocusTitle: isCarioca ? "Objetivo principal" : "Primary goal",
    atlasGoalCareer: isCarioca ? "Carreira" : "Career",
    atlasGoalRelationships: isCarioca ? "Relacoes" : "Relationships",
    atlasGoalHome: isCarioca ? "Casa/Familia" : "Home/Family",
    atlasGoalGrowth: isCarioca ? "Crescimento" : "Growth",
    atlasShortlistEmpty: isCarioca
      ? "Sem matches fortes por enquanto. Tenta mudar data ou sistema de casas."
      : "No strong matches yet. Try another date or house system.",
    atlasCrossingsTitle: isCarioca ? "Cruzamentos de linhas" : "Line crossings",
    atlasCrossingsBadge: isCarioca ? "zonas de sobreposicao" : "overlap zones",
    atlasCrossingsEmpty: isCarioca
      ? "Sem cruzamentos fortes no momento."
      : "No strong crossings detected right now.",
    atlasInspectorTitle: isCarioca ? "Inspecionar localizacao" : "Inspect location",
    atlasInspectorHint: isCarioca
      ? "Busca uma cidade e ve as linhas mais proximas."
      : "Search a location and inspect the nearest lines.",
    atlasInspectorButton: isCarioca ? "Inspecionar" : "Inspect",
    atlasInspectorLoading: isCarioca ? "Inspecionando..." : "Inspecting...",
    atlasInspectorCrossing: isCarioca ? "Cruzamento dominante" : "Strongest crossing",
    atlasInspectorEmpty: isCarioca
      ? "Sem leitura ainda. Escolhe uma cidade e clica em inspecionar."
      : "No location analysis yet. Enter a city and inspect.",
    searchPlaceholder: isCarioca ? "Ex: Rio de Janeiro, BR" : "e.g. New York, US",
    emptyState: isCarioca
      ? 'Clica em "Gerar mapa, porra" pra ver o atlas.'
      : 'Click "Generate chart" to see the astrocartography atlas.',
  };

  const [astrocartography, setAstrocartography] = useState<AstrocartographyResult | null>(null);
  const [atlasGoalFocus, setAtlasGoalFocus] = useState<AtlasGoalFocus>("career");
  const [atlasInspectorLoading, setAtlasInspectorLoading] = useState(false);
  const [atlasInspectorError, setAtlasInspectorError] = useState<string | null>(null);
  const [atlasInspectorResult, setAtlasInspectorResult] = useState<AtlasInspectorResultEntry | null>(null);

  useEffect(() => {
    if (!chartA) {
      setAstrocartography(null);
      return;
    }
    let canceled = false;
    runAstroWorkerTask<AstrocartographyResult>({
      type: "generateAstrocartography",
      baseChart: chartA,
      settings: chartSettings,
    })
      .then((next) => {
        if (canceled) return;
        setAstrocartography(next);
      })
      .catch(() => {
        if (canceled) return;
        setAstrocartography(null);
      });
    return () => { canceled = true; };
  }, [chartA, chartSettings]);

  const atlasShortlist = useMemo(
    () => buildAtlasShortlist(astrocartography, atlasGoalFocus),
    [astrocartography, atlasGoalFocus]
  );
  const atlasCrossings = useMemo(
    () => buildAtlasCrossings(astrocartography, isCarioca),
    [astrocartography, isCarioca]
  );
  const atlasHighlightedLabels = useMemo(
    () => atlasInspectorResult?.nearestLines.map((line) => line.label) ?? [],
    [atlasInspectorResult]
  );

  async function handleInspectAtlasLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAtlasInspectorError(null);
    if (!astrocartography) {
      setAtlasInspectorResult(null);
      setAtlasInspectorError(
        isCarioca
          ? "Gera o atlas primeiro pra inspecionar local."
          : "Generate atlas lines first to inspect a location."
      );
      return;
    }
    const query = atlasInspectorInput.trim();
    if (query.length < 3) {
      setAtlasInspectorResult(null);
      setAtlasInspectorError(
        isCarioca
          ? "Manda pelo menos 3 letras da cidade."
          : "Type at least 3 characters to search a location."
      );
      return;
    }
    setAtlasInspectorLoading(true);
    try {
      const candidates = await resolveLocationCandidates(query, isCarioca, 6);
      if (candidates === null) {
        setAtlasInspectorResult(null);
        setAtlasInspectorError(
          isCarioca
            ? "Busca de cidade indisponivel agora."
            : "Location search is temporarily unavailable."
        );
        return;
      }
      if (candidates.length === 0) {
        setAtlasInspectorResult(null);
        setAtlasInspectorError(
          isCarioca
            ? "Nao achei essa localizacao. Tenta cidade + pais."
            : "Location not found. Try city + country."
        );
        return;
      }
      if (candidates.length > 1) {
        setAtlasInspectorResult(null);
        setAtlasInspectorError(
          isCarioca
            ? "Localizacao ambigua. Especifica melhor com pais."
            : "Ambiguous location. Add country for a specific result."
        );
        return;
      }
      const resolved = candidates[0];
      const nextResult = buildAtlasInspectorResult(astrocartography, resolved, atlasCrossings, isCarioca);
      if (!nextResult) {
        setAtlasInspectorResult(null);
        setAtlasInspectorError(
          isCarioca
            ? "Nao foi possivel analisar esse ponto."
            : "Could not analyze this location right now."
        );
        return;
      }
      setAtlasInspectorInput(resolved.label);
      setAtlasInspectorResult(nextResult);
    } finally {
      setAtlasInspectorLoading(false);
    }
  }

  if (loading) return null;

  if (!chartA) {
    return <p className="empty-state">{t.emptyState}</p>;
  }

  return (
    <>
      {astrocartography && (
        <Section icon="🧭" title={t.atlasTitle} badge={`${astrocartography.lines.length} lines · ${t.atlasMapBadge}`}>
          <p className="timeline-day__summary">{t.atlasMapHint}</p>
          <AstrocartographyMap
            lines={astrocartography.lines}
            highlightedLabels={atlasHighlightedLabels}
            location={
              atlasInspectorResult
                ? {
                    label: atlasInspectorResult.locationLabel,
                    lat: atlasInspectorResult.locationLat,
                    lon: atlasInspectorResult.locationLon,
                  }
                : null
            }
            label={t.atlasMapTitle}
          />
          <p className="timeline-day__summary">{t.atlasMapTitle}</p>
          <div className="timeline-grid">
            {astrocartography.lines.slice(0, 24).map((line, index) => (
              <div key={`${line.point}-${line.angle}-${index}`} className="timeline-day">
                <p className="timeline-day__date">{line.point} {line.angle}</p>
                <p className="timeline-day__summary">Lon {line.longitude.toFixed(1)}deg</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section icon="📍" title={t.atlasShortlistTitle} badge={t.atlasShortlistBadge}>
        <div className="timeline-controls" role="group" aria-label={t.atlasGoalFocusTitle}>
          <button
            type="button"
            className={`timeline-controls__btn ${atlasGoalFocus === "career" ? "timeline-controls__btn--active" : ""}`}
            onClick={() => setAtlasGoalFocus("career")}
          >
            {t.atlasGoalCareer}
          </button>
          <button
            type="button"
            className={`timeline-controls__btn ${atlasGoalFocus === "relationships" ? "timeline-controls__btn--active" : ""}`}
            onClick={() => setAtlasGoalFocus("relationships")}
          >
            {t.atlasGoalRelationships}
          </button>
          <button
            type="button"
            className={`timeline-controls__btn ${atlasGoalFocus === "home" ? "timeline-controls__btn--active" : ""}`}
            onClick={() => setAtlasGoalFocus("home")}
          >
            {t.atlasGoalHome}
          </button>
          <button
            type="button"
            className={`timeline-controls__btn ${atlasGoalFocus === "growth" ? "timeline-controls__btn--active" : ""}`}
            onClick={() => setAtlasGoalFocus("growth")}
          >
            {t.atlasGoalGrowth}
          </button>
        </div>
        {atlasShortlist.length === 0 ? (
          <p className="timeline-day__summary">{t.atlasShortlistEmpty}</p>
        ) : (
          <div className="timeline-grid">
            {atlasShortlist.map((entry) => (
              <div key={entry.label} className="timeline-day">
                <p className="timeline-day__date">{entry.label}</p>
                <p className="timeline-day__summary">Score {entry.score.toFixed(1)}</p>
                {entry.nearestLines.map((line) => (
                  <p key={`${entry.label}-${line}`} className="timeline-day__summary">{line}</p>
                ))}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon="🧷" title={t.atlasCrossingsTitle} badge={t.atlasCrossingsBadge}>
        {atlasCrossings.length === 0 ? (
          <p className="timeline-day__summary">{t.atlasCrossingsEmpty}</p>
        ) : (
          <div className="timeline-grid">
            {atlasCrossings.map((entry) => (
              <div key={entry.key} className="timeline-day">
                <p className="timeline-day__date">{entry.pairLabel}</p>
                <p className="timeline-day__summary">Delta {entry.distance.toFixed(1)}deg</p>
                <p className="timeline-day__summary">{entry.interpretation}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon="📌" title={t.atlasInspectorTitle}>
        <p className="timeline-day__summary">{t.atlasInspectorHint}</p>
        <form className="timeline-controls" onSubmit={handleInspectAtlasLocation}>
          <input
            type="text"
            value={atlasInspectorInput}
            placeholder={t.searchPlaceholder}
            onChange={(event) => setAtlasInspectorInput(event.target.value)}
          />
          <button type="submit" className="timeline-controls__btn" disabled={atlasInspectorLoading}>
            {atlasInspectorLoading ? t.atlasInspectorLoading : t.atlasInspectorButton}
          </button>
        </form>
        {atlasInspectorError && (
          <p className="form__error" role="alert">
            {atlasInspectorError}
          </p>
        )}
        {!atlasInspectorError && !atlasInspectorResult && (
          <p className="timeline-day__summary">{t.atlasInspectorEmpty}</p>
        )}
        {atlasInspectorResult && (
          <div className="timeline-grid">
            <div className="timeline-day">
              <p className="timeline-day__date">{atlasInspectorResult.locationLabel}</p>
              {atlasInspectorResult.nearestLines.map((line) => (
                <p key={line.key} className="timeline-day__summary">
                  {line.label} ({line.distance.toFixed(1)}deg): {line.interpretation}
                </p>
              ))}
            </div>
            {atlasInspectorResult.strongestCrossing && (
              <div className="timeline-day">
                <p className="timeline-day__date">{t.atlasInspectorCrossing}</p>
                <p className="timeline-day__summary">{atlasInspectorResult.strongestCrossing.pairLabel}</p>
                <p className="timeline-day__summary">
                  Delta {atlasInspectorResult.strongestCrossing.distance.toFixed(1)}deg
                </p>
                <p className="timeline-day__summary">{atlasInspectorResult.strongestCrossing.interpretation}</p>
              </div>
            )}
          </div>
        )}
      </Section>
    </>
  );
}
