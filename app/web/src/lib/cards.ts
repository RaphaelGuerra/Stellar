import { aspectSymbol, formatPairLine, type Mode } from "./aspectContext";
import {
  type ElementName,
  PLANETS,
  PLANET_SYMBOL,
  SIGN_ELEMENT,
  SIGN_SYMBOL,
} from "./constants";
import type { AspectName, ChartResult, DetailBlock, PlanetName, ZodiacSign } from "./types";

export type { ElementName } from "./constants";

export type CardCategory = "planet" | "sign" | "planet-sign" | "aspect";

export interface Entry {
  title: string;
  text: string;
  tags: readonly string[];
}

export interface ContentPack {
  sign: Record<string, Entry>;
  house: Record<string, Entry>;
  planet: Record<string, Entry>;
  aspect: Record<string, Entry>;
}

export interface CardModel {
  key: string;
  category: CardCategory;
  title: string;
  subtitle?: string;
  text: string;
  tags: readonly string[];
  details?: readonly DetailBlock[];
  planet?: PlanetName;
  sign?: ZodiacSign;
  element?: ElementName;
  degree?: number;
  planetSymbol?: string;
  signSymbol?: string;
  orb?: number;
}

export interface PlacementSummary {
  planet: PlanetName;
  sign: ZodiacSign;
  degree?: number;
  planetSymbol: string;
  signSymbol: string;
  element: ElementName;
}

const PLANET_INTENT: Record<Mode, Record<PlanetName, string>> = {
  normal: {
    Sun: "lead with identity and purpose",
    Moon: "seek emotional safety and belonging",
    Mercury: "process through ideas and words",
    Venus: "prioritize connection and values",
    Mars: "move through action and friction",
    Jupiter: "expand through trust and growth",
    Saturn: "stabilize through structure and duty",
    Uranus: "break patterns and demand freedom",
    Neptune: "blend intuition, dreams, and sensitivity",
    Pluto: "go deep and transform what is stagnant",
  },
  carioca: {
    Sun: "botar tua identidade no mundo sem pedir desculpa",
    Moon: "se sentir seguro e acolhido pra nao pirar",
    Mercury: "resolver tudo no papo e na ideia",
    Venus: "buscar afeto, prazer e valor de verdade",
    Mars: "meter acao e encarar atrito de frente",
    Jupiter: "crescer na confianca e no risco calculado",
    Saturn: "botar ordem, limite e responsabilidade",
    Uranus: "quebrar padrao e pedir liberdade na marra",
    Neptune: "misturar intuicao, sonho e sensibilidade",
    Pluto: "cavar fundo e transformar o que ta podre",
  },
};

const ELEMENT_STYLE: Record<Mode, Record<ElementName, { leverage: string; trap: string; action: string }>> = {
  normal: {
    fire: {
      leverage: "Momentum, confidence, and fast starts.",
      trap: "Rushing before aligning with reality.",
      action: "Pick one bold move and finish it before opening a second front.",
    },
    earth: {
      leverage: "Consistency, craft, and durable progress.",
      trap: "Overcontrol and fear of changing a working system.",
      action: "Keep your routine, but add one controlled experiment this week.",
    },
    air: {
      leverage: "Perspective, communication, and social intelligence.",
      trap: "Staying in analysis mode without execution.",
      action: "Turn one idea into a decision with a clear deadline.",
    },
    water: {
      leverage: "Empathy, intuition, and emotional timing.",
      trap: "Absorbing external noise and losing boundaries.",
      action: "Name one emotional limit early and protect it consistently.",
    },
  },
  carioca: {
    fire: {
      leverage: "Coragem, presenca e arranque rapido.",
      trap: "Sair atropelando e depois apagar incendio.",
      action: "Escolhe uma jogada ousada e fecha essa porra antes de abrir outra.",
    },
    earth: {
      leverage: "Constancia, qualidade e resultado que fica.",
      trap: "Teimosia e controle ate travar tudo.",
      action: "Mantem a rotina, mas testa uma mudanca pequena sem drama.",
    },
    air: {
      leverage: "Visao ampla, papo afiado e leitura social.",
      trap: "Ficar no blablabla e nao executar nada.",
      action: "Bate o martelo em uma decisao com prazo curto.",
    },
    water: {
      leverage: "Empatia, intuicao e timing emocional.",
      trap: "Sugar energia dos outros e se enrolar.",
      action: "Define um limite emocional claro e segura essa linha.",
    },
  },
};

