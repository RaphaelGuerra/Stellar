import { useState, useEffect, useMemo, type FormEvent } from "react";
import { useContentMode } from "./content/useContentMode";
import { ModeToggle } from "./components/ModeToggle";
import { buildCards, type CardModel } from "./lib/cards";
import { generateChart } from "./lib/engine";
import { validateChartInput } from "./lib/validation";
import { SUPPORTED_CITIES } from "./lib/resolveCity";
import type { ChartInput, ChartResult } from "./lib/types";

interface CardProps {
  title: string;
  subtitle?: string;
  text: string;
  tags: readonly string[];
}

function parseLocationInput(value: string): { city: string; country: string } {
  const trimmed = value.trim();
  if (!trimmed) return { city: "", country: "" };

  const commaMatch = trimmed.match(/^(.+),\s*([A-Za-z]{2,3})$/);
  if (commaMatch) {
    return {
      city: commaMatch[1].trim(),
      country: commaMatch[2].trim().toUpperCase(),
    };
  }

  const parenMatch = trimmed.match(/^(.+)\(([^)]+)\)\s*$/);
  if (parenMatch) {
    return {
      city: parenMatch[1].trim(),
      country: parenMatch[2].trim().toUpperCase(),
    };
  }

  return { city: trimmed, country: "" };
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
    <div className="loading-state" role="status" aria-live="polite" aria-busy="true">
      <div className="spinner" aria-hidden="true" />
      <p className="loading-text">Calculando posições planetárias</p>
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
  const [locationInput, setLocationInput] = useState(
    `${input.city}, ${input.country}`
  );
  const [chart, setChart] = useState<ChartResult | null>(null);
  const [cards, setCards] = useState<CardModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recalculate cards when mode changes (if chart exists)
  useEffect(() => {
    if (chart) {
      setCards(buildCards(content, chart, mode));
    }
  }, [mode, content, chart]);

  useEffect(() => {
    const parsed = parseLocationInput(locationInput);
    setInput((prev) => ({
      ...prev,
      city: parsed.city,
      country: parsed.country,
    }));
  }, [locationInput]);

  // Separate cards into sections using category field
  const { big3Cards, aspectCards } = useMemo(() => {
    const BIG3_PLANETS = new Set(["Sun", "Moon"]);
    const big3: CardModel[] = [];
    const aspects: CardModel[] = [];

    for (const card of cards) {
      if (card.category === "aspect") {
        aspects.push(card);
      } else if (card.planet && BIG3_PLANETS.has(card.planet)) {
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

  async function handleGenerateChart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validation = validateChartInput(input);
    if (!validation.valid) {
      setError(validation.errors.join(". "));
      return;
    }

    setLoading(true);
    try {
      const newChart = await generateChart(input);
      setChart(newChart);
      setCards(buildCards(content, newChart, mode));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const modeLabel = mode === "carioca" ? "Carioca" : "Normal";

  return (
    <div className="app">
      <div className="container">
        <header className="header" role="banner">
          <div className="header__brand">
            <h1 className="header__title">stellar</h1>
            <div className="header__meta" aria-label="Informações do mapa atual">
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

        <main role="main" aria-label="Gerador de mapa astral">
          <section className={`action-section ${cards.length > 0 ? "action-section--compact" : ""}`}>
            <form className="form" onSubmit={handleGenerateChart} aria-label="Formulário de dados de nascimento">
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
                  Cidade e país
                  <input
                    type="text"
                    value={locationInput}
                    onChange={(event) => setLocationInput(event.target.value)}
                    required
                    list="supported-cities"
                    aria-describedby="city-hint"
                    placeholder="Ex: Rio de Janeiro, BR"
                  />
                  <datalist id="supported-cities">
                    {SUPPORTED_CITIES.map((city) => (
                      <option key={city} value={city} />
                    ))}
                  </datalist>
                </label>
              </div>
              <p id="city-hint" className="form__hint">
                Cidades suportadas: {SUPPORTED_CITIES.join(", ")}
              </p>
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
              {error && (
                <p className="form__error" role="alert">
                  Erro ao gerar mapa: {error}
                </p>
              )}
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
