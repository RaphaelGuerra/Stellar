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
}

export function Card({ title, subtitle, text, tags, element, tone, variant, degree, orb }: CardProps) {
  const classes = [
    "card",
    element ? `card--${element}` : "",
    tone ? `card--tone-${tone}` : "",
    variant ? `card--${variant}` : "",
  ].filter(Boolean).join(" ");

  const hasBadge = (degree != null) || (orb != null);

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
      <p className="card__text">{text}</p>
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