const ASPECT_PLAYBOOK: Record<
  Mode,
  Record<AspectName, { dynamic: string; bestUse: string; trap: string; move: string }>
> = {
  normal: {
    Conjunction: {
      dynamic: "This is a high-intensity merge of both forces.",
      bestUse: "Use it to align mission and rhythm quickly.",
      trap: "Blurring boundaries until roles get confused.",
      move: "Assign explicit ownership before the next big decision.",
    },
    Opposition: {
      dynamic: "This is a polarity axis: attraction and tension together.",
      bestUse: "Use the contrast to expose blind spots.",
      trap: "Turning differences into repetitive standoffs.",
      move: "Make a two-column agreement: non-negotiables and flex zones.",
    },
    Square: {
      dynamic: "This is friction that pressures growth.",
      bestUse: "Use it as fuel for skill and maturity.",
      trap: "Escalating conflict without changing behavior.",
      move: "Pick one recurring conflict and define one new rule for it.",
    },
    Trine: {
      dynamic: "This is natural flow and strong compatibility.",
      bestUse: "Use the ease to build something concrete.",
      trap: "Comfort mode that postpones real conversations.",
      move: "Convert one easy win into a repeatable habit this week.",
    },
    Sextile: {
      dynamic: "This is a practical opportunity channel.",
      bestUse: "Use it to collaborate with low friction.",
      trap: "Waiting for momentum instead of creating it.",
      move: "Schedule one concrete action in 48 hours and execute it.",
    },
  },
  carioca: {
    Conjunction: {
      dynamic: "Aqui a energia gruda forte pra caralho.",
      bestUse: "Serve pra alinhar direcao e ritmo rapido.",
      trap: "Misturar papel dos dois ate virar bagunca.",
      move: "Divide responsabilidade no claro antes da proxima decisao grande.",
    },
    Opposition: {
      dynamic: "E eixo de puxa-puxa: atrai e irrita ao mesmo tempo.",
      bestUse: "Usa a diferenca pra enxergar ponto cego.",
      trap: "Transformar divergencia em treta repetida.",
      move: "Faz combinado simples: o que e fixo e o que da pra negociar.",
    },
    Square: {
      dynamic: "Atrito na lata que cobra crescimento.",
      bestUse: "Vira combustivel pra evoluir postura e habilidade.",
      trap: "Brigar do mesmo jeito e esperar resultado novo.",
      move: "Escolhe um conflito recorrente e testa uma regra nova essa semana.",
    },
    Trine: {
      dynamic: "Flui facil e da sintonia forte.",
      bestUse: "Aproveita essa moleza pra construir algo concreto.",
      trap: "Relaxar demais e empurrar conversa importante.",
      move: "Pega um acerto facil e transforma em habito fixo.",
    },
    Sextile: {
      dynamic: "Canal de oportunidade bem pratico.",
      bestUse: "Bom pra cooperar sem desgaste desnecessario.",
      trap: "Esperar milagre em vez de agir.",
      move: "Marca uma acao objetiva nas proximas 48h e cumpre.",
    },
  },
};

function dedupeTags(tags: readonly string[]): string[] {
  return Array.from(new Set(tags.filter(Boolean)));
}

function joinTags(tags: readonly string[], mode: Mode, limit = 4): string {
  const picked = tags.slice(0, limit);
  if (picked.length === 0) {
    return mode === "carioca" ? "sem palavra-chave mapeada ainda" : "no keywords mapped yet";
  }
  if (picked.length === 1) return picked[0];
  const head = picked.slice(0, -1).join(", ");
  const tail = picked[picked.length - 1];
  return mode === "carioca" ? `${head} e ${tail}` : `${head} and ${tail}`;
}

