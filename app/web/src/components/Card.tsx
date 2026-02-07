import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
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
  details,
}: CardProps) {
  const baseClasses = [
    "card",
    element ? `card--${element}` : "",
    tone ? `card--tone-${tone}` : "",
    variant ? `card--${variant}` : "",
  ].filter(Boolean).join(" ");

  const hasBadge = (degree != null) || (orb != null);
  const [expanded, setExpanded] = useState(false);
  const [textOverflows, setTextOverflows] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  const contentId = useId();
  const hasDetails = (details?.length ?? 0) > 0;
  const detailsSignature = (details ?? [])
    .map((detail) => `${detail.title}|${detail.text}`)
    .join("||");
  const canExpand = hasDetails || textOverflows;
  const shouldClampText = textOverflows && !expanded;
  const classes = canExpand ? `${baseClasses} card--expandable` : baseClasses;

  function toggleExpanded() {
    if (!canExpand) return;
    setExpanded((prev) => !prev);
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!canExpand) return;
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleExpanded();
  }

  useEffect(() => {
    const textElement = textRef.current;
    if (!textElement) return;

    const measureOverflow = () => {
      const wasClamped = textElement.classList.contains("card__text--clamped");
      if (!wasClamped) textElement.classList.add("card__text--clamped");
      const overflows = textElement.scrollHeight - textElement.clientHeight > 1;
      if (!wasClamped) textElement.classList.remove("card__text--clamped");
      setTextOverflows((prev) => (prev === overflows ? prev : overflows));
    };

    measureOverflow();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measureOverflow());
    observer.observe(textElement);
    return () => observer.disconnect();
  }, [text, detailsSignature]);

  return (
    <article
      className={classes}
      onClick={canExpand ? toggleExpanded : undefined}
      onKeyDown={canExpand ? handleCardKeyDown : undefined}
      role={canExpand ? "button" : undefined}
      tabIndex={canExpand ? 0 : undefined}
      aria-expanded={canExpand ? expanded : undefined}
      aria-controls={canExpand ? contentId : undefined}
    >
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
        <p
          ref={textRef}
          className={`card__text ${shouldClampText ? "card__text--clamped" : ""}`}
        >
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
        <span className="card__expand-btn" aria-hidden="true">
          {expanded ? (expandLabels?.less ?? "Show less") : (expandLabels?.more ?? "Show more")}
        </span>
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
