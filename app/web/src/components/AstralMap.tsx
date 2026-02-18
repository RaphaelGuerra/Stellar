import { ASPECT_SYMBOL, PLANET_SYMBOL, SIGN_SYMBOL, normalizeAngle } from "../lib/constants";
import { getHouseRingRadius, getMapCenter } from "../lib/astralMap";
import type { AspectName, AstralMapModel, MapHouse } from "../lib/types";

interface AstralMapProps {
  model: AstralMapModel;
  activeAspectTypes?: readonly AspectName[];
  showLegend?: boolean;
  className?: string;
  legendLabels?: {
    outerA: string;
    innerB: string;
    flow: string;
    tension: string;
    intense: string;
  };
}

const OUTER_RING_RADIUS = 47;
const INNER_RING_RADIUS = 20;

function toPoint(longitude: number, radius: number): { x: number; y: number } {
  const center = getMapCenter();
  const angle = ((normalizeAngle(longitude) - 90) * Math.PI) / 180;
  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
  };
}

function getHouseMidpoint(house: MapHouse): number {
  return normalizeAngle(house.cuspLongitude + 15);
}

export function AstralMap({ model, activeAspectTypes, showLegend, className, legendLabels }: AstralMapProps) {
  const center = getMapCenter();
  const houseRingRadius = getHouseRingRadius();
  const activeTypes = new Set(activeAspectTypes ?? model.lines.map((line) => line.type));
  const lines = model.lines.filter((line) => activeTypes.has(line.type));

  return (
    <div className={className ? `astral-map ${className}` : "astral-map"}>
      <svg
        className="astral-map__svg"
        viewBox="0 0 100 100"
        role="img"
        aria-label="Astral map"
      >
        <circle className="astral-map__ring astral-map__ring--outer" cx={center} cy={center} r={OUTER_RING_RADIUS} />
        <circle className="astral-map__ring astral-map__ring--house" cx={center} cy={center} r={houseRingRadius} />
        <circle className="astral-map__ring astral-map__ring--inner" cx={center} cy={center} r={INNER_RING_RADIUS} />

        {model.houses.map((house) => {
          const start = toPoint(house.cuspLongitude, INNER_RING_RADIUS);
          const end = toPoint(house.cuspLongitude, OUTER_RING_RADIUS);
          const houseLabel = toPoint(getHouseMidpoint(house), houseRingRadius + 2.6);
          const signLabel = toPoint(getHouseMidpoint(house), OUTER_RING_RADIUS - 2.2);
          return (
            <g key={`house-${house.house}`}>
              <line className="astral-map__house-line" x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
              <text className="astral-map__house-label" x={houseLabel.x} y={houseLabel.y}>
                {house.house}
              </text>
              <text className="astral-map__sign-label" x={signLabel.x} y={signLabel.y}>
                {SIGN_SYMBOL[house.sign]}
              </text>
            </g>
          );
        })}

        <g className="astral-map__lines">
          {lines.map((line, index) => (
            <line
              key={`line-${line.from.chart}-${line.from.planet}-${line.to.chart}-${line.to.planet}-${line.type}-${index}`}
              className={`astral-map__aspect astral-map__aspect--${line.tone}`}
              x1={line.from.x}
              y1={line.from.y}
              x2={line.to.x}
              y2={line.to.y}
            />
          ))}
        </g>

        <g className="astral-map__planets">
          {model.planets.map((point) => (
            <g key={`${point.chart}-${point.planet}`}>
              <circle
                className={`astral-map__planet-dot astral-map__planet-dot--${point.chart.toLowerCase()}`}
                cx={point.x}
                cy={point.y}
                r={1.7}
              />
              <text className="astral-map__planet-label" x={point.x} y={point.y - 2.4}>
                {PLANET_SYMBOL[point.planet]}
              </text>
            </g>
          ))}
        </g>
      </svg>

      {showLegend && (
        <div className="astral-map__legend" aria-hidden="true">
          <span><strong>A</strong> {legendLabels?.outerA ?? "outer ring"}</span>
          {model.mode === "compatibility" && <span><strong>B</strong> {legendLabels?.innerB ?? "inner ring"}</span>}
          <span>{ASPECT_SYMBOL.Trine} / {ASPECT_SYMBOL.Sextile} {legendLabels?.flow ?? "flow"}</span>
          <span>{ASPECT_SYMBOL.Square} / {ASPECT_SYMBOL.Opposition} {legendLabels?.tension ?? "tension"}</span>
          <span>{ASPECT_SYMBOL.Conjunction} {legendLabels?.intense ?? "intense"}</span>
        </div>
      )}
    </div>
  );
}