function getOrbIntensity(orb: number | undefined, mode: Mode): string {
  if (orb == null) {
    return mode === "carioca"
      ? "Sem orb definido; considera intensidade media."
      : "No orb provided; treat intensity as moderate.";
  }
  if (orb <= 1) {
    return mode === "carioca"
      ? "Orb bem fechado: impacto alto no cotidiano."
      : "Very tight orb: high day-to-day impact.";
  }
  if (orb <= 3) {
    return mode === "carioca"
      ? "Orb medio: influencia constante quando o tema aparece."
      : "Moderate orb: steady influence when this theme is triggered.";
  }
  return mode === "carioca"
    ? "Orb mais aberto: aparece de forma mais sutil."
    : "Wider orb: influence is subtler unless activated.";
}

function buildPlanetSignDetails(input: {
  mode: Mode;
  planet: PlanetName;
  sign: ZodiacSign;
  element: ElementName;
  degree?: number;
  tags: readonly string[];
}): DetailBlock[] {
  const { mode, planet, sign, element, degree, tags } = input;
  const style = ELEMENT_STYLE[mode][element];
  const nearCusp = degree != null && (degree <= 2 || degree >= 27.5);
  const keywordText = joinTags(tags, mode);

  const base: DetailBlock[] =
    mode === "carioca"
      ? [
          {
            title: "Como isso aparece no dia a dia",
            text: `${planet} em ${sign} tende a ${PLANET_INTENT[mode][planet]}. No elemento ${element}, a alavanca principal e: ${style.leverage}`,
          },
          {
            title: "Pontos fortes pra usar",
            text: `As palavras-chave mais quentes aqui sao ${keywordText}. Se usar isso com intencao, o mapa rende bem mais.`,
          },
          {
            title: "Onde pode dar ruim",
            text: `${style.trap} Quando pintar estresse, volta pro basico antes de reagir no impulso.`,
          },
          {
            title: "Plano pratico da semana",
            text: style.action,
          },
        ]
      : [
          {
            title: "How this shows up day to day",
            text: `${planet} in ${sign} tends to ${PLANET_INTENT[mode][planet]}. In the ${element} element, your leverage lane is: ${style.leverage}`,
          },
          {
            title: "Strengths to leverage",
            text: `Top keywords here are ${keywordText}. Using them deliberately increases consistency fast.`,
          },
          {
            title: "Where it can derail",
            text: `${style.trap} Under stress, return to basics before reacting.`,
          },
          {
            title: "Practical move this week",
            text: style.action,
          },
        ];

  if (!nearCusp || degree == null) return base;

  const cuspDetail: DetailBlock =
    mode === "carioca"
      ? {
          title: "Nota de grau",
          text: `Esse planeta ta perto da borda do signo (${degree.toFixed(1)}deg). Vale observar os temas do signo vizinho junto.`,
        }
      : {
          title: "Degree note",
          text: `This planet is near a sign cusp (${degree.toFixed(1)}deg). Track overlap with the neighboring sign themes.`,
        };

  return [...base, cuspDetail];
}

function buildAspectDetails(input: {
  mode: Mode;
  type: AspectName;
  a: PlanetName;
  b: PlanetName;
  orb?: number;
  tags: readonly string[];
}): DetailBlock[] {
  const { mode, type, a, b, orb, tags } = input;
  const playbook = ASPECT_PLAYBOOK[mode][type];
  const keywordText = joinTags(tags, mode, 3);
  const orbText = getOrbIntensity(orb, mode);

  if (mode === "carioca") {
    return [
      {
        title: "Dinamica desse aspecto",
        text: `${a} x ${b}: ${playbook.dynamic}`,
      },
      {
        title: "Onde rende melhor",
        text: `${playbook.bestUse} Temas mais ativos: ${keywordText}.`,
      },
      {
        title: "Armadilha comum",
        text: `${playbook.trap} ${orbText}`,
      },
      {
        title: "Ajuste pratico",
        text: playbook.move,
      },
    ];
  }

  return [
    {
      title: "Aspect dynamic",
      text: `${a} x ${b}: ${playbook.dynamic}`,
    },
    {
      title: "Best lane",
      text: `${playbook.bestUse} Most active themes: ${keywordText}.`,
    },
    {
      title: "Common trap",
      text: `${playbook.trap} ${orbText}`,
    },
    {
      title: "Practical adjustment",
      text: playbook.move,
    },
  ];
}


