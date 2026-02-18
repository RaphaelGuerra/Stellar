import type { AstrocartographyLine } from "../lib/engine";

interface LocationMarker {
  label: string;
  lat: number;
  lon: number;
}

interface AstrocartographyMapProps {
  lines: readonly AstrocartographyLine[];
  highlightedLabels?: readonly string[];
  location?: LocationMarker | null;
  label?: string;
}

const MAP_WIDTH = 100;
const MAP_HEIGHT = 52;

function toSignedLongitude(value: number): number {
  const normalized = ((value % 360) + 360) % 360;
  return normalized > 180 ? normalized - 360 : normalized;
}

function toMapX(longitude: number): number {
  const signed = toSignedLongitude(longitude);
  return ((signed + 180) / 360) * MAP_WIDTH;
}

function toMapY(latitude: number): number {
  const clamped = Math.max(-85, Math.min(85, latitude));
  return ((90 - clamped) / 180) * MAP_HEIGHT;
}

function lineClassByAngle(angle: AstrocartographyLine["angle"]): string {
  if (angle === "MC") return "astrocartography-map__line--mc";
  if (angle === "IC") return "astrocartography-map__line--ic";
  if (angle === "ASC") return "astrocartography-map__line--asc";
  return "astrocartography-map__line--dsc";
}

export function AstrocartographyMap({
  lines,
  highlightedLabels = [],
  location,
  label = "Astrocartography world map",
}: AstrocartographyMapProps) {
  const highlighted = new Set(highlightedLabels);

  return (
    <div className="astrocartography-map">
      <svg className="astrocartography-map__svg" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="img" aria-label={label}>
        <rect className="astrocartography-map__background" x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} />

        {[-60, -30, 0, 30, 60].map((latitude) => (
          <line
            key={`lat-${latitude}`}
            className="astrocartography-map__grid"
            x1={0}
            y1={toMapY(latitude)}
            x2={MAP_WIDTH}
            y2={toMapY(latitude)}
          />
        ))}

        {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((longitude) => (
          <line
            key={`lon-${longitude}`}
            className="astrocartography-map__grid"
            x1={toMapX(longitude)}
            y1={0}
            x2={toMapX(longitude)}
            y2={MAP_HEIGHT}
          />
        ))}

        {lines.map((line, index) => {
          const x = toMapX(line.longitude);
          const key = `${line.point} ${line.angle}`;
          return (
            <line
              key={`${key}-${line.longitude}-${index}`}
              className={`astrocartography-map__line ${lineClassByAngle(line.angle)} ${highlighted.has(key) ? "astrocartography-map__line--highlight" : ""}`}
              x1={x}
              y1={0}
              x2={x}
              y2={MAP_HEIGHT}
            />
          );
        })}

        {location && (
          <>
            <circle
              className="astrocartography-map__marker"
              cx={toMapX(location.lon)}
              cy={toMapY(location.lat)}
              r={1.4}
            />
            <text className="astrocartography-map__marker-label" x={toMapX(location.lon) + 1.8} y={toMapY(location.lat) - 1.8}>
              {location.label}
            </text>
          </>
        )}
      </svg>
      <div className="astrocartography-map__legend" aria-hidden="true">
        <span>MC</span>
        <span>IC</span>
        <span>ASC</span>
        <span>DSC</span>
      </div>
    </div>
  );
}
