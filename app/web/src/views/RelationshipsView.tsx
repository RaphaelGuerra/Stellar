import { useEffect, useMemo, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { Section } from "../components/Section";
import { Card } from "../components/Card";
import { MatchScorecards } from "../components/MatchScorecards";
import { runAstroWorkerTask } from "../lib/astroWorkerClient";
import { buildMatchScorecards } from "../lib/matchScorecards";
import { buildAdvancedOverlaySummary } from "../lib/phase5";
import {
  ADVANCED_OVERLAYS_UNLOCK_XP,
  getAdvancedOverlaysUnlockXp,
  getDetailUnlockCount,
  getNextDetailUnlockXp,
  hasCompletedQuest,
  hasReflectedQuest,
  isAdvancedOverlaysUnlocked,
  buildRelationshipQuest,
} from "../lib/progression";
import { shiftIsoDate } from "../lib/dateUtils";
import type { ChartResult, LifeArea } from "../lib/types";
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
    handleQuestComplete,
    handleQuestReflection,
  } = useAppContext();

  const t = {
    matchScorecardsTitle: isCarioca ? "Resumo rapido dos matches" : "Best and worst match summary",
    matchScorecardsBadge: isCarioca ? "amor, amizade, familia" : "love, friendship, family",
    matchAreaLove: duoMode === "friend" ? (isCarioca ? "Vibe" : "Bond") : isCarioca ? "Amor" : "Love",
    matchAreaFriends: isCarioca ? "Amizade" : "Friendship",
    matchAreaFamily: isCarioca ? "Familia" : "Family",
    matchSupportLabel: isCarioca ? "Melhor apoio" : "Best support",
    matchTensionLabel: isCarioca ? "Maior tensao" : "Biggest tension",
    matchAspectEmpty: isCarioca ? "Sem aspecto dominante" : "No dominant aspect",
    compatibilityTitle: isCarioca ? "Sinastria de cria" : "Synastry",
    compatibilityBadge: (n: number) => isCarioca ? `${n} aspectos brabos` : `${n} aspects`,
    compatibilityEmpty: isCarioca
      ? 'Clica em "Gerar mapa, porra" pra ver a treta entre Pessoa A e Pessoa B.'
      : 'Click "Generate chart" to see aspects between Person A and Person B.',
    compatibilityStatsTitle:
      duoMode === "friend"
        ? isCarioca ? "Stats da amizade" : "Friendship stats"
        : isCarioca ? "Stats da relacao" : "Relationship stats",
    compatibilityStatsBadge: isCarioca ? "modo RPG" : "RPG mode",
    questTitle:
      duoMode === "friend"
        ? isCarioca ? "Missao da amizade" : "Friendship quest"
        : isCarioca ? "Missao da dupla" : "Relationship quest",
    questBadge: (label: string) => isCarioca ? `foco em ${label}` : `${label} focus`,
    questXpLabel: isCarioca ? "XP total" : "Total XP",
    questStreakLabel: isCarioca ? "Streak" : "Streak",
    questUnlockLabel: (count: number) =>
      isCarioca ? `Blocos destravados: ${count}/4` : `Unlocked detail blocks: ${count}/4`,
    questNextUnlockLabel: (xp: number) =>
      isCarioca ? `Proximo unlock em ${xp} XP` : `Next unlock at ${xp} XP`,
    questComplete: isCarioca ? `Concluir missao (+40 XP)` : "Complete quest (+40 XP)",
    questCompleted: isCarioca ? "Missao concluida" : "Quest completed",
    questReflect: isCarioca ? "Registrar reflexao (+20 XP)" : "Log reflection (+20 XP)",
    questReflected: isCarioca ? "Reflexao registrada" : "Reflection logged",
    advancedTitle: isCarioca ? "Overlays avancados" : "Advanced overlays",
    advancedBadge: isCarioca ? "composite + midpoints" : "composite + midpoints",
    advancedLocked: isCarioca
      ? `Desbloqueia com ${ADVANCED_OVERLAYS_UNLOCK_XP} XP`
      : `Unlocks at ${ADVANCED_OVERLAYS_UNLOCK_XP} XP`,
    advancedLockedHint: (xp: number) =>
      isCarioca
        ? `Faltam ${Math.max(0, xp - progression.xp)} XP para liberar.`
        : `${Math.max(0, xp - progression.xp)} XP to unlock.`,
    advancedCompositeTitle: isCarioca ? "Composite core" : "Composite core",
    advancedMidpointTitle: isCarioca ? "Midpoints-chave" : "Key midpoints",
    relationshipsComposite: isCarioca ? "Mapa composto" : "Composite chart",
    relationshipsDavison: isCarioca ? "Mapa Davison" : "Davison chart",
    relationshipsTransitTimeline: isCarioca ? "Timeline de transitos da relacao" : "Relationship transit timeline",
    relationshipsTransitExact: isCarioca ? "Aspectos exatos da relacao" : "Relationship exact hits",
    relationshipsTransitSelectedDay: isCarioca ? "Dia da relacao" : "Relationship day",
    relationshipsTransitNoHits: isCarioca ? "Sem hits de relacao nesse dia." : "No relationship hits on this day.",
    transitsPrev: isCarioca ? "Anterior" : "Prev",
    transitsNext: isCarioca ? "Proximo" : "Next",
    transitsPage: (page: number, total: number) =>
      isCarioca ? `Pagina ${page}/${total}` : `Page ${page}/${total}`,
    emptyModeHint: isCarioca
      ? "Muda pra Sinastria braba pra liberar a area de relacoes."
      : "Switch to Compatibility mode to use Relationships.",
  };

  const cardExpandLabels = isCarioca
    ? { more: "Abrir mais", less: "Fechar" }
    : { more: "Show more", less: "Show less" };

  const matchAreaLabels: Record<LifeArea, string> = {
    love: t.matchAreaLove,
    friends: t.matchAreaFriends,
    family: t.matchAreaFamily,
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
      setCompositeChart(null);
      setDavisonChart(null);
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
      setRelationshipTransitFeed(null);
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

  // Sync relationship transit pagination
  useEffect(() => {
    if (!relationshipTransitFeed || relationshipTransitFeed.days.length === 0) {
      if (selectedRelationshipTransitDate !== "") setSelectedRelationshipTransitDate("");
      if (relationshipTransitDayPage !== 0) setRelationshipTransitDayPage(0);
      return;
    }
    const maxPage = Math.max(0, Math.ceil(relationshipTransitFeed.days.length / TRANSIT_PAGE_SIZE) - 1);
    if (relationshipTransitDayPage > maxPage) {
      setRelationshipTransitDayPage(maxPage);
      return;
    }
    const selectedIndex = relationshipTransitFeed.days.findIndex(
      (day) => day.date === selectedRelationshipTransitDate
    );
    if (selectedIndex === -1) {
      setSelectedRelationshipTransitDate(relationshipTransitFeed.days[0].date);
      return;
    }
    const selectedPage = Math.floor(selectedIndex / TRANSIT_PAGE_SIZE);
    if (selectedPage !== relationshipTransitDayPage) {
      setRelationshipTransitDayPage(selectedPage);
    }
  }, [relationshipTransitDayPage, relationshipTransitFeed, selectedRelationshipTransitDate]);

  // Local memos
  const matchScorecards = useMemo(() => {
    if (analysisMode !== "compatibility" || !comparison) return [];
    return buildMatchScorecards(comparison, isCarioca ? "pt" : "en", duoMode);
  }, [analysisMode, comparison, duoMode, isCarioca]);

  const unlockedDetailCount = useMemo(
    () => getDetailUnlockCount(progression.xp),
    [progression.xp]
  );
  const nextDetailUnlockXp = useMemo(
    () => getNextDetailUnlockXp(progression.xp),
    [progression.xp]
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

  const advancedUnlocked = isAdvancedOverlaysUnlocked(progression.xp);
  const advancedUnlockTarget = getAdvancedOverlaysUnlockXp(progression.xp);

  const questCompleted = relationshipQuest
    ? hasCompletedQuest(progression, relationshipQuest.id)
    : false;
  const questReflected = relationshipQuest
    ? hasReflectedQuest(progression, relationshipQuest.id)
    : false;

  const relationshipTransitPageCount = useMemo(() => {
    if (!relationshipTransitFeed || relationshipTransitFeed.days.length === 0) return 1;
    return Math.max(1, Math.ceil(relationshipTransitFeed.days.length / TRANSIT_PAGE_SIZE));
  }, [relationshipTransitFeed]);

  const pagedRelationshipTransitDays = useMemo(() => {
    if (!relationshipTransitFeed) return [];
    const safePage = Math.max(0, Math.min(relationshipTransitDayPage, relationshipTransitPageCount - 1));
    const start = safePage * TRANSIT_PAGE_SIZE;
    return relationshipTransitFeed.days.slice(start, start + TRANSIT_PAGE_SIZE);
  }, [relationshipTransitDayPage, relationshipTransitFeed, relationshipTransitPageCount]);

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
        <Section icon="⚖️" title={t.matchScorecardsTitle} badge={t.matchScorecardsBadge}>
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
        <Section icon="🎮" title={t.compatibilityStatsTitle} badge={t.compatibilityStatsBadge}>
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
        <Section icon="🎯" title={t.questTitle} badge={t.questBadge(relationshipQuest.focusStatLabel)}>
          <div className="quest-panel">
            <div className="quest-panel__stats">
              <p>{t.questXpLabel}: {progression.xp}</p>
              <p>{t.questStreakLabel}: {progression.streak}</p>
              <p>{t.questUnlockLabel(unlockedDetailCount)}</p>
              {nextDetailUnlockXp != null && (
                <p>{t.questNextUnlockLabel(nextDetailUnlockXp)}</p>
              )}
            </div>
            <div className="quest-panel__actions">
              <button
                type="button"
                className="quest-action"
                onClick={() => handleQuestComplete(relationshipQuest)}
                disabled={questCompleted}
              >
                {questCompleted ? t.questCompleted : t.questComplete}
              </button>
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
        </Section>
      )}

      {(compositeChart || davisonChart) && (
        <Section icon="🧩" title={t.relationshipsComposite} badge="midpoint + davison">
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
        <Section icon="🌠" title={t.relationshipsTransitTimeline} badge={`30d · ${timeTravelDate}`}>
          <div className="timeline-controls" role="group" aria-label={t.relationshipsTransitTimeline}>
            <button
              type="button"
              className="timeline-controls__btn"
              disabled={relationshipTransitDayPage <= 0}
              onClick={() => setRelationshipTransitDayPage((page) => Math.max(0, page - 1))}
            >
              {t.transitsPrev}
            </button>
            <span className="timeline-day__summary">
              {t.transitsPage(
                Math.min(relationshipTransitDayPage + 1, relationshipTransitPageCount),
                relationshipTransitPageCount
              )}
            </span>
            <button
              type="button"
              className="timeline-controls__btn"
              disabled={relationshipTransitDayPage >= relationshipTransitPageCount - 1}
              onClick={() =>
                setRelationshipTransitDayPage((page) => Math.min(relationshipTransitPageCount - 1, page + 1))
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
        <Section icon="🧠" title={t.advancedTitle} badge={t.advancedBadge}>
          {!advancedUnlocked && (
            <div className="advanced-lock">
              <p>{t.advancedLocked}</p>
              {advancedUnlockTarget != null && (
                <p>{t.advancedLockedHint(advancedUnlockTarget)}</p>
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