export function buildPlacementsSummary(chart: ChartResult): PlacementSummary[] {
  const summaries: PlacementSummary[] = [];
  for (const planet of PLANETS) {
    const placement = chart.planets[planet];
    if (!placement) continue;
    summaries.push({
      planet,
      sign: placement.sign,
      degree: placement.degree,
      planetSymbol: PLANET_SYMBOL[planet],
      signSymbol: SIGN_SYMBOL[placement.sign],
      element: SIGN_ELEMENT[placement.sign],
    });
  }
  return summaries;
}

export function buildCards(
  content: ContentPack,
  chart: ChartResult,
  mode: Mode
): CardModel[] {
  const cards: CardModel[] = [];
  const usedKeys = new Set<string>();
  const labels = {
    planetPlacement: mode === "carioca" ? "Posicao planetaria" : "Planet placement",
    aspect: mode === "carioca" ? "Aspecto" : "Aspect",
  };

  function addCard(
    key: string,
    category: CardCategory,
    title: string,
    entry: Entry | undefined,
    options?: {
      subtitle?: string;
      textOverride?: string;
      details?: readonly DetailBlock[];
      planet?: PlanetName;
      sign?: ZodiacSign;
      element?: ElementName;
      degree?: number;
      planetSymbol?: string;
      signSymbol?: string;
      orb?: number;
    }
  ) {
    if (!entry || usedKeys.has(key)) return;
    usedKeys.add(key);
    cards.push({
      key,
      category,
      title,
      subtitle: options?.subtitle,
      text: options?.textOverride ?? entry.text,
      tags: entry.tags,
      details: options?.details,
      planet: options?.planet,
      sign: options?.sign,
      element: options?.element,
      degree: options?.degree,
      planetSymbol: options?.planetSymbol,
      signSymbol: options?.signSymbol,
      orb: options?.orb,
    });
  }

  // Add planet-sign cards for each planet
  for (const planet of PLANETS) {
    const placement = chart.planets[planet];
    if (!placement) continue;

    const signEntry = content.sign[placement.sign];
    const planetEntry = content.planet[planet];
    const pSym = PLANET_SYMBOL[planet];
    const sSym = SIGN_SYMBOL[placement.sign];
    const element = SIGN_ELEMENT[placement.sign];

    if (signEntry) {
      const inWord = mode === "carioca" ? "em" : "in";
      const subtitle = `${pSym} ${planet} ${inWord} ${placement.sign} ${sSym}`;
      const detailTags = dedupeTags([...(planetEntry?.tags ?? []), ...signEntry.tags]);
      addCard(
        `planet-sign-${planet}-${placement.sign}`,
        "planet-sign",
        `${planet} · ${signEntry.title}`,
        signEntry,
        {
          subtitle: planetEntry
            ? `${labels.planetPlacement} · ${subtitle} · ${planetEntry.title}`
            : `${labels.planetPlacement} · ${subtitle}`,
          details: buildPlanetSignDetails({
            mode,
            planet,
            sign: placement.sign,
            element,
            degree: placement.degree,
            tags: detailTags,
          }),
          planet,
          sign: placement.sign,
          element,
          degree: placement.degree,
          planetSymbol: pSym,
          signSymbol: sSym,
        }
      );
    }
  }

  // Add aspect cards (limit to 12)
  let aspectCount = 0;
  for (const aspect of chart.aspects) {
    if (aspectCount >= 12) break;

    const aspectEntry = content.aspect[aspect.type];
    if (!aspectEntry) continue;

    const key = `aspect-${aspect.a}-${aspect.b}-${aspect.type}`;
    if (usedKeys.has(key)) continue;

    const symbol = aspectSymbol(aspect.type);
    const pairLine = formatPairLine(aspect.a, aspect.b, aspect.type, mode);
    const text = `${aspectEntry.text}\n\n${pairLine}`;
    const pairTitle = `${aspect.a} ${symbol} ${aspect.b}`;
    const detailTags = dedupeTags(aspectEntry.tags);

    addCard(key, "aspect", pairTitle, aspectEntry, {
      subtitle: `${labels.aspect} · ${aspect.type} · ${aspectEntry.title}`,
      textOverride: text,
      details: buildAspectDetails({
        mode,
        type: aspect.type,
        a: aspect.a,
        b: aspect.b,
        orb: aspect.orb,
        tags: detailTags,
      }),
      orb: aspect.orb,
    });
    aspectCount++;
  }

  return cards;
}
