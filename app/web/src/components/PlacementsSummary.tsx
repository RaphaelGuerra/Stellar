import type { PlacementSummary } from "../lib/cards";

export function PlacementsSummary({ placements }: { placements: PlacementSummary[] }) {
  if (placements.length === 0) return null;
  return (
    <div className="placements-strip">
      {placements.map((p) => (
        <span key={p.planet} className={`placements-strip__item placements-strip__item--${p.element}`}>
          {p.planetSymbol} {p.signSymbol}
          {p.degree != null && (
            <span className="placements-strip__degree">{p.degree.toFixed(1)}&deg;</span>
          )}
        </span>
      ))}
    </div>
  );
}
