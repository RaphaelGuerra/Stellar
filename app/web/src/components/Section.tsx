import { useState, type ReactNode } from "react";

interface SectionProps {
  icon: string;
  title: string;
  badge?: string;
  badgeAccent?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function Section({ icon, title, badge, badgeAccent, collapsible, defaultOpen = true, children }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (collapsible) {
    return (
      <details className="section" open={isOpen} onToggle={(e) => setIsOpen(e.currentTarget.open)}>
        <summary className="section__header section__header--collapsible">
          <span className="section__icon">{icon}</span>
          <h2 className="section__title">{title}</h2>
          {badge && (
            <span className={`section__badge ${badgeAccent ? "section__badge--accent" : ""}`}>
              {badge}
            </span>
          )}
          <span className="section__chevron" aria-hidden="true" />
        </summary>
        {children}
      </details>
    );
  }

  return (
    <section className="section">
      <div className="section__header">
        <span className="section__icon">{icon}</span>
        <h2 className="section__title">{title}</h2>
        {badge && (
          <span className={`section__badge ${badgeAccent ? "section__badge--accent" : ""}`}>
            {badge}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}
