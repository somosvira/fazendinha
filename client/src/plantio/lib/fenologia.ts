import type { FaseFenologica } from "../types";

/* Calendário fenológico do café arábica no Sul de Minas (~1.000–1.200 m).
 * Baseado em: Camargo & Camargo (2001), Embrapa Café (Manual do Café/Emater),
 * Procafé/CHB Agro. A florada principal é disparada pelas primeiras chuvas
 * de setembro/outubro; o ciclo completo do fruto é ~32-35 semanas em Coffea
 * arabica L. */

export const FASES_LABEL: Record<FaseFenologica, string> = {
  REPOUSO: "Repouso vegetativo",
  INDUCAO_FLORAL: "Indução floral",
  FLORADA: "Florada",
  CHUMBINHO: "Pegamento (chumbinho)",
  EXPANSAO: "Expansão dos frutos",
  GRANACAO: "Granação",
  MATURACAO_VERDE: "Maturação verde",
  MATURACAO_CEREJA: "Maturação cereja",
  COLHEITA: "Colheita",
  POS_COLHEITA: "Pós-colheita",
};

export const FASES_DESCRICAO: Record<FaseFenologica, string> = {
  REPOUSO: "Senescência de ramos, dormência das gemas florais. Mês ideal para esqueletamento, decote e recepa.",
  INDUCAO_FLORAL: "Diferenciação das gemas em estágio G4. Estresse hídrico controlado favorece uniformidade da florada.",
  FLORADA: "Antese disparada por chuva ≥ 15 mm após repouso seco. Polinização em 48-72 h. Sensível a geada e estresse.",
  CHUMBINHO: "Frutos do tamanho de chumbo de caça (0-50 DAA). Fase crítica para pegamento e abortamento.",
  EXPANSAO: "Crescimento rápido em tamanho. Demanda de água e B alta.",
  GRANACAO: "Formação do endosperma. Maior pico de absorção de N e K. Janela crítica do parcelamento da adubação.",
  MATURACAO_VERDE: "Frutos completamente desenvolvidos mas com clorofila. Sem maturação açucarada.",
  MATURACAO_CEREJA: "Antocianina substitui clorofila. Ponto ótimo para colheita (qualidade da bebida).",
  COLHEITA: "Derriça ativa — pano, mecanizada ou seletiva. Atenção a uniformidade do estádio.",
  POS_COLHEITA: "Recuperação da planta. Calagem, gessagem, esqueletamento dos exaustos, gestão de bienalidade.",
};

/* Janelas típicas para o Sul de Minas (mês de início). Para latitudes menores
 * (Cerrado) ou maiores (Chapada Diamantina), as datas deslocam +/- 30 dias. */
export const JANELA_PADRAO: Array<{ fase: FaseFenologica; mesInicio: number }> = [
  { fase: "POS_COLHEITA",    mesInicio: 7 },  // jul
  { fase: "REPOUSO",         mesInicio: 7 },  // jul/ago
  { fase: "INDUCAO_FLORAL",  mesInicio: 8 },  // ago
  { fase: "FLORADA",         mesInicio: 9 },  // set
  { fase: "CHUMBINHO",       mesInicio: 10 }, // out
  { fase: "EXPANSAO",        mesInicio: 11 }, // nov/dez
  { fase: "GRANACAO",        mesInicio: 1 },  // jan
  { fase: "MATURACAO_VERDE", mesInicio: 4 },  // abr
  { fase: "MATURACAO_CEREJA", mesInicio: 5 }, // mai
  { fase: "COLHEITA",        mesInicio: 5 },  // mai/jun
];

/* Para uma data ISO, retorna a fase fenológica "padrão" do calendário Sul Minas.
 * Útil para classificar talhões sem resumo. */
export function faseDaData(iso: string): FaseFenologica {
  const m = new Date(iso).getMonth() + 1;
  // ordem decrescente do mês para pegar a janela mais próxima passada
  const ordenado = [...JANELA_PADRAO].sort((a, b) => a.mesInicio - b.mesInicio);
  // mês atual ≥ mesInicio
  let atual: FaseFenologica = "REPOUSO";
  for (const j of ordenado) {
    if (m >= j.mesInicio) atual = j.fase;
  }
  // wraparound (jan-feb ainda é GRANACAO da safra do ano anterior)
  if (m <= 3) atual = "GRANACAO";
  return atual;
}
