import { useMemo, useCallback } from "react";
import { useAppContext } from "../context/AppContext";
import { Card } from "../components/Card";
import { Section } from "../components/Section";
import { PlacementsSummary } from "../components/PlacementsSummary";
import { LoadingState } from "../components/LoadingState";
import { AstralMapThumbnail } from "../components/AstralMapThumbnail";
import { buildPlacementsSummary } from "../lib/cards";
import { ASPECT_SYMBOL, SIGN_SYMBOL } from "../lib/constants";
import {
  buildPointTableRows,
  buildHouseTableRows,
  buildAspectTableRows,
  buildDignityRows,
  formatPlacementLabel,
  type DignityStatus,
} from "../lib/chartUtils";

export function ChartView() {
  const {
    chartA,
    chartB,
    analysisMode,
    isCarioca,
    placements,
    astralMapModel,
    chartMeta,
    chartMetaB,
    chartSettings,
    resultVersion,
    loading,
    isMapModalOpen: _isMapModalOpen,
    setIsMapModalOpen,
    cards,
  } = useAppContext();

  const t = {
    normalizedTitle: isCarioca ? "Dados mastigados" : "Normalized data",
    timezoneLabel: isCarioca ? "Fuso" : "Timezone",
    utcLabel: "UTC",
    localLabel: isCarioca ? "Local" : "Local",
    offsetLabel: isCarioca ? "Offset" : "Offset",
    latLonLabel: "Lat/Lon",
    dstLabel: isCarioca ? "Horario de verao" : "Daylight saving",
    yes: isCarioca ? "Sim, porra" : "Yes",
    no: isCarioca ? "Nao, caralho" : "No",
    settingsHouseSystem: isCarioca ? "Sistema de casas" : "House system",
    housesStatus: isCarioca
      ? "Casas calculadas certinho no sistema que tu escolheu."
      : "House cusps calculated using the selected system.",
    coreTriadTitle: isCarioca ? "Sol, Lua e Ascendente" : "Sun, Moon, Ascendant",
    coreTriadBadge: isCarioca ? "o basico, mermao" : "chart core",
    coreSun: isCarioca ? "Sol (quem tu e de verdade)" : "Sun (identity)",
    coreMoon: isCarioca ? "Lua (o emocional, cria)" : "Moon (emotions)",
    coreAsc: isCarioca ? "Ascendente (a fachada, ne)" : "Ascendant (outer style)",
    coreAscMissing: isCarioca ? "Ascendente sumiu, que merda" : "Ascendant unavailable",
    personA: isCarioca ? "Tu (Pessoa A)" : "Person A",
    personB: isCarioca ? "O outro (Pessoa B)" : "Person B",
    chartPointsTitle: isCarioca ? "Tabela completa de pontos" : "Full points table",
    chartHousesTitle: isCarioca ? "Tabela de casas" : "House table",
    chartAspectsTableTitle: isCarioca ? "Tabela de aspectos" : "Aspects table",
    chartAspectsTableBadge: (n: number) => isCarioca ? `${n} aspectos` : `${n} aspects`,
    chartDignitiesTitle: isCarioca ? "Dignidades dos planetas" : "Dignities summary",
    chartDignitiesBadge: (n: number) => isCarioca ? `${n} planetas` : `${n} planets`,
    chartPointsBadge: (n: number) => isCarioca ? `${n} pontos` : `${n} points`,
    chartHousesBadge: (n: number) => isCarioca ? `${n} casas` : `${n} houses`,
    colPoint: isCarioca ? "Ponto" : "Point",
    colHouse: isCarioca ? "Casa" : "House",
    colAspect: isCarioca ? "Aspecto" : "Aspect",
    colSign: isCarioca ? "Signo" : "Sign",
    colDegree: isCarioca ? "Grau" : "Degree",
    colLongitude: isCarioca ? "Longitude" : "Longitude",
    colOrb: "Orb",
    colStatus: isCarioca ? "Status" : "Status",
    emptyTable: isCarioca ? "Nada pra mostrar ainda, fica frio." : "No data available.",
    dignityDomicile: isCarioca ? "Em casa (domicilio)" : "Domicile",
    dignityExaltation: isCarioca ? "Exaltado, voando" : "Exaltation",
    dignityDetriment: isCarioca ? "Fudido (detrimento)" : "Detriment",
    dignityFall: isCarioca ? "Na lona (queda)" : "Fall",
    dignityNeutral: isCarioca ? "De boa" : "Neutral",
    sunMoonInsightsTitle: isCarioca ? "Sol e Lua no papo reto" : "Sun and Moon insights",
    planetsTitle: isCarioca ? "Onde cada planeta ta" : "Planet placements",
    aspectsTitle: isCarioca ? "Aspectos entre os planetas" : "Planetary aspects",
    aspectsBadge: (n: number) => isCarioca ? `${n} conexoes brabas` : `${n} connections`,
    emptyState: isCarioca
      ? 'Aperta "Gerar mapa, porra!" la em cima pra ver teu mapa.'
      : 'Click "Generate chart" to see your birth chart cards.',
    loading: isCarioca ? "Calculando os planetas, segura ai..." : "Calculating planetary positions",
    astralMapTitle: isCarioca ? "Mapa astral visual" : "Astral map",
    astralMapBadge:
      analysisMode === "compatibility"
        ? isCarioca ? "duplo + conexoes" : "combined + connections"
        : isCarioca ? "solo + conexoes" : "single + connections",
    astralMapThumbTitle:
      analysisMode === "compatibility"
        ? isCarioca ? "Energia combinada dos dois" : "Combined energy map"
        : isCarioca ? "Teu mapa completo" : "Full chart map",
    astralMapThumbSubtitle:
      analysisMode === "compatibility"
        ? `${isCarioca ? "Pessoa A" : "Person A"} + ${isCarioca ? "Pessoa B" : "Person B"}`
        : isCarioca ? "Planetas, casas e aspectos" : "Planets, houses, and aspects",
    astralMapOpen: isCarioca ? "Abrir mapa em HD" : "Open full-resolution map",
    astralMapHouseBeta: isCarioca
      ? "Casas seguem o sistema escolhido. So usa equal-house se faltar dado."
      : "Houses follow the selected system; equal-house is only a fallback when data is missing.",
    astralMapAscFallback: isCarioca
      ? "Ascendente sumiu do dado salvo. Usando 0 grau de Aries como fallback."
      : "Ascendant missing in saved data. Using fallback at 0deg Aries.",
  };

  const cardExpandLabels = isCarioca
    ? { more: "Ver mais", less: "Fecha ai" }
    : { more: "Show more", less: "Show less" };

  const { heroCards, planetCards, aspectCards } = useMemo(() => {
    const HERO_PLANETS = new Set(["Sun", "Moon"]);
    const hero = [];
    const planets = [];
    const aspects = [];
    for (const card of cards) {
      if (card.category === "aspect") aspects.push(card);
      else if (card.planet && HERO_PLANETS.has(card.planet)) hero.push(card);
      else if (card.planet) planets.push(card);
    }
    return { heroCards: hero, planetCards: planets, aspectCards: aspects };
  }, [cards]);

  const placementsB = useMemo(() => {
    if (!chartB) return [];
    return buildPlacementsSummary(chartB);
  }, [chartB]);

  const pointRowsA = useMemo(() => (chartA ? buildPointTableRows(chartA) : []), [chartA]);
  const pointRowsB = useMemo(() => (chartB ? buildPointTableRows(chartB) : []), [chartB]);
  const houseRowsA = useMemo(() => (chartA ? buildHouseTableRows(chartA) : []), [chartA]);
  const houseRowsB = useMemo(() => (chartB ? buildHouseTableRows(chartB) : []), [chartB]);
  const aspectRowsA = useMemo(() => (chartA ? buildAspectTableRows(chartA) : []), [chartA]);
  const aspectRowsB = useMemo(() => (chartB ? buildAspectTableRows(chartB) : []), [chartB]);
  const dignityRowsA = useMemo(() => (chartA ? buildDignityRows(chartA) : []), [chartA]);
  const dignityRowsB = useMemo(() => (chartB ? buildDignityRows(chartB) : []), [chartB]);

  const formatDignityStatusLabel = useCallback(
    (status: DignityStatus) => {
      if (status === "domicile") return t.dignityDomicile;
      if (status === "exaltation") return t.dignityExaltation;
      if (status === "detriment") return t.dignityDetriment;
      if (status === "fall") return t.dignityFall;
      return t.dignityNeutral;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isCarioca]
  );

  if (loading) {
    return <LoadingState label={t.loading} />;
  }

  return (
    <>
      {astralMapModel && (
        <Section icon="🗺️" title={t.astralMapTitle} badge={t.astralMapBadge} collapsible>
          <AstralMapThumbnail
            model={astralMapModel}
            title={t.astralMapThumbTitle}
            subtitle={t.astralMapThumbSubtitle}
            openLabel={t.astralMapOpen}
            onOpen={() => setIsMapModalOpen(true)}
          />
          <p className="astral-map-note">{t.astralMapHouseBeta}</p>
          {astralMapModel.usedAscendantFallback && (
            <p className="astral-map-note astral-map-note--warning">{t.astralMapAscFallback}</p>
          )}
        </Section>
      )}

      {analysisMode === "single" && chartA && (
        <Section icon="🧭" title={t.normalizedTitle} collapsible defaultOpen={false}>
          <div className="normalized">
            <p>{t.timezoneLabel}: {chartA.normalized.timezone}</p>
            <p>{t.utcLabel}: {chartA.normalized.utcDateTime}</p>
            <p>{t.localLabel}: {chartA.normalized.localDateTime}</p>
            <p>{t.offsetLabel}: {chartA.normalized.offsetMinutes} min</p>
            <p>{t.latLonLabel}: {chartA.normalized.location.lat}, {chartA.normalized.location.lon}</p>
            <p>{t.dstLabel}: {chartA.normalized.daylightSaving ? t.yes : t.no}</p>
            <p>{t.settingsHouseSystem}: {chartA.settings?.houseSystem ?? chartSettings.houseSystem}</p>
            <p>{t.housesStatus}</p>
          </div>
        </Section>
      )}

      {analysisMode === "single" && chartA && (
        <Section icon="🧬" title={t.coreTriadTitle} badge={t.coreTriadBadge} collapsible>
          <div className="core-triad">
            <p><strong>{t.coreSun}:</strong> {formatPlacementLabel(chartA.planets.Sun, t.coreAscMissing)}</p>
            <p><strong>{t.coreMoon}:</strong> {formatPlacementLabel(chartA.planets.Moon, t.coreAscMissing)}</p>
            <p><strong>{t.coreAsc}:</strong> {formatPlacementLabel(chartA.angles?.ascendant, t.coreAscMissing)}</p>
          </div>
        </Section>
      )}

      {analysisMode === "compatibility" && chartA && chartB && (
        <Section icon="🧭" title={t.normalizedTitle} collapsible defaultOpen={false}>
          <div className="normalized normalized--comparison">
            <div className="normalized__card">
              <h3 className="normalized__title">{t.personA}</h3>
              <p>{chartMeta?.location}</p>
              <p>{chartMeta?.datetime}</p>
              <p>{t.timezoneLabel}: {chartA.normalized.timezone}</p>
              <p>{t.utcLabel}: {chartA.normalized.utcDateTime}</p>
              <p>{t.dstLabel}: {chartA.normalized.daylightSaving ? t.yes : t.no}</p>
              <p>{t.settingsHouseSystem}: {chartA.settings?.houseSystem ?? chartSettings.houseSystem}</p>
              <p>{t.housesStatus}</p>
            </div>
            <div className="normalized__card">
              <h3 className="normalized__title">{t.personB}</h3>
              <p>{chartMetaB?.location}</p>
              <p>{chartMetaB?.datetime}</p>
              <p>{t.timezoneLabel}: {chartB.normalized.timezone}</p>
              <p>{t.utcLabel}: {chartB.normalized.utcDateTime}</p>
              <p>{t.dstLabel}: {chartB.normalized.daylightSaving ? t.yes : t.no}</p>
              <p>{t.settingsHouseSystem}: {chartB.settings?.houseSystem ?? chartSettings.houseSystem}</p>
              <p>{t.housesStatus}</p>
            </div>
          </div>
          <div className="comparison-placements">
            <div>
              <h3 className="comparison-placements__title">{t.personA}</h3>
              <PlacementsSummary placements={placements} />
            </div>
            <div>
              <h3 className="comparison-placements__title">{t.personB}</h3>
              <PlacementsSummary placements={placementsB} />
            </div>
          </div>
        </Section>
      )}

      {analysisMode === "compatibility" && chartA && chartB && (
        <Section icon="🧬" title={t.coreTriadTitle} badge={t.coreTriadBadge} collapsible>
          <div className="core-triad core-triad--comparison">
            <div className="core-triad__card">
              <h3 className="core-triad__title">{t.personA}</h3>
              <p><strong>{t.coreSun}:</strong> {formatPlacementLabel(chartA.planets.Sun, t.coreAscMissing)}</p>
              <p><strong>{t.coreMoon}:</strong> {formatPlacementLabel(chartA.planets.Moon, t.coreAscMissing)}</p>
              <p><strong>{t.coreAsc}:</strong> {formatPlacementLabel(chartA.angles?.ascendant, t.coreAscMissing)}</p>
            </div>
            <div className="core-triad__card">
              <h3 className="core-triad__title">{t.personB}</h3>
              <p><strong>{t.coreSun}:</strong> {formatPlacementLabel(chartB.planets.Sun, t.coreAscMissing)}</p>
              <p><strong>{t.coreMoon}:</strong> {formatPlacementLabel(chartB.planets.Moon, t.coreAscMissing)}</p>
              <p><strong>{t.coreAsc}:</strong> {formatPlacementLabel(chartB.angles?.ascendant, t.coreAscMissing)}</p>
            </div>
          </div>
        </Section>
      )}

      {analysisMode === "single" && chartA && (
        <Section icon="📐" title={t.chartPointsTitle} badge={t.chartPointsBadge(pointRowsA.length)} collapsible defaultOpen={false}>
          <div className="table-block">
            <table className="chart-table">
              <thead>
                <tr>
                  <th>{t.colPoint}</th>
                  <th>{t.colSign}</th>
                  <th>{t.colDegree}</th>
                  <th>{t.colLongitude}</th>
                </tr>
              </thead>
              <tbody>
                {pointRowsA.map((row) => (
                  <tr key={`point-a-${row.point}`}>
                    <td>{row.symbol} {row.point}</td>
                    <td>{row.sign === "--" ? "--" : `${SIGN_SYMBOL[row.sign]} ${row.sign}`}</td>
                    <td>{row.degree}</td>
                    <td>{row.longitude}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="timeline-day__summary">{t.chartHousesTitle}</p>
          {houseRowsA.length === 0 ? (
            <p className="timeline-day__summary">{t.emptyTable}</p>
          ) : (
            <div className="table-block">
              <table className="chart-table">
                <thead>
                  <tr>
                    <th>{t.colHouse}</th>
                    <th>{t.colSign}</th>
                    <th>{t.colDegree}</th>
                    <th>{t.colLongitude}</th>
                  </tr>
                </thead>
                <tbody>
                  {houseRowsA.map((row) => (
                    <tr key={`house-a-${row.house}`}>
                      <td>{row.house}</td>
                      <td>{row.sign === "--" ? "--" : `${SIGN_SYMBOL[row.sign]} ${row.sign}`}</td>
                      <td>{row.degree}</td>
                      <td>{row.longitude}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {analysisMode === "single" && chartA && (
        <Section icon="📎" title={t.chartAspectsTableTitle} badge={t.chartAspectsTableBadge(aspectRowsA.length)} collapsible defaultOpen={false}>
          {aspectRowsA.length === 0 ? (
            <p className="timeline-day__summary">{t.emptyTable}</p>
          ) : (
            <div className="table-block">
              <table className="chart-table">
                <thead>
                  <tr>
                    <th>{t.colAspect}</th>
                    <th>{t.colOrb}</th>
                  </tr>
                </thead>
                <tbody>
                  {aspectRowsA.map((aspect, index) => (
                    <tr key={`aspect-a-${aspect.a}-${aspect.type}-${aspect.b}-${index}`}>
                      <td>{aspect.a} {ASPECT_SYMBOL[aspect.type]} {aspect.type} {aspect.b}</td>
                      <td>{aspect.orb?.toFixed(1) ?? "--"}deg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {analysisMode === "single" && chartA && (
        <Section icon="🏛️" title={t.chartDignitiesTitle} badge={t.chartDignitiesBadge(dignityRowsA.length)} collapsible defaultOpen={false}>
          <div className="table-block">
            <table className="chart-table">
              <thead>
                <tr>
                  <th>{t.colPoint}</th>
                  <th>{t.colSign}</th>
                  <th>{t.colStatus}</th>
                </tr>
              </thead>
              <tbody>
                {dignityRowsA.map((row) => (
                  <tr key={`dignity-a-${row.planet}`}>
                    <td>{row.planet}</td>
                    <td>{SIGN_SYMBOL[row.sign]} {row.sign}</td>
                    <td>{formatDignityStatusLabel(row.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {analysisMode === "compatibility" && chartA && chartB && (
        <Section icon="📐" title={t.chartPointsTitle} badge={`${t.personA} + ${t.personB}`} collapsible defaultOpen={false}>
          <div className="timeline-grid">
            <div className="timeline-day">
              <p className="timeline-day__date">{t.personA}</p>
              <div className="table-block">
                <table className="chart-table">
                  <thead>
                    <tr>
                      <th>{t.colPoint}</th>
                      <th>{t.colSign}</th>
                      <th>{t.colDegree}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pointRowsA.map((row) => (
                      <tr key={`point-compat-a-${row.point}`}>
                        <td>{row.symbol} {row.point}</td>
                        <td>{row.sign === "--" ? "--" : `${SIGN_SYMBOL[row.sign]} ${row.sign}`}</td>
                        <td>{row.degree}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="timeline-day">
              <p className="timeline-day__date">{t.personB}</p>
              <div className="table-block">
                <table className="chart-table">
                  <thead>
                    <tr>
                      <th>{t.colPoint}</th>
                      <th>{t.colSign}</th>
                      <th>{t.colDegree}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pointRowsB.map((row) => (
                      <tr key={`point-compat-b-${row.point}`}>
                        <td>{row.symbol} {row.point}</td>
                        <td>{row.sign === "--" ? "--" : `${SIGN_SYMBOL[row.sign]} ${row.sign}`}</td>
                        <td>{row.degree}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Section>
      )}

      {analysisMode === "compatibility" && chartA && chartB && (
        <Section icon="🏠" title={t.chartHousesTitle} badge={`${t.personA} + ${t.personB}`} collapsible defaultOpen={false}>
          <div className="timeline-grid">
            <div className="timeline-day">
              <p className="timeline-day__date">{t.personA}</p>
              {houseRowsA.length === 0 ? (
                <p className="timeline-day__summary">{t.emptyTable}</p>
              ) : (
                <div className="table-block">
                  <table className="chart-table">
                    <thead>
                      <tr>
                        <th>{t.colHouse}</th>
                        <th>{t.colSign}</th>
                        <th>{t.colDegree}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {houseRowsA.map((row) => (
                        <tr key={`house-compat-a-${row.house}`}>
                          <td>{row.house}</td>
                          <td>{row.sign === "--" ? "--" : `${SIGN_SYMBOL[row.sign]} ${row.sign}`}</td>
                          <td>{row.degree}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="timeline-day">
              <p className="timeline-day__date">{t.personB}</p>
              {houseRowsB.length === 0 ? (
                <p className="timeline-day__summary">{t.emptyTable}</p>
              ) : (
                <div className="table-block">
                  <table className="chart-table">
                    <thead>
                      <tr>
                        <th>{t.colHouse}</th>
                        <th>{t.colSign}</th>
                        <th>{t.colDegree}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {houseRowsB.map((row) => (
                        <tr key={`house-compat-b-${row.house}`}>
                          <td>{row.house}</td>
                          <td>{row.sign === "--" ? "--" : `${SIGN_SYMBOL[row.sign]} ${row.sign}`}</td>
                          <td>{row.degree}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Section>
      )}

      {analysisMode === "compatibility" && chartA && chartB && (
        <Section icon="📎" title={t.chartAspectsTableTitle} badge={`${t.personA} + ${t.personB}`} collapsible defaultOpen={false}>
          <div className="timeline-grid">
            <div className="timeline-day">
              <p className="timeline-day__date">{t.personA}</p>
              {aspectRowsA.length === 0 ? (
                <p className="timeline-day__summary">{t.emptyTable}</p>
              ) : (
                <div className="table-block">
                  <table className="chart-table">
                    <thead>
                      <tr>
                        <th>{t.colAspect}</th>
                        <th>{t.colOrb}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aspectRowsA.slice(0, 20).map((aspect, index) => (
                        <tr key={`aspect-compat-a-${aspect.a}-${aspect.type}-${aspect.b}-${index}`}>
                          <td>{aspect.a} {ASPECT_SYMBOL[aspect.type]} {aspect.b}</td>
                          <td>{aspect.orb?.toFixed(1) ?? "--"}deg</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="timeline-day">
              <p className="timeline-day__date">{t.personB}</p>
              {aspectRowsB.length === 0 ? (
                <p className="timeline-day__summary">{t.emptyTable}</p>
              ) : (
                <div className="table-block">
                  <table className="chart-table">
                    <thead>
                      <tr>
                        <th>{t.colAspect}</th>
                        <th>{t.colOrb}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aspectRowsB.slice(0, 20).map((aspect, index) => (
                        <tr key={`aspect-compat-b-${aspect.a}-${aspect.type}-${aspect.b}-${index}`}>
                          <td>{aspect.a} {ASPECT_SYMBOL[aspect.type]} {aspect.b}</td>
                          <td>{aspect.orb?.toFixed(1) ?? "--"}deg</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Section>
      )}

      {analysisMode === "compatibility" && chartA && chartB && (
        <Section icon="🏛️" title={t.chartDignitiesTitle} badge={`${t.personA} + ${t.personB}`} collapsible defaultOpen={false}>
          <div className="timeline-grid">
            <div className="timeline-day">
              <p className="timeline-day__date">{t.personA}</p>
              <div className="table-block">
                <table className="chart-table">
                  <thead>
                    <tr>
                      <th>{t.colPoint}</th>
                      <th>{t.colSign}</th>
                      <th>{t.colStatus}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dignityRowsA.map((row) => (
                      <tr key={`dignity-compat-a-${row.planet}`}>
                        <td>{row.planet}</td>
                        <td>{SIGN_SYMBOL[row.sign]} {row.sign}</td>
                        <td>{formatDignityStatusLabel(row.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="timeline-day">
              <p className="timeline-day__date">{t.personB}</p>
              <div className="table-block">
                <table className="chart-table">
                  <thead>
                    <tr>
                      <th>{t.colPoint}</th>
                      <th>{t.colSign}</th>
                      <th>{t.colStatus}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dignityRowsB.map((row) => (
                      <tr key={`dignity-compat-b-${row.planet}`}>
                        <td>{row.planet}</td>
                        <td>{SIGN_SYMBOL[row.sign]} {row.sign}</td>
                        <td>{formatDignityStatusLabel(row.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Section>
      )}

      {analysisMode === "single" && cards.length === 0 && (
        <p className="empty-state">{t.emptyState}</p>
      )}

      {analysisMode === "single" && placements.length > 0 && (
        <PlacementsSummary placements={placements} />
      )}

      {analysisMode === "single" && heroCards.length > 0 && (
        <Section icon="☀️" title={t.sunMoonInsightsTitle} badge={`${heroCards.length} cards`} collapsible>
          <div className="cards-grid--hero">
            {heroCards.map((card) => (
              <Card
                key={`${resultVersion}-${card.key}`}
                title={card.title}
                subtitle={card.subtitle}
                text={card.text}
                tags={card.tags}
                details={card.details}
                element={card.element}
                variant="hero"
                degree={card.degree}
                expandLabels={cardExpandLabels}
              />
            ))}
          </div>
        </Section>
      )}

      {analysisMode === "single" && planetCards.length > 0 && (
        <Section icon="🪐" title={t.planetsTitle} badge={`${planetCards.length} cards`} collapsible>
          <div className="cards-grid--planets">
            {planetCards.map((card) => (
              <Card
                key={`${resultVersion}-${card.key}`}
                title={card.title}
                subtitle={card.subtitle}
                text={card.text}
                tags={card.tags}
                details={card.details}
                element={card.element}
                variant="planet"
                degree={card.degree}
                expandLabels={cardExpandLabels}
              />
            ))}
          </div>
        </Section>
      )}

      {analysisMode === "single" && aspectCards.length > 0 && (
        <Section icon="🔗" title={t.aspectsTitle} badge={t.aspectsBadge(aspectCards.length)} badgeAccent collapsible>
          <div className="cards-grid--aspects">
            {aspectCards.map((card) => (
              <Card
                key={`${resultVersion}-${card.key}`}
                title={card.title}
                subtitle={card.subtitle}
                text={card.text}
                tags={card.tags}
                details={card.details}
                variant="aspect"
                orb={card.orb}
                expandLabels={cardExpandLabels}
              />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
