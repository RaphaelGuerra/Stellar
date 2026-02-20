import { useEffect, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { Section } from "../components/Section";
import { runAstroWorkerTask } from "../lib/astroWorkerClient";
import { shiftIsoDate, parseIsoDate } from "../lib/dateUtils";
import type {
  AnnualProfectionResult,
  ReturnChartResult,
  SecondaryProgressionResult,
} from "../lib/engine";

export function TimingView() {
  const {
    chartA,
    chartSettings,
    timeTravelDate,
    setTimeTravelDate,
    handleTimeTravelShift,
    handleTimeTravelReset,
    isCarioca,
  } = useAppContext();

  const t = {
    timingTitle: isCarioca ? "Timing astrologico" : "Astrology timing",
    timingAsOf: isCarioca ? "Referencia" : "Reference date",
    timingProgressed: isCarioca ? "Progressao secundaria" : "Secondary progression",
    timingSolarReturn: isCarioca ? "Retorno solar (aniversario cosmico)" : "Solar return",
    timingLunarReturn: isCarioca ? "Retorno lunar" : "Lunar return",
    timingProfection: isCarioca ? "Profeccao anual" : "Annual profection",
    timingSaturnReturn: isCarioca ? "Retorno de Saturno (a porrada)" : "Saturn return tracker",
    timeTravelTitle: isCarioca ? "Viagem no tempo" : "Time travel date",
    timeTravelBack: isCarioca ? "-7 dias" : "-7 days",
    timeTravelForward: isCarioca ? "+7 dias" : "+7 days",
    timeTravelToday: isCarioca ? "Hoje" : "Today",
    settingsHouseSystem: isCarioca ? "Sistema de casas" : "House system",
    emptyState: isCarioca
      ? 'Aperta "Gerar mapa, porra!" pra ver o timing.'
      : 'Click "Generate chart" to see astrology timing.',
  };

  // View-local state
  const [progressed, setProgressed] = useState<SecondaryProgressionResult | null>(null);
  const [solarReturn, setSolarReturn] = useState<ReturnChartResult | null>(null);
  const [lunarReturn, setLunarReturn] = useState<ReturnChartResult | null>(null);
  const [profections, setProfections] = useState<AnnualProfectionResult | null>(null);
  const [saturnReturnHits, setSaturnReturnHits] = useState<Array<{ date: string; orb: number }> | null>(null);

  // Worker effect
  useEffect(() => {
    if (!chartA) {
      return;
    }
    let canceled = false;
    const anchorDate = parseIsoDate(timeTravelDate);
    const progressionDate = shiftIsoDate(timeTravelDate, 30);
    const lunarMonth = `${anchorDate.getUTCFullYear()}-${String(anchorDate.getUTCMonth() + 1).padStart(2, "0")}`;

    Promise.all([
      runAstroWorkerTask<SecondaryProgressionResult>({
        type: "generateSecondaryProgressions",
        baseChart: chartA,
        date: progressionDate,
        settings: chartSettings,
      }),
      runAstroWorkerTask<ReturnChartResult>({
        type: "generateSolarReturn",
        baseChart: chartA,
        year: anchorDate.getUTCFullYear(),
        settings: chartSettings,
      }),
      runAstroWorkerTask<ReturnChartResult>({
        type: "generateLunarReturn",
        baseChart: chartA,
        month: lunarMonth,
        settings: chartSettings,
      }),
      runAstroWorkerTask<AnnualProfectionResult>({
        type: "generateAnnualProfections",
        baseChart: chartA,
        date: timeTravelDate,
      }),
    ])
      .then(([nextProgressed, nextSolarReturn, nextLunarReturn, nextProfections]) => {
        if (canceled) return;
        setProgressed(nextProgressed);
        setSolarReturn(nextSolarReturn);
        setLunarReturn(nextLunarReturn);
        setProfections(nextProfections);
      })
      .catch(() => {
        if (canceled) return;
        setProgressed(null);
        setSolarReturn(null);
        setLunarReturn(null);
        setProfections(null);
      });

    runAstroWorkerTask<Array<{ date: string; orb: number }>>({
      type: "generateSaturnReturnTracker",
      baseChart: chartA,
      settings: chartSettings,
    })
      .then((nextSaturnHits) => {
        if (canceled) return;
        setSaturnReturnHits(nextSaturnHits);
      })
      .catch(() => {
        if (canceled) return;
        setSaturnReturnHits(null);
      });

    return () => { canceled = true; };
  }, [chartA, chartSettings, timeTravelDate]);

  if (!chartA) {
    return <p className="empty-state">{t.emptyState}</p>;
  }

  return (
    <Section icon="⏳" title={t.timingTitle} badge={`${chartSettings.houseSystem} · ${timeTravelDate}`} collapsible>
      <div className="timeline-controls" role="group" aria-label={t.timeTravelTitle}>
        <button type="button" className="timeline-controls__btn" onClick={() => handleTimeTravelShift(-7)}>
          {t.timeTravelBack}
        </button>
        <input
          type="date"
          value={timeTravelDate}
          onChange={(event) => setTimeTravelDate(event.target.value)}
        />
        <button type="button" className="timeline-controls__btn" onClick={handleTimeTravelReset}>
          {t.timeTravelToday}
        </button>
        <button type="button" className="timeline-controls__btn" onClick={() => handleTimeTravelShift(7)}>
          {t.timeTravelForward}
        </button>
      </div>
      <div className="timeline-meta">
        <p><strong>{t.timingAsOf}:</strong> {timeTravelDate}</p>
      </div>
      <div className="timeline-grid">
        {progressed && (
          <div className="timeline-day">
            <p className="timeline-day__date">{t.timingProgressed}</p>
            <p className="timeline-day__summary">{progressed.progressedDate}</p>
            <p className="timeline-day__summary">Age: {progressed.ageYears}</p>
          </div>
        )}
        {solarReturn && (
          <div className="timeline-day">
            <p className="timeline-day__date">{t.timingSolarReturn}</p>
            <p className="timeline-day__summary">{solarReturn.exactDateTimeUtc}</p>
          </div>
        )}
        {lunarReturn && (
          <div className="timeline-day">
            <p className="timeline-day__date">{t.timingLunarReturn}</p>
            <p className="timeline-day__summary">{lunarReturn.exactDateTimeUtc}</p>
          </div>
        )}
        {profections && (
          <div className="timeline-day">
            <p className="timeline-day__date">{t.timingProfection}</p>
            <p className="timeline-day__summary">Age {profections.age}</p>
            <p className="timeline-day__summary">House {profections.profectedHouse} · {profections.profectedSign}</p>
          </div>
        )}
        {saturnReturnHits && (
          <div className="timeline-day">
            <p className="timeline-day__date">{t.timingSaturnReturn}</p>
            <p className="timeline-day__summary">{saturnReturnHits.length} hits</p>
            {saturnReturnHits.slice(0, 3).map((hit) => (
              <p key={`${hit.date}-${hit.orb}`} className="timeline-day__summary">
                {hit.date} (orb {hit.orb.toFixed(1)}deg)
              </p>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
