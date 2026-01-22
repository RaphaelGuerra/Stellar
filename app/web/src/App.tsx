import { useState, useEffect, useMemo } from "react";
import { useContentMode } from "./content/useContentMode";
import { ModeToggle } from "./components/ModeToggle";
import { buildCards, type CardModel, type ContentPack } from "./lib/cards";
import { generateChart } from "./lib/engine";
import type { ChartInput, ChartResult } from "./lib/types";

interface CardProps {
  title: string;
  subtitle?: string;
  text: string;
  tags: readonly string[];
}

function Card({ title, subtitle, text, tags }: CardProps) {
  return (
    <article className="card">
      <h3 className="card__title">{title}</h3>
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

interface SectionProps {
  icon: string;
  title: string;
  badge?: string;
  badgeAccent?: boolean;
  children: React.ReactNode;
}

function Section({ icon, title, badge, badgeAccent, children }: SectionProps) {
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

function LoadingState() {
  return (
    <div className="loading-state">
      <div className="spinner" />
      <p className="loading-text">Calculando posicoes planetarias</p>
    </div>
  );
}

function App() {
  const { mode, setMode, content } = useContentMode();
  const [input, setInput] = useState<ChartInput>({
    date: "1990-01-01",
    time: "12:00",
    city: "Rio de Janeiro",
    country: "BR",
    daylight_saving: "auto",
  });
  const [chart, setChart] = useState<ChartResult | null>(null);
  const [cards, setCards] = useState<CardModel[]>([]);
  const [loading, setLoading] = useState(false);

  // Recalculate cards when mode changes (if chart exists)
  useEffect(() => {
    if (chart) {
      setCards(buildCards(content as ContentPack, chart, mode));
    }
  }, [mode, content, chart]);

  // Separate cards into sections
  const { big3Cards, aspectCards } = useMemo(() => {
    const big3: CardModel[] = [];
    const aspects: CardModel[] = [];

    for (const card of cards) {
      if (card.key.startsWith("aspect-")) {
        aspects.push(card);
      } else if (
        card.key.includes("-Sun") ||
        card.key.includes("-Moon") ||
        card.key.startsWith("planet-Sun") ||
        card.key.startsWith("planet-Moon") ||
        card.key.startsWith("planet-sign-Sun") ||
        card.key.startsWith("planet-sign-Moon")
      ) {
        big3.push(card);
      }
    }

    return { big3Cards: big3, aspectCards: aspects };
  }, [cards]);

  // Format chart meta info
  const chartMeta = useMemo(() => {
    if (!chart?.input) return null;
    const { city, date, time } = chart.input;
    const formattedDate = new Date(`${date}T${time}`).toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return { location: city, datetime: `${formattedDate}, ${time}` };
  }, [chart]);

  const daylightSavingValue =
    input.daylight_saving === "auto"
      ? "auto"
      : input.daylight_saving
      ? "true"
      : "false";

  async function handleGenerateChart() {
    setLoading(true);
    try {
      const newChart = await generateChart(input);
      setChart(newChart);
      setCards(buildCards(content as ContentPack, newChart, mode));
    } finally {
      setLoading(false);
    }
  }

  const modeLabel = mode === "carioca" ? "Carioca" : "Normal";

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <div className="header__brand">
            <h1 className="header__title">stellar</h1>
            <div className="header__meta">
              <span>Modo {modeLabel}</span>
              {chartMeta && (
                <>
                  <span className="header__meta-divider" />
                  <span>{chartMeta.location}</span>
                  <span className="header__meta-divider" />
                  <span>{chartMeta.datetime}</span>
                </>
              )}
            </div>
          </div>
          <ModeToggle mode={mode} setMode={setMode} />
        </header>

        <main>
          <section className={`action-section ${cards.length > 0 ? "action-section--compact" : ""}`}>
            <form className="form" onSubmit={handleGenerateChart}>
              <div className="form__row">
                <label className="form__label">
                  Data
                  <input
                    type="date"
                    value={input.date}
                    onChange={(event) =>
                      setInput((prev) => ({ ...prev, date: event.target.value }))
                    }
                    required
                  />
                </label>
                <label className="form__label">
                  Hora
                  <input
                    type="time"
                    value={input.time}
                    onChange={(event) =>
                      setInput((prev) => ({ ...prev, time: event.target.value }))
                    }
                    required
                  />
                </label>
              </div>
              <div className="form__row">
                <label className="form__label">
                  Cidade
                  <input
                    type="text"
                    value={input.city}
                    onChange={(event) =>
                      setInput((prev) => ({ ...prev, city: event.target.value }))
                    }
                    required
                  />
                </label>
                <label className="form__label">
                  País
                  <input
                    type="text"
                    value={input.country}
                    onChange={(event) =>
                      setInput((prev) => ({
                        ...prev,
                        country: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
              </div>
              <div className="form__row">
                <label className="form__label">
                  Horário de verão
                  <select
                    value={daylightSavingValue}
                    onChange={(event) => {
                      const value = event.target.value;
                      const nextValue =
                        value === "auto" ? "auto" : value === "true";
                      setInput((prev) => ({
                        ...prev,
                        daylight_saving: nextValue,
                      }));
                    }}
                  >
                    <option value="auto">Auto</option>
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                  </select>
                </label>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? "Gerando..." : chart ? "Gerar novo mapa" : "Gerar mapa"}
                </button>
              </div>
            </form>
          </section>

          {!loading && chart && (
            <Section icon="🧭" title="Dados normalizados">
              <div className="normalized">
                <p>Timezone: {chart.normalized.timezone}</p>
                <p>UTC: {chart.normalized.utcDateTime}</p>
                <p>Local: {chart.normalized.localDateTime}</p>
                <p>Offset: {chart.normalized.offsetMinutes} min</p>
                <p>
                  Lat/Lon: {chart.normalized.location.lat},{" "}
                  {chart.normalized.location.lon}
                </p>
                <p>
                  Horário de verão: {chart.normalized.daylightSaving ? "Sim" : "Não"}
                </p>
              </div>
            </Section>
          )}

          {loading && <LoadingState />}

          {!loading && cards.length === 0 && (
            <p className="empty-state">
              Clique em "Gerar mapa" para ver os cards do mapa astral.
            </p>
          )}

          {!loading && big3Cards.length > 0 && (
            <Section icon="☀️" title="Big 3" badge={`${big3Cards.length} cards`}>
              <div className="cards-grid">
                {big3Cards.map((card) => (
                  <Card
                    key={card.key}
                    title={card.title}
                    subtitle={card.subtitle}
                    text={card.text}
                    tags={card.tags}
                  />
                ))}
              </div>
            </Section>
          )}

          {!loading && aspectCards.length > 0 && (
            <Section
              icon="🔗"
              title="Aspectos"
              badge={`${aspectCards.length} conexoes`}
              badgeAccent
            >
              <div className="cards-grid">
                {aspectCards.map((card) => (
                  <Card
                    key={card.key}
                    title={card.title}
                    subtitle={card.subtitle}
                    text={card.text}
                    tags={card.tags}
                  />
                ))}
              </div>
            </Section>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
