// Cálculo puro: decide se uma operação agrícola (adubação/aplicação) deve gerar
// baixa de estoque (SAIDA) e monta a quantidade total consumida, já convertida
// para a unidade do produto do estoque. Espelha rebanho/sanidade-estoque.calc.ts.
// Sem I/O.
//
// A dose é sempre informada como doseValor + doseUnidadeMedida (+ dosePorHectare,
// quando a dose é "por hectare" e precisa ser multiplicada pela área do
// talhão). O total resultante é convertido para a unidade do produto
// (services/estoque/unidades.ts) — só é possível quando as duas unidades têm a
// mesma base (ex.: mL → L, g → kg); bases diferentes (ex.: mL → kg) lançam
// erro em vez de baixar estoque errado.
import type { UnidadeMedida } from "@prisma/client";
import { converterQuantidade, rotuloUnidade } from "../estoque/unidades.js";

export interface PlanejarBaixaAplicacaoIn {
  produtoId: number | null | undefined;
  estocavel: boolean;
  produtoUnidade: UnidadeMedida;
  doseValor: number | null | undefined;
  doseUnidadeMedida: UnidadeMedida | null | undefined;
  dosePorHectare: boolean | null | undefined;
  areaHa: number | null | undefined;
  quantidadeTotalInformada?: number | null;
}

export interface PlanejarBaixaAplicacaoOut {
  quantidade: number;
  deveBaixar: boolean;
}

export function planejarBaixaAplicacao(input: PlanejarBaixaAplicacaoIn): PlanejarBaixaAplicacaoOut {
  let quantidade = 0;
  if (input.quantidadeTotalInformada != null) {
    // Quantidade total informada explicitamente já vem na unidade do produto.
    quantidade = input.quantidadeTotalInformada;
  } else if (input.doseValor != null && input.doseUnidadeMedida != null) {
    const porHectare = !!input.dosePorHectare;
    const bruta = porHectare ? input.doseValor * (input.areaHa ?? 0) : input.doseValor;
    quantidade = converterQuantidade(bruta, input.doseUnidadeMedida, input.produtoUnidade).toNumber();
  }
  quantidade = Math.round(quantidade * 1000) / 1000;
  const deveBaixar = !!input.produtoId && input.estocavel && quantidade > 0;
  return { quantidade, deveBaixar };
}

// Texto legado (histórico/exibição) gravado em OperacaoAgricola.doseUnidade a
// partir dos campos novos — ex.: "mL/ha", "kg".
export function textoDoseUnidade(unidade: UnidadeMedida | null | undefined, porHectare: boolean | null | undefined): string | null {
  if (!unidade) return null;
  return `${rotuloUnidade(unidade)}${porHectare ? "/ha" : ""}`;
}

const MAPA_UNIDADE_LEGADA: Record<string, UnidadeMedida> = {
  un: "UN", kg: "KG", g: "G", t: "T",
  l: "L", ml: "ML",
  sc: "SC", saco: "SC", sacos: "SC",
  dose: "DOSE", doses: "DOSE",
  cx: "CX", caixa: "CX",
  m: "M", ha: "HA",
};

// Compatibilidade: converte o texto livre legado de OperacaoAgricola.doseUnidade
// (ex.: "L/ha", "kg", "mL/ha") nos campos novos, quando o input não manda
// doseUnidadeMedida/dosePorHectare diretamente.
// `reconhecida: false` distingue "veio texto mas não sabemos interpretar" (ex.:
// "lt/ha", "cc/ha") de "nada foi informado" (texto vazio/nulo) — quem chama
// decide se isso é erro (ver timeline.ts).
export function parseDoseUnidadeLegada(texto: string | null | undefined): { unidade: UnidadeMedida | null; porHectare: boolean; reconhecida: boolean } {
  if (!texto || !texto.trim()) return { unidade: null, porHectare: false, reconhecida: true };
  const bruto = texto.trim().toLowerCase();
  const porHectare = bruto.endsWith("/ha");
  const chave = (porHectare ? bruto.slice(0, -3) : bruto).trim();
  const unidade = MAPA_UNIDADE_LEGADA[chave] ?? null;
  return { unidade, porHectare, reconhecida: unidade != null };
}
