import { AstralMap } from "./AstralMap";
import type { AstralMapModel } from "../lib/types";

interface AstralMapThumbnailProps {
  model: AstralMapModel;
  title: string;
  subtitle?: string;
  openLabel: string;
  onOpen: () => void;
}

export function AstralMapThumbnail({ model, title, subtitle, openLabel, onOpen }: AstralMapThumbnailProps) {
  return (
    <button
      type="button"
      className="astral-map-thumbnail"
      onClick={onOpen}
      aria-label={openLabel}
    >
      <div className="astral-map-thumbnail__header">
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <AstralMap model={model} className="astral-map-thumbnail__map" />
      <span className="astral-map-thumbnail__cta">{openLabel}</span>
    </button>
  );
}
