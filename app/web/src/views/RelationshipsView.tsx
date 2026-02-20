import { useEffect, useMemo, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { Section } from "../components/Section";
import { Card } from "../components/Card";
import { MatchScorecards } from "../components/MatchScorecards";
import { runAstroWorkerTask } from "../lib/astroWorkerClient";
import { buildMatchScorecards } from "../lib/matchScorecards";
import { buildAdvancedOverlaySummary } from "../lib/phase5";
import {
  ADVANCED_OVERLAYS_UNLOCK_MISSIONS,
  getAdvancedOverlaysUnlockMissionCount,
  getDetailUnlockCountByMissions,
  getMissionCompletionCount,
  getNextDetailUnlockMissionCount,
  hasCompletedMissionDay,
  hasReflectedMissionDay,
  isAdvancedOverlaysUnlockedByMissions,
  buildRelationshipQuest,
} from "../lib/progression";
import { shiftIsoDate } from "../lib/dateUtils";
import type { ChartResult, MatchScorecardArea } from "../lib/types";
import type { TransitRangeResult } from "../lib/engine";

const TRANSIT_PAGE_SIZE = 10;

export function RelationshipsView() {
  const {
    chartA,
    chartB,
    duoMode,
    isCarioca,
    chartSettings,
    timeTravelDate,
    comparison,
    progression,
    resultVersion,
    analysisMode,
    handleQuestReflection,
  } = useAppContext();

  const t = {
    matchScorecardsTitle: isCarioca ? "Resumo do match" : "Best and worst match summary",
    matchScorecardsBadge: isCarioca ? "amor, amizade, familia, sol x sol" : "love, friendship, family, sun x sun",
    matchAreaLove: duoMode === "friend" ? (isCarioca ? "Vibe" : "Bond") : isCarioca ? "Amor" : "Love",
    matchAreaFriends: isCarioca ? "Amizade" : "Friendship",
    matchAreaFamily: isCarioca ? "Familia" : "Family",
    matchAreaSun: isCarioca ? "Sol x Sol" : "Sun x Sun",
    matchSupportLabel: isCarioca ? "Ponto forte, maluco" : "Best support",
    matchTensionLabel: isCarioca ? "Onde pega, cuidado" : "Biggest tension",
    matchAspectEmpty: isCarioca ? "Nenhum aspecto dominante" : "No dominant aspect",
    compatibilityTitle: isCarioca ? "Sinastria" : "Synastry",
    compatibilityBadge: (n: number) => isCarioca ? `${n} aspectos brabos` : `${n} aspects`,
    compatibilityEmpty: isCarioca
      ? 'Aperta "Gerar mapa, porra!" pra ver a quimica entre voces.'
      : 'Click "Generate chart" to see aspects between Person A and Person B.',
    compatibilityStatsTitle:
      duoMode === "friend"
        ? isCarioca ? "Stats da parceria" : "Friendship stats"
        : isCarioca ? "Stats da relacao" : "Relationship stats",
    compatibilityStatsBadge: isCarioca ? "modo RPG, caralho" : "RPG mode",
    questTitle:
      duoMode === "friend"
        ? isCarioca ? "Missao da parceria" : "Friendship quest"
        : isCarioca ? "Missao da dupla" : "Relationship quest",
    questBadge: (label: string) => isCarioca ? `foco em ${label}` : `${label} focus`,
    questStatusLabel: isCarioca ? "Status de hoje" : "Today's mission",
    questStatusDone: isCarioca ? "Concluida hoje" : "Completed today",
    questStatusPending: isCarioca ? "Pendente hoje" : "Not completed today",
    questCompletedMissionsLabel: isCarioca ? "Missoes concluidas" : "Completed missions",
    questStreakLabel: isCarioca ? "Sequencia" : "Streak",
    questUnlockLabel: (count: number) =>
      isCarioca ? `Destravou ${count}/4 blocos` : `Unlocked detail blocks: ${count}/4`,
    questNextUnlockLabel: (target: number, remaining: number) =>
      isCarioca
        ? `${remaining} missao(oes) pra liberar ${target} missoes`
        : `${remaining} mission(s) to unlock at ${target} missions`,
    questReflect: isCarioca ? "Refletir (+insight bonus)" : "Log reflection (+bonus insight)",
    questReflected: isCarioca ? "Reflexao bonus salva" : "Reflection bonus claimed",
    questVaultTitle: isCarioca ? "Insights destravados" : "Unlocked insights",
    questVaultEmpty: isCarioca
      ? "Gera o mapa de compatibilidade pra destravar o primeiro insight."
      : "Generate a compatibility chart to unlock your first insight.",
    questInsightSourceMission: isCarioca ? "missao" : "mission",
    questInsightSourceReflection: isCarioca ? "reflexao" : "reflection",
    advancedTitle: isCarioca ? "Overlays avancados" : "Advanced overlays",
    advancedBadge: isCarioca ? "composite + midpoints" : "composite + midpoints",
    advancedLocked: isCarioca
      ? `Trancado! Precisa de ${ADVANCED_OVERLAYS_UNLOCK_MISSIONS} missoes concluidas pra abrir`
      : `Unlocks at ${ADVANCED_OVERLAYS_UNLOCK_MISSIONS} completed missions`,
    advancedLockedHint: (target: number, currentCount: number) =>
      isCarioca
        ? `Faltam ${Math.max(0, target - currentCount)} missao(oes).`
        : `${Math.max(0, target - currentCount)} mission(s) to unlock.`,
    advancedCompositeTitle: isCarioca ? "Core do composite" : "Composite core",
    advancedMidpointTitle: isCarioca ? "Midpoints principais" : "Key midpoints",
    relationshipsComposite: isCarioca ? "Mapa composto" : "Composite chart",
    relationshipsDavison: isCarioca ? "Mapa Davison" : "Davison chart",
    relationshipsTransitTimeline: isCarioca ? "Timeline da relacao" : "Relationship transit timeline",
    relationshipsTransitExact: isCarioca ? "Hits exatos da relacao" : "Relationship exact hits",
    relationshipsTransitSelectedDay: isCarioca ? "O dia de voces" : "Relationship day",
    relationshipsTransitNoHits: isCarioca ? "Nada forte nesse dia, de boa." : "No relationship hits on this day.",
    transitsPrev: isCarioca ? "Anterior" : "Prev",
    transitsNext: isCarioca ? "Proximo" : "Next",
    transitsPage: (page: number, total: number) =>
      isCarioca ? `${page} de ${total}` : `Page ${page}/${total}`,
    emptyModeHint: isCarioca
      ? "Muda pra Sinastria braba la em cima pra desbloquear relacoes, mermao."
      : "Switch to Compatibility mode to use Relationships.",
  };

  const cardExpandLabels = isCarioca
    ? { more: "Ver mais", less: "Fecha ai" }
    : { more: "Show more", less: "Show less" };

  const matchAreaLabels: Record<MatchScorecardArea, string> = {
    love: t.matchAreaLove,
    friends: t.matchAreaFriends,
    family: t.matchAreaFamily,
    sun: t.matchAreaSun,
  };

  // View-local state
  const [compositeChart, setCompositeChart] = useState<ChartResult | null>(null);
  const [davisonChart, setDavisonChart] = useState<ChartResult | null>(null);
  const [relationshipTransitFeed, setRelationshipTransitFeed] = useState<TransitRangeResult | null>(null);
  const [relationshipTransitDayPage, setRelationshipTransitDayPage] = useState(0);
  const [selectedRelationshipTransitDate, setSelectedRelationshipTransitDate] = useState("");

  // Worker effect: composite + davison
  useEffect(() => {
    if (analysisMode !== "compatibility" || !chartA || !chartB) {
      return;
    }
    let canceled = false;
    Promise.all([
      runAstroWorkerTask<ChartResult>({
        type: "generateComposite",
        chartA,
        chartB,
        method: "midpoint",
        settings: chartSettings,
      }),
      runAstroWorkerTask<ChartResult>({
        type: "generateComposite",
        chartA,
        chartB,
        method: "davison",
        settings: chartSettings,
      }),
    ])
      .then(([midpoint, davison]) => {
        if (canceled) return;
        setCompositeChart(midpoint);
        setDavisonChart(davison);
      })
      .catch(() => {
        if (canceled) return;
        setCompositeChart(null);
        setDavisonChart(null);
      });
    return () => { canceled = true; };
  }, [analysisMode, chartA, chartB, chartSettings]);

  // Worker effect: relationship transits
  useEffect(() => {
    if (analysisMode !== "compatibility" || !compositeChart) {
      return;
    }
    let canceled = false;
    const start = timeTravelDate;
    const end = shiftIsoDate(timeTravelDate, 29);
    runAstroWorkerTask<TransitRangeResult>({
      type: "generateTransits",
      baseChart: compositeChart,
      range: { from: start, to: end },
      settings: chartSettings,
    })
      .then((nextFeed) => {
        if (canceled) return;
        setRelationshipTransitFeed(nextFeed);
      })
      .catch(() => {
        if (canceled) return;
        setRelationshipTransitFeed(null);
      });
    return () => { canceled = true; };
  }, [analysisMode, chartSettings, compositeChart, timeTravelDate]);

  // Local memos
  const matchScorecards = useMemo(() => {
    if (analysisMode !== "compatibility" || !comparison) return [];
    return buildMatchScorecards(comparison, isCarioca ? "pt" : "en", duoMode);
  }, [analysisMode, comparison, duoMode, isCarioca]);

  const completedMissionCount = useMemo(
    () => getMissionCompletionCount(progression),
    [progression]
  );
  const unlockedDetailCount = useMemo(
    () => getDetailUnlockCountByMissions(completedMissionCount),
    [completedMissionCount]
  );
  const nextDetailUnlockMissionCount = useMemo(
    () => getNextDetailUnlockMissionCount(completedMissionCount),
    [completedMissionCount]
  );

  const relationshipQuest = useMemo(() => {
    if (analysisMode !== "compatibility" || !comparison || !chartA) return null;
    return buildRelationshipQuest(comparison, {
      locale: isCarioca ? "pt" : "en",
      duoMode,
      timeZone: chartA.normalized.timezone,
    });
  }, [analysisMode, chartA, comparison, duoMode, isCarioca]);

  const advancedOverlays = useMemo(() => {
    if (analysisMode !== "compatibility" || !chartA || !chartB) return null;
    return buildAdvancedOverlaySummary(chartA, chartB, isCarioca ? "pt" : "en");
  }, [analysisMode, chartA, chartB, isCarioca]);

  const comparisonCards = useMemo(() => {
    if (!comparison) return [];
    return comparison.highlights.map((highlight) => ({
      key: highlight.key,
      title: highlight.title,
      subtitle: highlight.subtitle,
      text: highlight.text,
      tags: highlight.tags,
      details: highlight.details ? highlight.details.slice(0, unlockedDetailCount) : undefined,
      tone: highlight.tone,
      orb: highlight.related?.aspect?.orb,
    }));
  }, [comparison, unlockedDetailCount]);

  const advancedUnlocked = isAdvancedOverlaysUnlockedByMissions(completedMissionCount);
  const advancedUnlockTarget = getAdvancedOverlaysUnlockMissionCount(completedMissionCount);

  const questCompleted = relationshipQuest
    ? hasCompletedMissionDay(progression, relationshipQuest.dayKey)
    : false;
  const questReflected = relationshipQuest
    ? hasReflectedMissionDay(progression, relationshipQuest.dayKey)
    : false;

  const relationshipTransitPageCount = useMemo(() => {
    if (!relationshipTransitFeed || relationshipTransitFeed.days.length === 0) return 1;
    return Math.max(1, Math.ceil(relationshipTransitFeed.days.length / TRANSIT_PAGE_SIZE));
  }, [relationshipTransitFeed]);

  const safeRelationshipTransitDayPage = useMemo(() => {
    return Math.max(0, Math.min(relationshipTransitDayPage, relationshipTransitPageCount - 1));
  }, [relationshipTransitDayPage, relationshipTransitPageCount]);

  const pagedRelationshipTransitDays = useMemo(() => {
    if (!relationshipTransitFeed) return [];
    const start = safeRelationshipTransitDayPage * TRANSIT_PAGE_SIZE;
    return relationshipTransitFeed.days.slice(start, start + TRANSIT_PAGE_SIZE);
  }, [relationshipTransitFeed, safeRelationshipTransitDayPage]);

  const selectedRelationshipTransitDay = useMemo(() => {
    if (!relationshipTransitFeed || relationshipTransitFeed.days.length === 0) return null;
    const exact = relationshipTransitFeed.days.find((day) => day.date === selectedRelationshipTransitDate);
    return exact ?? pagedRelationshipTransitDays[0] ?? relationshipTransitFeed.days[0] ?? null;
  }, [pagedRelationshipTransitDays, relationshipTransitFeed, selectedRelationshipTransitDate]);

  const selectedRelationshipExactHits = useMemo(() => {
    if (!relationshipTransitFeed || !selectedRelationshipTransitDay) return [];
    return relationshipTransitFeed.exactHits.filter((hit) => hit.date === selectedRelationshipTransitDay.date);
  }, [relationshipTransitFeed, selectedRelationshipTransitDay]);

  if (analysisMode !== "compatibility") {
    return <p className="empty-state">{t.emptyModeHint}</p>;
  }

  if (!comparison) {
    return <p className="empty-state">{t.compatibilityEmpty}</p>;
  }

  return (
    <>
      {matchScorecards.length > 0 && (
        <Section icon="⚖️" title={t.matchScorecardsTitle} badge={t.matchScorecardsBadge} collapsible>
          <MatchScorecards
            cards={matchScorecards}
            areaLabels={matchAreaLabels}
            supportLabel={t.matchSupportLabel}
            tensionLabel={t.matchTensionLabel}
            emptyAspectLabel={t.matchAspectEmpty}
          />
        </Section>
      )}

      {comparison.stats.length > 0 && (
        <Section icon="🎮" title={t.compatibilityStatsTitle} badge={t.compatibilityStatsBadge} collapsible>
          <div className={`synastry-stats${duoMode === "romantic" ? " synastry-stats--romantic" : ""}`}>
            {comparison.stats.map((stat) => (
              <div key={stat.key} className="synastry-stats__item">
                <div className="synastry-stats__head">
                  <h3 className="synastry-stats__label">{stat.label}</h3>
                  <span className="synastry-stats__value">{stat.score}%</span>
                </div>
                <p className="synastry-stats__summary">{stat.summary}</p>
                <div className="synastry-stats__track" aria-hidden="true">
                  <div
                    className={`synastry-stats__bar synastry-stats__bar--${stat.key}`}
                    style={{ width: `${stat.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {relationshipQuest && (
        <Section icon="🎯" title={t.questTitle} badge={t.questBadge(relationshipQuest.focusStatLabel)} collapsible>
          <div className="quest-panel">
            <div className="quest-panel__stats">
              <p>{t.questStatusLabel}: {questCompleted ? t.questStatusDone : t.questStatusPending}</p>
              <p>{t.questCompletedMissionsLabel}: {completedMissionCount}</p>
              <p>{t.questStreakLabel}: {progression.streak}</p>
              <p>{t.questUnlockLabel(unlockedDetailCount)}</p>
              {nextDetailUnlockMissionCount != null && (
                <p>
                  {t.questNextUnlockLabel(
                    nextDetailUnlockMissionCount,
                    Math.max(0, nextDetailUnlockMissionCount - completedMissionCount)
                  )}
                </p>
              )}
            </div>
            <div className="quest-panel__actions">
              <button
                type="button"
                className="quest-action"
                onClick={() => handleQuestReflection(relationshipQuest)}
                disabled={!questCompleted || questReflected}
              >
                {questReflected ? t.questReflected : t.questReflect}
              </button>
            </div>
          </div>
          <div className="cards-grid--quest">
            <Card
              key={`${resultVersion}-${relationshipQuest.id}`}
              title={relationshipQuest.title}
              subtitle={relationshipQuest.subtitle}
              text={relationshipQuest.text}
              tags={relationshipQuest.tags}
              details={relationshipQuest.details.slice(0, unlockedDetailCount)}
              tone={relationshipQuest.tone}
              variant="synastry"
              orb={relationshipQuest.sourceAspect.orb}
              expandLabels={cardExpandLabels}
            />
          </div>
          <div className="quest-insights">
            <p className="quest-insights__title">{t.questVaultTitle}</p>
            {progression.unlockedInsights.length === 0 && (
              <p className="quest-insights__empty">{t.questVaultEmpty}</p>
            )}
            {progression.unlockedInsights.length > 0 && (
              <div className="quest-insights__list">
                {progression.unlockedInsights.slice(0, 6).map((insight) => (
                  <article key={insight.id} className="quest-insights__item">
                    <p className="quest-insights__meta">
                      {insight.dayKey} · {insight.source === "mission" ? t.questInsightSourceMission : t.questInsightSourceReflection}
                    </p>
                    <p className="quest-insights__item-title">{insight.title}</p>
                    <p className="quest-insights__text">{insight.text}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </Section>
      )}

      {(compositeChart || davisonChart) && (
        <Section icon="🧩" title={t.relationshipsComposite} badge="midpoint + davison" collapsible defaultOpen={false}>
          <div className="timeline-grid">
            {compositeChart && (
              <div className="timeline-day">
                <p className="timeline-day__date">{t.relationshipsComposite}</p>
                <p className="timeline-day__summary">{compositeChart.normalized.utcDateTime}</p>
                <p className="timeline-day__summary">{compositeChart.meta.engine}</p>
              </div>
            )}
            {davisonChart && (
              <div className="timeline-day">
                <p className="timeline-day__date">{t.relationshipsDavison}</p>
                <p className="timeline-day__summary">{davisonChart.normalized.utcDateTime}</p>
                <p className="timeline-day__summary">{davisonChart.meta.engine}</p>
              </div>
            )}
          </div>
        </Section>
      )}

      {relationshipTransitFeed && (
        <Section icon="🌠" title={t.relationshipsTransitTimeline} badge={`30d · ${timeTravelDate}`} collapsible defaultOpen={false}>
          <div className="timeline-controls" role="group" aria-label={t.relationshipsTransitTimeline}>
            <button
              type="button"
              className="timeline-controls__btn"
              disabled={safeRelationshipTransitDayPage <= 0}
              onClick={() => setRelationshipTransitDayPage(Math.max(0, safeRelationshipTransitDayPage - 1))}
            >
              {t.transitsPrev}
            </button>
            <span className="timeline-day__summary">
              {t.transitsPage(
                Math.min(safeRelationshipTransitDayPage + 1, relationshipTransitPageCount),
                relationshipTransitPageCount
              )}
            </span>
            <button
              type="button"
              className="timeline-controls__btn"
              disabled={safeRelationshipTransitDayPage >= relationshipTransitPageCount - 1}
              onClick={() =>
                setRelationshipTransitDayPage(
                  Math.min(relationshipTransitPageCount - 1, safeRelationshipTransitDayPage + 1)
                )
              }
            >
              {t.transitsNext}
            </button>
          </div>
          <div className="timeline-meta">
            <p><strong>{t.relationshipsTransitExact}:</strong> {relationshipTransitFeed.exactHits.length}</p>
            <p><strong>{t.relationshipsTransitSelectedDay}:</strong> {selectedRelationshipTransitDay?.date ?? "--"}</p>
          </div>
          <div className="timeline-grid">
            {pagedRelationshipTransitDays.map((day) => (
              <div key={`relationship-${day.date}`} className="timeline-day">
                <button
                  type="button"
                  className={`timeline-controls__btn ${selectedRelationshipTransitDay?.date === day.date ? "timeline-controls__btn--active" : ""}`}
                  onClick={() => setSelectedRelationshipTransitDate(day.date)}
                >
                  {day.date}
                </button>
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
              <p className="timeline-day__date">{selectedRelationshipTransitDay?.date ?? "--"}</p>
              {selectedRelationshipTransitDay?.strongestHits.length ? (
                selectedRelationshipTransitDay.strongestHits.map((hit) => (
                  <p key={`relationship-detail-${hit.date}-${hit.transitPlanet}-${hit.aspect}-${hit.natalPlanet}`} className="timeline-day__summary">
                    {hit.transitPlanet} {hit.aspect} {hit.natalPlanet} (orb {hit.orb.toFixed(1)}deg)
                  </p>
                ))
              ) : (
                <p className="timeline-day__summary">{t.relationshipsTransitNoHits}</p>
              )}
              {selectedRelationshipExactHits.length > 0 && (
                <>
                  <p className="timeline-day__summary"><strong>{t.relationshipsTransitExact}:</strong> {selectedRelationshipExactHits.length}</p>
                  {selectedRelationshipExactHits.slice(0, 5).map((hit) => (
                    <p key={`relationship-exact-${hit.date}-${hit.transitPlanet}-${hit.aspect}-${hit.natalPlanet}`} className="timeline-day__summary">
                      {hit.transitPlanet} {hit.aspect} {hit.natalPlanet} (orb {hit.orb.toFixed(1)}deg)
                    </p>
                  ))}
                </>
              )}
            </div>
          </div>
        </Section>
      )}

      {advancedOverlays && (
        <Section icon="🧠" title={t.advancedTitle} badge={t.advancedBadge} collapsible defaultOpen={false}>
          {!advancedUnlocked && (
            <div className="advanced-lock">
              <p>{t.advancedLocked}</p>
              {advancedUnlockTarget != null && (
                <p>{t.advancedLockedHint(advancedUnlockTarget, completedMissionCount)}</p>
              )}
            </div>
          )}
          {advancedUnlocked && (
            <div className="advanced-grid">
              <div className="advanced-card">
                <h3>{t.advancedCompositeTitle}</h3>
                {advancedOverlays.compositeCore.map((item) => (
                  <p key={item.key}><strong>{item.label}:</strong> {item.value}</p>
                ))}
              </div>
              <div className="advanced-card">
                <h3>{t.advancedMidpointTitle}</h3>
                {advancedOverlays.midpointHighlights.map((item) => (
                  <p key={item.key}><strong>{item.label}:</strong> {item.value}</p>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {comparisonCards.length > 0 && (
        <Section
          icon="🤝"
          title={t.compatibilityTitle}
          badge={t.compatibilityBadge(comparisonCards.length)}
          badgeAccent
          collapsible
        >
          <div className={`cards-grid--synastry cards-grid--${duoMode}`}>
            {comparisonCards.map((card) => (
              <Card
                key={`${resultVersion}-${card.key}`}
                title={card.title}
                subtitle={card.subtitle}
                text={card.text}
                tags={card.tags}
                details={card.details}
                tone={card.tone}
                variant="synastry"
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
