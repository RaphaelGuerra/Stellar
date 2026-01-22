import type { AspectName, PlanetName } from "./types";

export type Mode = "normal" | "carioca";

const PLANET_GLOSSARY: Record<PlanetName, { normal: string; carioca: string }> = {
  Sun: { normal: "identidade/ego/vontade", carioca: "ego/identidade, o chefe do role" },
  Moon: { normal: "emocao/seguranca/habitos", carioca: "emocao/seguranca, coracao mole" },
  Mercury: { normal: "mente/comunicacao", carioca: "mente/comunicacao, a lingua solta" },
  Venus: {
    normal: "valores/relacionamento/prazer",
    carioca: "valores/relacao/prazer, o que da tesao",
  },
  Mars: { normal: "acao/desejo/raiva", carioca: "acao/desejo/raiva, sangue no olho" },
  Jupiter: {
    normal: "expansao/crenca/otimismo",
    carioca: "expansao/crenca/otimismo, exagero sem freio",
  },
  Saturn: {
    normal: "limite/responsabilidade/medo",
    carioca: "limite/responsabilidade/medo, o fiscal chato",
  },
  Uranus: { normal: "ruptura/liberdade", carioca: "ruptura/liberdade, quebra-tudo" },
  Neptune: {
    normal: "sonho/neblina/idealizacao",
    carioca: "sonho/neblina/idealizacao, viagem",
  },
  Pluto: {
    normal: "intensidade/poder/transformacao",
    carioca: "intensidade/poder/transformacao, pancada no fundo",
  },
};

const ASPECT_TONE: Record<AspectName, { normal: string; carioca: string }> = {
  Conjunction: {
    normal: "une e mistura os temas numa so direcao",
    carioca: "gruda tudo num bolo so; se vacilar vira bagunca do caralho",
  },
  Opposition: {
    normal: "cria tensao entre polos e pede equilibrio",
    carioca: "um puxa pra um lado, outro pro outro; sem equilibrio vira treta do caralho",
  },
  Square: {
    normal: "gera atrito e pressao, exigindo ajuste",
    carioca: "atrito e pressao na lata; se enrolar, trava e da merda",
  },
  Trine: {
    normal: "flui com facilidade e talento natural",
    carioca: "flui facil demais, conforto que deixa preguicoso pra caralho",
  },
  Sextile: {
    normal: "abre oportunidade, mas pede iniciativa",
    carioca: "tem chance boa, mas se ficar parado perde a porra toda",
  },
};

const ASPECT_SYMBOL: Record<AspectName, string> = {
  Conjunction: "☌",
  Opposition: "☍",
  Square: "□",
  Trine: "△",
  Sextile: "✶",
};

export function aspectSymbol(type: AspectName): string {
  return ASPECT_SYMBOL[type];
}

export function formatPairLine(
  a: PlanetName,
  b: PlanetName,
  type: AspectName,
  mode: Mode
): string {
  const aDesc = PLANET_GLOSSARY[a][mode];
  const bDesc = PLANET_GLOSSARY[b][mode];
  const tone = ASPECT_TONE[type][mode];
  return `${a} (${aDesc}) e ${b} (${bDesc}): ${tone}.`;
}
