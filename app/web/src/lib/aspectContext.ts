import { ASPECT_SYMBOL } from "./constants";
import type { AspectName, PlanetName } from "./types";

export type Mode = "normal" | "carioca";

const PLANET_GLOSSARY: Record<PlanetName, { normal: string; carioca: string }> = {
  Sun: { normal: "identity/ego/willpower", carioca: "ego/identidade, o chefe do role" },
  Moon: { normal: "emotion/security/habits", carioca: "emocao/seguranca, coracao mole" },
  Mercury: { normal: "mind/communication", carioca: "mente/comunicacao, a lingua solta" },
  Venus: {
    normal: "values/relationships/pleasure",
    carioca: "valores/relacao/prazer, o que da tesao",
  },
  Mars: { normal: "action/desire/drive", carioca: "acao/desejo/raiva, sangue no olho" },
  Jupiter: {
    normal: "expansion/belief/optimism",
    carioca: "expansao/crenca/otimismo, exagero sem freio",
  },
  Saturn: {
    normal: "limits/responsibility/discipline",
    carioca: "limite/responsabilidade/medo, o fiscal chato",
  },
  Uranus: { normal: "disruption/freedom", carioca: "ruptura/liberdade, quebra-tudo" },
  Neptune: {
    normal: "dreams/illusion/imagination",
    carioca: "sonho/neblina/idealizacao, viagem",
  },
  Pluto: {
    normal: "intensity/power/transformation",
    carioca: "intensidade/poder/transformacao, pancada no fundo",
  },
};

const ASPECT_TONE: Partial<Record<AspectName, { normal: string; carioca: string }>> = {
  Conjunction: {
    normal: "merges and blends their themes into a single direction",
    carioca: "gruda tudo num bolo so; se vacilar vira bagunca do caralho",
  },
  Opposition: {
    normal: "creates tension between poles, demanding balance",
    carioca: "um puxa pra um lado, outro pro outro; sem equilibrio vira treta do caralho",
  },
  Square: {
    normal: "generates friction and pressure, requiring adjustment",
    carioca: "atrito e pressao na lata; se enrolar, trava e da merda",
  },
  Trine: {
    normal: "flows with natural ease and talent",
    carioca: "flui facil demais, conforto que deixa preguicoso pra caralho",
  },
  Sextile: {
    normal: "opens opportunity, but requires initiative",
    carioca: "tem chance boa, mas se ficar parado perde a porra toda",
  },
  Quincunx: {
    normal: "demands practical adjustments and better coordination",
    carioca: "pede ajuste fino pra nao virar ruido chato",
  },
  Semisextile: {
    normal: "offers subtle support when both sides act intentionally",
    carioca: "da apoio sutil, mas so rende com atitude",
  },
  Semisquare: {
    normal: "creates low-grade friction that can build up",
    carioca: "atrito miudo que acumula se ignorar",
  },
  Sesquiquadrate: {
    normal: "adds background pressure and awkward timing",
    carioca: "pressao de fundo e timing esquisito",
  },
  Quintile: {
    normal: "highlights creative synergy and skill building",
    carioca: "ativa criatividade e talento junto",
  },
  Biquintile: {
    normal: "sharpens strategy through creative focus",
    carioca: "afina estrategia com criatividade focada",
  },
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
  const tone =
    ASPECT_TONE[type]?.[mode] ??
    (mode === "carioca"
      ? "mistura energia dos dois de um jeito que pede consciencia"
      : "blends both themes in a way that needs conscious handling");
  const connector = mode === "carioca" ? "e" : "and";
  return `${a} (${aDesc}) ${connector} ${b} (${bDesc}): ${tone}.`;
}
