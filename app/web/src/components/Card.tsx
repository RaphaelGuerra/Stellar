import { useId, useState } from "react";
import type { DetailBlock } from "../lib/types";

interface CardProps {
  title: string;
  subtitle?: string;
  text: string;
  tags: readonly string[];
  element?: string;
  tone?: string;
  variant?: "hero" | "planet" | "aspect" | "synastry";
  degree?: number;
  orb?: number;
  expandLabels?: {
    more: string;
    less: string;
  };
  expandThreshold?: number;
  details?: readonly DetailBlock[];
}

export function Card({
  title,
  subtitle,
  text,
  tags,
  element,
  tone,
  variant,
  degree,
  orb,
  expandLabels,
  expandThreshold = 220,
  details,
}: CardProps) {
  const classes = [
    "card",
    element ? `card--${element}` : "",
    tone ? `card--tone-${tone}` : "",
    variant ? `card--${variant}` : "",
  ].filter(Boolean).join(" ");

  const hasBadge = (degree != null) || (orb != null);
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const hasDetails = (details?.length ?? 0) > 0;
  const canExpand = text.length > expandThreshold || hasDetails;

  return (
    <article className={classes}>
      {hasBadge ? (
        <div className="card__header">
          <h3 className="card__title">{title}</h3>
          {degree != null && (
            <span className="card__degree-badge">{degree.toFixed(1)}&deg;</span>
          )}
          {orb != null && (
            <span className="card__orb-badge">{orb.toFixed(1)}&deg; orb</span>
          )}
        </div>
      ) : (
        <h3 className="card__title">{title}</h3>
      )}
      {subtitle && <p className="card__subtitle">{subtitle}</p>}
      <div id={contentId}>
        <p className={`card__text ${canExpand && !expanded ? "card__text--clamped" : ""}`}>
          {text}
        </p>
        {expanded && hasDetails && (
          <div className="card__details">
            {details?.map((detail, index) => (
              <div key={`${detail.title}-${index}`} className="card__detail">
                <p className="card__detail-title">{detail.title}</p>
                <p className="card__detail-text">{detail.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      {canExpand && (
        <button
          type="button"
          className="card__expand-btn"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? (expandLabels?.less ?? "Show less") : (expandLabels?.more ?? "Show more")}
        </button>
      )}
      <div className="card__tags">
        {tags.map((tag) => (
          <span key={tag} className="tag">
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
}
