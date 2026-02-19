import { useEffect, useMemo, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { Section } from "../components/Section";
import { Card } from "../components/Card";
import { runAstroWorkerTask } from "../lib/astroWorkerClient";
import { buildDailyTransitOutlook } from "../lib/transits";
import { buildCompatibilityForecast, type ForecastRange } from "../lib/phase5";
import { buildTransitThemes, groupExactHitsByDate } from "../lib/transits";
import { dayDistanceFrom, shiftIsoDate } from "../lib/dateUtils";
import type { TransitRangeResult } from "../lib/engine";
import { getDetailUnlockCount } from "../lib/progression";

const TRANSIT_PAGE_SIZE = 10;

export function TransitsView() {
  const {
    chartA,
    chartB,
    analysisMode,
    duoMode,
    chartSettings,
    timeTravelDate,
    setTimeTravelDate,
    handleTimeTravelShift,
    handleTimeTravelReset,
    transitDayPage,
    setTransitDayPage,
    selectedTransitDate,
    setSelectedTransitDate,
    remindersEnabled,
    setRemindersEnabled,
    reminderLeadDays,
    setReminderLeadDays,
    reminderMaxOrb,
    setReminderMaxOrb,
    lastReminderKey,
    setLastReminderKey,
    resultVersion,
    progression,
    isCarioca,
  } = useAppContext();

  const t = {
    transitsTitle: isCarioca ? "Feed de transitos" : "Transit feed",
    timeTravelTitle: isCarioca ? "Navegador de data" : "Time travel date",
    timeTravelBack: isCarioca ? "-7 dias" : "-7 days",
    timeTravelForward: isCarioca ? "+7 dias" : "+7 days",
    timeTravelToday: isCarioca ? "Hoje" : "Today",
    transitsExactHits: isCarioca ? "Aspectos exatos" : "Exact hits",
    transitsStrongest: isCarioca ? "Mais fortes do dia" : "Strongest today",
    transitsRangeToday: isCarioca ? "Hoje" : "Today",
    transitsRangeWeek: isCarioca ? "Semana" : "Week",
    transitsRangeMonth: isCarioca ? "Mes" : "Month",
    transitsPage: (page: number, total: number) =>
      isCarioca ? `Pagina ${page}/${total}` : `Page ${page}/${total}`,
    transitsPrev: isCarioca ? "Anterior" : "Prev",
    transitsNext: isCarioca ? "Proximo" : "Next",
    transitsSelectedDay: isCarioca ? "Dia selecionado" : "Selected day",
    transitsNoHitsDay: isCarioca ? "Sem hits relevantes nesse dia." : "No strong hits on this day.",
    transitsThemeShort: isCarioca ? "Temas de curto prazo" : "Short-term themes",
    transitsThemeLong: isCarioca ? "Temas de longo prazo" : "Long-term themes",
    transitsThemeCount: isCarioca ? "ocorrencias" : "occurrences",
    transitsExactCalendar: isCarioca ? "Calendario de exatos" : "Exact-hit calendar",
    transitsReminderTitle: isCarioca ? "Regras de lembrete local" : "Local reminder rules",
    transitsReminderLeadDays: isCarioca ? "Antecedencia" : "Lead time",
    transitsReminderOrb: isCarioca ? "Orb maximo" : "Max orb",
    transitsReminderStatus: isCarioca ? "Status de notificacao" : "Notification status",
    transitsReminderPermissionMissing: isCarioca ? "Notificacoes nao permitidas no navegador." : "Notifications are not allowed in this browser.",
    transitsReminderPermissionPrompt: isCarioca ? "Ativa o lembrete pra solicitar permissao." : "Enable reminders to request permission.",
    transitsReminderPermissionDenied: isCarioca ? "Permissao negada; o lembrete fica so no feed." : "Permission denied; reminders stay in-app only.",
    transitsReminderPermissionGranted: isCarioca ? "Permissao ativa; alertas locais habilitados." : "Permission granted; local alerts enabled.",
    transitsReminderUpcoming: isCarioca ? "Proximos alertas pela regra" : "Upcoming rule matches",
    emptyState: isCarioca
      ? 'Clica em "Gerar mapa, porra" pra ver os transitos.'
      : 'Click "Generate chart" to see your transits.',
    todayForUsTitle:
      duoMode === "friend"
        ? isCarioca ? "Hoje pra amizade" : "Today for Friends"
        : isCarioca ? "Hoje pra dupla" : "Today for Us",
    todayForUsBadge: isCarioca ? "transitos ativos" : "live transits",
    forecastTitle: isCarioca ? "Timeline de compatibilidade" : "Compatibility timeline",
    forecastBadge: (days: number) => isCarioca ? `proximos ${days} dias` : `next ${days} days`,
    forecastBest: isCarioca ? "Melhor janela" : "Best window",
    forecastTough: isCarioca ? "Dia mais sensivel" : "Toughest day",
    forecastVibe: isCarioca ? "Vibe" : "Vibe",
    forecastRisk: isCarioca ? "Risco" : "Risk",
  };

  const cardExpandLabels = isCarioca
    ? { more: "Abrir mais", less: "Fechar" }
    : { more: "Show more", less: "Show less" };

  const unlockedDetailCount = useMemo(
    () => getDetailUnlockCount(progression.xp),
    [progression.xp]
  );

  // View-local state
  const [transitRange, setTransitRange] = useState<1 | 7 | 30>(7);
  const [transitFeed, setTransitFeed] = useState<TransitRangeResult | null>(null);
  const [forecastRange, setForecastRange] = useState<ForecastRange>(7);

  // Worker effect for transit data
  useEffect(() => {
    if (!chartA) {
      setTransitFeed(null);
      return;
    }
    let canceled = false;
    const start = timeTravelDate;
    const end = shiftIsoDate(timeTravelDate, transitRange - 1);
    runAstroWorkerTask<TransitRangeResult>({
      type: "generateTransits",
      baseChart: chartA,
      range: { from: start, to: end },
      settings: chartSettings,
    })
      .then((nextTransitFeed) => {
        if (canceled) return;
        setTransitFeed(nextTransitFeed);
      })
      .catch(() => {
        if (canceled) return;
        setTransitFeed(null);
      });
    return () => { canceled = true; };
  }, [chartA, chartSettings, timeTravelDate, transitRange]);

  // Sync transit day page when feed changes
  useEffect(() => {
    if (!transitFeed || transitFeed.days.length === 0) {
      if (selectedTransitDate !== "") setSelectedTransitDate("");
      if (transitDayPage !== 0) setTransitDayPage(0);
      return;
    }
    const maxPage = Math.max(0, Math.ceil(transitFeed.days.length / TRANSIT_PAGE_SIZE) - 1);
    if (transitDayPage > maxPage) {
      setTransitDayPage(maxPage);
      return;
    }
    const selectedIndex = transitFeed.days.findIndex((day) => day.date === selectedTransitDate);
    if (selectedIndex === -1) {
      setSelectedTransitDate(transitFeed.days[0].date);
      return;
    }
    const selectedPage = Math.floor(selectedIndex / TRANSIT_PAGE_SIZE);
    if (selectedPage !== transitDayPage) {
      setTransitDayPage(selectedPage);
    }
  }, [selectedTransitDate, transitDayPage, transitFeed, setSelectedTransitDate, setTransitDayPage]);

  // Reminder effects
  useEffect(() => {
    if (!remindersEnabled) return;
    if (typeof window === "undefined" || typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;
    void Notification.requestPermission().catch(() => undefined);
  }, [remindersEnabled]);

  // Local memos
  const dailyOutlook = useMemo(() => {
    if (analysisMode !== "compatibility" || !chartA || !chartB) return null;
    return buildDailyTransitOutlook(chartA, chartB, {
      locale: isCarioca ? "pt" : "en",
      duoMode,
    });
  }, [analysisMode, chartA, chartB, duoMode, isCarioca]);

  const compatibilityForecast = useMemo(() => {
    if (analysisMode !== "compatibility" || !chartA || !chartB) return null;
    return buildCompatibilityForecast(chartA, chartB, forecastRange, {
      locale: isCarioca ? "pt" : "en",
      duoMode,
      timeZone: chartA.normalized.timezone,
    });
  }, [analysisMode, chartA, chartB, duoMode, forecastRange, isCarioca]);

  const transitPageCount = useMemo(() => {
    if (!transitFeed || transitFeed.days.length === 0) return 1;
    return Math.max(1, Math.ceil(transitFeed.days.length / TRANSIT_PAGE_SIZE));
  }, [transitFeed]);

  const pagedTransitDays = useMemo(() => {
    if (!transitFeed) return [];
    const safePage = Math.max(0, Math.min(transitDayPage, transitPageCount - 1));
    const start = safePage * TRANSIT_PAGE_SIZE;
    return transitFeed.days.slice(start, start + TRANSIT_PAGE_SIZE);
  }, [transitDayPage, transitFeed, transitPageCount]);

  const selectedTransitDay = useMemo(() => {
    if (!transitFeed || transitFeed.days.length === 0) return null;
    const exact = transitFeed.days.find((day) => day.date === selectedTransitDate);
    return exact ?? pagedTransitDays[0] ?? transitFeed.days[0] ?? null;
  }, [pagedTransitDays, selectedTransitDate, transitFeed]);

  const selectedTransitExactHits = useMemo(() => {
    if (!transitFeed || !selectedTransitDay) return [];
    return transitFeed.exactHits.filter((hit) => hit.date === selectedTransitDay.date);
  }, [selectedTransitDay, transitFeed]);

  const transitShortThemes = useMemo(
    () => buildTransitThemes(transitFeed, 3, isCarioca),
    [isCarioca, transitFeed]
  );

  const transitLongThemes = useMemo(
    () => buildTransitThemes(transitFeed, transitRange === 1 ? 1 : transitRange === 7 ? 7 : 30, isCarioca),
    [isCarioca, transitFeed, transitRange]
  );

  const transitExactHitCalendar = useMemo(
    () => groupExactHitsByDate(transitFeed),
    [transitFeed]
  );

  const upcomingReminderHits = useMemo(() => {
    if (!transitFeed) return [];
    return transitFeed.exactHits.filter((hit) => {
      if (hit.orb > reminderMaxOrb) return false;
      const deltaDays = dayDistanceFrom(timeTravelDate, hit.date);
      return Number.isFinite(deltaDays) && deltaDays >= 0 && deltaDays <= reminderLeadDays;
    });
  }, [reminderLeadDays, reminderMaxOrb, timeTravelDate, transitFeed]);

  // Reminder send effect
  useEffect(() => {
    if (!remindersEnabled || upcomingReminderHits.length === 0) return;
    const next = upcomingReminderHits[0];
    const reminderKey = [
      timeTravelDate,
      next.date,
      next.transitPlanet,
      next.aspect,
      next.natalPlanet,
      reminderLeadDays,
      reminderMaxOrb.toFixed(1),
    ].join("|");
    if (reminderKey === lastReminderKey) return;
    if (typeof window !== "undefined" && typeof Notification !== "undefined" && Notification.permission === "granted") {
      const title = isCarioca ? "Lembrete de transito" : "Transit reminder";
      const body = `${next.date}: ${next.transitPlanet} ${next.aspect} ${next.natalPlanet} (orb ${next.orb.toFixed(1)}deg)`;
      new Notification(title, { body });
    }
    setLastReminderKey(reminderKey);
  }, [
    isCarioca,
    lastReminderKey,
    reminderLeadDays,
    reminderMaxOrb,
    remindersEnabled,
    setLastReminderKey,
    timeTravelDate,
    upcomingReminderHits,
  ]);

  const notificationStatus =
    typeof window === "undefined" || typeof Notification === "undefined"
      ? t.transitsReminderPermissionMissing
      : Notification.permission === "granted"
        ? t.transitsReminderPermissionGranted
        : Notification.permission === "denied"
          ? t.transitsReminderPermissionDenied
          : t.transitsReminderPermissionPrompt;

  if (!chartA) {
    return <p className="empty-state">{t.emptyState}</p>;
  }

  return (
    <>
      {analysisMode === "compatibility" && dailyOutlook && (
        <Section icon="📆" title={t.todayForUsTitle} badge={`${t.todayForUsBadge} · ${dailyOutlook.dateLabel}`} collapsible>
          <div className="cards-grid--today">
            <Card
              key={`${resultVersion}-${dailyOutlook.opportunity.key}`}
              title={dailyOutlook.opportunity.title}
              subtitle={dailyOutlook.opportunity.subtitle}
              text={dailyOutlook.opportunity.text}
              tags={dailyOutlook.opportunity.tags}
              details={dailyOutlook.opportunity.details.slice(0, unlockedDetailCount)}
              tone={dailyOutlook.opportunity.tone}
              variant="synastry"
              orb={dailyOutlook.opportunity.orb}
              expandLabels={cardExpandLabels}
            />
            <Card
              key={`${resultVersion}-${dailyOutlook.watchout.key}`}
              title={dailyOutlook.watchout.title}
              subtitle={dailyOutlook.watchout.subtitle}
              text={dailyOutlook.watchout.text}
              tags={dailyOutlook.watchout.tags}
              details={dailyOutlook.watchout.details.slice(0, unlockedDetailCount)}
              tone={dailyOutlook.watchout.tone}
              variant="synastry"
              orb={dailyOutlook.watchout.orb}
              expandLabels={cardExpandLabels}
            />
          </div>
        </Section>
      )}

      {analysisMode === "compatibility" && compatibilityForecast && (
        <Section icon="🗓️" title={t.forecastTitle} badge={t.forecastBadge(forecastRange)} collapsible>
          <div className="timeline-controls" role="group" aria-label={t.forecastTitle}>
            <button
              type="button"
              className={`timeline-controls__btn ${forecastRange === 7 ? "timeline-controls__btn--active" : ""}`}
              onClick={() => setForecastRange(7)}
            >
              7d
            </button>
            <button
              type="button"
              className={`timeline-controls__btn ${forecastRange === 14 ? "timeline-controls__btn--active" : ""}`}
              onClick={() => setForecastRange(14)}
            >
              14d
            </button>
          </div>
          <div className="timeline-meta">
            <p><strong>{t.forecastBest}:</strong> {compatibilityForecast.bestDay.dateLabel}</p>
            <p><strong>{t.forecastTough}:</strong> {compatibilityForecast.toughestDay.dateLabel}</p>
          </div>
          <div className="timeline-grid">
            {compatibilityForecast.days.map((day) => (
              <div key={day.dayKey} className="timeline-day">
                <p className="timeline-day__date">{day.dateLabel}</p>
                <p className="timeline-day__score">{t.forecastVibe}: {day.vibeScore}%</p>
                <p className="timeline-day__score">{t.forecastRisk}: {day.riskScore}%</p>
                <p className="timeline-day__summary">{day.summary}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {transitFeed && (
        <Section icon="🌗" title={t.transitsTitle} badge={`${transitRange}d · ${timeTravelDate}`} collapsible>
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
          <div className="timeline-controls" role="group" aria-label={t.transitsTitle}>
            <button
              type="button"
              className={`timeline-controls__btn ${transitRange === 1 ? "timeline-controls__btn--active" : ""}`}
              onClick={() => { setTransitRange(1); setTransitDayPage(0); }}
            >
              {t.transitsRangeToday}
            </button>
            <button
              type="button"
              className={`timeline-controls__btn ${transitRange === 7 ? "timeline-controls__btn--active" : ""}`}
              onClick={() => { setTransitRange(7); setTransitDayPage(0); }}
            >
              {t.transitsRangeWeek}
            </button>
            <button
              type="button"
              className={`timeline-controls__btn ${transitRange === 30 ? "timeline-controls__btn--active" : ""}`}
              onClick={() => { setTransitRange(30); setTransitDayPage(0); }}
            >
              {t.transitsRangeMonth}
            </button>
            <button
              type="button"
              className="timeline-controls__btn"
              disabled={transitDayPage <= 0}
              onClick={() => setTransitDayPage((page) => Math.max(0, page - 1))}
            >
              {t.transitsPrev}
            </button>
            <span className="timeline-day__summary">
              {t.transitsPage(Math.min(transitDayPage + 1, transitPageCount), transitPageCount)}
            </span>
            <button
              type="button"
              className="timeline-controls__btn"
              disabled={transitDayPage >= transitPageCount - 1}
              onClick={() => setTransitDayPage((page) => Math.min(transitPageCount - 1, page + 1))}
            >
              {t.transitsNext}
            </button>
          </div>
          <div className="timeline-meta">
            <p><strong>{t.transitsExactHits}:</strong> {transitFeed.exactHits.length}</p>
            <p><strong>{t.transitsSelectedDay}:</strong> {selectedTransitDay?.date ?? "--"}</p>
            <p><strong>{t.transitsThemeShort}:</strong> {transitShortThemes.length}</p>
            <p><strong>{t.transitsThemeLong}:</strong> {transitLongThemes.length}</p>
          </div>
          <div className="timeline-grid">
            {pagedTransitDays.map((day) => (
              <div key={day.date} className="timeline-day">
                <button
                  type="button"
                  className={`timeline-controls__btn ${selectedTransitDay?.date === day.date ? "timeline-controls__btn--active" : ""}`}
                  onClick={() => setSelectedTransitDate(day.date)}
                >
                  {day.date}
                </button>
                <p className="timeline-day__summary">{t.transitsStrongest}</p>
                {day.strongestHits.slice(0, 3).map((hit) => (
                  <p key={`${day.date}-${hit.transitPlanet}-${hit.natalPlanet}-${hit.aspect}`} className="timeline-day__summary">
                    {hit.transitPlanet} {hit.aspect} {hit.natalPlanet} (orb {hit.orb.toFixed(1)}deg)
                  </p>
                ))}
              </div>
            ))}
          </div>
          <div className="timeline-grid">
            <div className="timeline-day">
              <p className="timeline-day__date">{selectedTransitDay?.date ?? "--"}</p>
              {selectedTransitDay?.strongestHits.length ? (
                selectedTransitDay.strongestHits.map((hit) => (
                  <p key={`${selectedTransitDay.date}-detail-${hit.transitPlanet}-${hit.aspect}-${hit.natalPlanet}`} className="timeline-day__summary">
                    {hit.transitPlanet} {hit.aspect} {hit.natalPlanet} (orb {hit.orb.toFixed(1)}deg)
                  </p>
                ))
              ) : (
                <p className="timeline-day__summary">{t.transitsNoHitsDay}</p>
              )}
              {selectedTransitExactHits.length > 0 && (
                <>
                  <p className="timeline-day__summary"><strong>{t.transitsExactHits}:</strong> {selectedTransitExactHits.length}</p>
                  {selectedTransitExactHits.slice(0, 5).map((hit) => (
                    <p key={`exact-${hit.date}-${hit.transitPlanet}-${hit.aspect}-${hit.natalPlanet}`} className="timeline-day__summary">
                      {hit.transitPlanet} {hit.aspect} {hit.natalPlanet} (orb {hit.orb.toFixed(1)}deg)
                    </p>
                  ))}
                </>
              )}
            </div>
            <div className="timeline-day">
              <p className="timeline-day__date">{t.transitsThemeShort}</p>
              {transitShortThemes.length === 0 ? (
                <p className="timeline-day__summary">{t.transitsNoHitsDay}</p>
              ) : (
                transitShortThemes.map((theme) => (
                  <p key={`short-theme-${theme.key}`} className="timeline-day__summary">
                    {theme.label} ({theme.count} {t.transitsThemeCount}, orb {theme.bestOrb.toFixed(1)}deg)
                  </p>
                ))
              )}
              <p className="timeline-day__date">{t.transitsThemeLong}</p>
              {transitLongThemes.length === 0 ? (
                <p className="timeline-day__summary">{t.transitsNoHitsDay}</p>
              ) : (
                transitLongThemes.map((theme) => (
                  <p key={`long-theme-${theme.key}`} className="timeline-day__summary">
                    {theme.label} ({theme.count} {t.transitsThemeCount}, orb {theme.bestOrb.toFixed(1)}deg)
                  </p>
                ))
              )}
            </div>
            <div className="timeline-day">
              <p className="timeline-day__date">{t.transitsExactCalendar}</p>
              {transitExactHitCalendar.length === 0 ? (
                <p className="timeline-day__summary">{t.transitsNoHitsDay}</p>
              ) : (
                transitExactHitCalendar.slice(0, 10).map((entry) => (
                  <p key={`calendar-${entry.date}`} className="timeline-day__summary">
                    {entry.date}: {entry.hits.length} hits
                  </p>
                ))
              )}
            </div>
            <div className="timeline-day">
              <p className="timeline-day__date">{t.transitsReminderTitle}</p>
              <label className="privacy-controls__toggle">
                <input
                  type="checkbox"
                  checked={remindersEnabled}
                  onChange={(event) => setRemindersEnabled(event.target.checked)}
                />
                <span>{t.transitsReminderTitle}</span>
              </label>
              <label className="privacy-controls__toggle">
                <span>{t.transitsReminderLeadDays}</span>
                <select
                  value={reminderLeadDays}
                  onChange={(event) => setReminderLeadDays(Number(event.target.value))}
                >
                  <option value={0}>0d</option>
                  <option value={1}>1d</option>
                  <option value={2}>2d</option>
                  <option value={3}>3d</option>
                </select>
              </label>
              <label className="privacy-controls__toggle">
                <span>{t.transitsReminderOrb}</span>
                <select
                  value={reminderMaxOrb}
                  onChange={(event) => setReminderMaxOrb(Number(event.target.value))}
                >
                  <option value={0.3}>0.3deg</option>
                  <option value={0.5}>0.5deg</option>
                  <option value={1}>1.0deg</option>
                </select>
              </label>
              <p className="timeline-day__summary"><strong>{t.transitsReminderStatus}:</strong> {notificationStatus}</p>
              <p className="timeline-day__summary"><strong>{t.transitsReminderUpcoming}:</strong> {upcomingReminderHits.length}</p>
              {upcomingReminderHits.slice(0, 3).map((hit) => (
                <p key={`reminder-${hit.date}-${hit.transitPlanet}-${hit.aspect}-${hit.natalPlanet}`} className="timeline-day__summary">
                  {hit.date}: {hit.transitPlanet} {hit.aspect} {hit.natalPlanet} (orb {hit.orb.toFixed(1)}deg)
                </p>
              ))}
            </div>
          </div>
        </Section>
      )}
    </>
  );
}
