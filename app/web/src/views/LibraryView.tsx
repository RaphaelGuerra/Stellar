import { useMemo, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { Section } from "../components/Section";

interface TarotCardEntry {
  name: string;
  meaningEn: string;
  meaningPt: string;
}

const TAROT_CARDS: TarotCardEntry[] = [
  { name: "The Fool", meaningEn: "New path, leap with trust, stay aware.", meaningPt: "Novo caminho, salta com fe e consciencia." },
  { name: "The Magician", meaningEn: "Focus intention and use what you already have.", meaningPt: "Foca a intencao e usa o que ja ta na mao." },
  { name: "The High Priestess", meaningEn: "Listen to intuition before acting.", meaningPt: "Escuta a intuicao antes de agir." },
  { name: "The Empress", meaningEn: "Nurture growth and body rhythms.", meaningPt: "Nutre crescimento e ritmo do corpo." },
  { name: "The Emperor", meaningEn: "Build structure and hold boundaries.", meaningPt: "Cria estrutura e segura limite." },
  { name: "The Lovers", meaningEn: "Choose alignment over impulse.", meaningPt: "Escolhe alinhamento, nao impulso." },
  { name: "The Chariot", meaningEn: "Move with discipline and direction.", meaningPt: "Avanca com disciplina e direcao." },
  { name: "Strength", meaningEn: "Steady courage beats force.", meaningPt: "Coragem constante vale mais que forca bruta." },
  { name: "The Hermit", meaningEn: "Step back to hear your inner signal.", meaningPt: "Da um passo atras pra ouvir teu sinal interno." },
  { name: "Wheel of Fortune", meaningEn: "Cycle is turning; stay adaptable.", meaningPt: "O ciclo virou; adapta rapido." },
  { name: "Justice", meaningEn: "Consequences are clear; choose cleanly.", meaningPt: "Consequencia ta clara; escolhe com limpidez." },
  { name: "The Star", meaningEn: "Recover hope and long-range vision.", meaningPt: "Recupera esperanca e visao de longo prazo." },
];

function buildMoonPhaseInfo(dateIso: string, isCarioca: boolean): { phaseLabel: string; illuminationLabel: string } {
  const target = Date.parse(`${dateIso}T12:00:00Z`);
  const epoch = Date.parse("2000-01-06T18:14:00Z");
  const synodicMonth = 29.530588853;
  const days = (target - epoch) / 86400000;
  const phase = ((days / synodicMonth) % 1 + 1) % 1;
  const illumination = Math.round((((1 - Math.cos(2 * Math.PI * phase)) / 2) * 100) * 10) / 10;
  let phaseLabel = "New Moon";
  if (phase >= 0.125 && phase < 0.25) phaseLabel = "Waxing Crescent";
  else if (phase >= 0.25 && phase < 0.375) phaseLabel = "First Quarter";
  else if (phase >= 0.375 && phase < 0.5) phaseLabel = "Waxing Gibbous";
  else if (phase >= 0.5 && phase < 0.625) phaseLabel = "Full Moon";
  else if (phase >= 0.625 && phase < 0.75) phaseLabel = "Waning Gibbous";
  else if (phase >= 0.75 && phase < 0.875) phaseLabel = "Last Quarter";
  else if (phase >= 0.875) phaseLabel = "Waning Crescent";
  if (isCarioca) {
    const translated: Record<string, string> = {
      "New Moon": "Lua Nova",
      "Waxing Crescent": "Crescente",
      "First Quarter": "Quarto Crescente",
      "Waxing Gibbous": "Gibosa Crescente",
      "Full Moon": "Lua Cheia",
      "Waning Gibbous": "Gibosa Minguante",
      "Last Quarter": "Quarto Minguante",
      "Waning Crescent": "Minguante",
    };
    phaseLabel = translated[phaseLabel] ?? phaseLabel;
  }
  return {
    phaseLabel,
    illuminationLabel: isCarioca ? `${illumination.toFixed(1)}% iluminada` : `${illumination.toFixed(1)}% illuminated`,
  };
}

export function LibraryView() {
  const { isCarioca, chartA, timeTravelDate } = useAppContext();

  const t = {
    libraryTitle: isCarioca ? "Biblioteca astrologica" : "Astrology library",
    libraryGlossary: isCarioca ? "Glossario base para consulta rapida." : "Core glossary for quick reference.",
    libraryTemplates: isCarioca ? "Templates de interpretacao e journal." : "Interpretation and journaling templates.",
    libraryMoonTitle: isCarioca ? "Ciclo lunar (data atual)" : "Moon cycle (current date)",
    libraryMoonPhase: isCarioca ? "Fase" : "Phase",
    libraryMoonIllumination: isCarioca ? "Iluminacao" : "Illumination",
    libraryTarotTitle: isCarioca ? "Tarot opcional" : "Optional tarot pull",
    libraryTarotDraw: isCarioca ? "Puxar carta" : "Draw card",
    libraryTarotHint: isCarioca
      ? "Usa como prompt de journaling, nao como verdade absoluta."
      : "Use as a journaling prompt, not absolute truth.",
  };

  const libraryGlossaryEntries = isCarioca
    ? [
        { term: "Ascendente", text: "Como tu chega no mundo e no primeiro impacto." },
        { term: "MC", text: "Direcao publica, carreira e reputacao." },
        { term: "Casa 7", text: "Parcerias, namoro, casamento e contratos." },
        { term: "Retorno Solar", text: "Mapa do ano pessoal entre aniversarios." },
      ]
    : [
        { term: "Ascendant", text: "Your outward style and first-impression interface." },
        { term: "MC", text: "Public direction, vocation, and reputation axis." },
        { term: "7th House", text: "Partnerships, commitment, and relational contracts." },
        { term: "Solar Return", text: "Yearly chart from birthday to birthday." },
      ];

  const libraryTemplateEntries = isCarioca
    ? [
        "Template de transito: o que ativou, como senti no corpo, acao concreta hoje.",
        "Template de sinastria: ponto forte, ponto sensivel, acordo pratico da semana.",
        "Template de atlas: cidade, linhas proximas, objetivo de vida ligado ao lugar.",
      ]
    : [
        "Transit template: what was activated, body signal, one concrete action today.",
        "Synastry template: strongest bond, friction point, practical agreement for the week.",
        "Atlas template: city, nearest lines, life-goal hypothesis tied to place.",
      ];

  const moonPhaseInfo = useMemo(
    () => buildMoonPhaseInfo(timeTravelDate, isCarioca),
    [isCarioca, timeTravelDate]
  );

  const [tarotDraw, setTarotDraw] = useState<TarotCardEntry | null>(null);

  function handleDrawTarot() {
    const seed = Date.now() + (chartA?.normalized.utcDateTime ? Date.parse(chartA.normalized.utcDateTime) : 0);
    const index = Math.abs(seed) % TAROT_CARDS.length;
    setTarotDraw(TAROT_CARDS[index]);
  }

  return (
    <Section icon="📚" title={t.libraryTitle}>
      <div className="timeline-grid">
        <div className="timeline-day">
          <p className="timeline-day__summary">{t.libraryGlossary}</p>
          {libraryGlossaryEntries.map((entry) => (
            <p key={entry.term} className="timeline-day__summary"><strong>{entry.term}:</strong> {entry.text}</p>
          ))}
        </div>
        <div className="timeline-day">
          <p className="timeline-day__summary">{t.libraryTemplates}</p>
          {libraryTemplateEntries.map((template) => (
            <p key={template} className="timeline-day__summary">{template}</p>
          ))}
        </div>
        <div className="timeline-day">
          <p className="timeline-day__date">{t.libraryMoonTitle}</p>
          <p className="timeline-day__summary"><strong>{t.libraryMoonPhase}:</strong> {moonPhaseInfo.phaseLabel}</p>
          <p className="timeline-day__summary"><strong>{t.libraryMoonIllumination}:</strong> {moonPhaseInfo.illuminationLabel}</p>
          <p className="timeline-day__date">{t.libraryTarotTitle}</p>
          <button type="button" className="timeline-controls__btn" onClick={handleDrawTarot}>
            {t.libraryTarotDraw}
          </button>
          <p className="timeline-day__summary">{t.libraryTarotHint}</p>
          {tarotDraw && (
            <>
              <p className="timeline-day__summary"><strong>{tarotDraw.name}</strong></p>
              <p className="timeline-day__summary">{isCarioca ? tarotDraw.meaningPt : tarotDraw.meaningEn}</p>
            </>
          )}
        </div>
      </div>
    </Section>
  );
}
