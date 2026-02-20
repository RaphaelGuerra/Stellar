import type { MatchScorecard, MatchScorecardArea } from "../lib/types";

interface MatchScorecardsProps {
  cards: MatchScorecard[];
  areaLabels: Record<MatchScorecardArea, string>;
  supportLabel: string;
  tensionLabel: string;
  emptyAspectLabel: string;
}

export function MatchScorecards({
  cards,
  areaLabels,
  supportLabel,
  tensionLabel,
  emptyAspectLabel,
}: MatchScorecardsProps) {
  if (cards.length === 0) return null;

  return (
    <div className="match-scorecards">
      {cards.map((card) => (
        <article
          key={card.area}
          className={`match-scorecard match-scorecard--${card.status}`}
          aria-label={`${areaLabels[card.area]} ${card.score}%`}
        >
          <div className="match-scorecard__head">
            <h3>{areaLabels[card.area]}</h3>
            <p>{card.score}%</p>
          </div>
          <div className="match-scorecard__track" aria-hidden="true">
            <div className="match-scorecard__bar" style={{ width: `${card.score}%` }} />
          </div>
          <p className="match-scorecard__summary">{card.summary}</p>
          <p className="match-scorecard__line">
            <strong>{supportLabel}:</strong> {card.topSupportAspect ?? emptyAspectLabel}
          </p>
          <p className="match-scorecard__line">
            <strong>{tensionLabel}:</strong> {card.topTensionAspect ?? emptyAspectLabel}
          </p>
        </article>
      ))}
    </div>
  );
}
