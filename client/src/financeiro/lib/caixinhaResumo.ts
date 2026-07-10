/* Resumo mensal da caixinha (diário de gastos) — função pura, testada.
 * Recebe os movimentos de UM mês (o backend já filtra por ?mes=) e deriva os
 * números do mini dashboard: contagem de gastos, total, média, maior gasto e
 * quebra por categoria. Não bate no backend — só agrega o que já veio. */

import type { CategoriaCaixinha, MovimentoCaixinhaDTO } from "../api";

export const CATEGORIAS: CategoriaCaixinha[] = [
  "ALIMENTACAO",
  "COMBUSTIVEL",
  "MERCADO",
  "INSUMOS",
  "MANUTENCAO",
  "OUTROS",
];

export const CATEGORIA_LABEL: Record<CategoriaCaixinha, string> = {
  ALIMENTACAO: "Alimentação",
  COMBUSTIVEL: "Combustível",
  MERCADO: "Mercado",
  INSUMOS: "Insumos",
  MANUTENCAO: "Manutenção",
  OUTROS: "Outros",
};

export interface CategoriaTotal {
  categoria: CategoriaCaixinha;
  total: number;
}

export interface ResumoMes {
  qtdGastos: number; // nº de SAIDA — a "quantidade de itens" do mês
  totalGasto: number; // Σ SAIDA
  totalEntradas: number; // Σ ENTRADA
  mediaGasto: number; // totalGasto / qtdGastos (0 se nenhum)
  maiorGasto: { valor: number; descricao: string } | null;
  porCategoria: CategoriaTotal[]; // ordenado por total desc; sem SAIDA → []
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function resumirMes(movimentos: MovimentoCaixinhaDTO[]): ResumoMes {
  let qtdGastos = 0;
  let totalGasto = 0;
  let totalEntradas = 0;
  let maiorGasto: { valor: number; descricao: string } | null = null;
  const porCat = new Map<CategoriaCaixinha, number>();

  for (const m of movimentos) {
    if (m.tipo === "ENTRADA") {
      totalEntradas += m.valor;
      continue;
    }
    // SAIDA (gasto)
    qtdGastos += 1;
    totalGasto += m.valor;
    if (!maiorGasto || m.valor > maiorGasto.valor) {
      maiorGasto = { valor: m.valor, descricao: m.descricao };
    }
    // SAIDA sem categoria (linhas antigas) cai em OUTROS.
    const cat: CategoriaCaixinha = m.categoria ?? "OUTROS";
    porCat.set(cat, (porCat.get(cat) ?? 0) + m.valor);
  }

  const porCategoria: CategoriaTotal[] = [...porCat.entries()]
    .map(([categoria, total]) => ({ categoria, total: round2(total) }))
    .sort((a, b) => b.total - a.total);

  return {
    qtdGastos,
    totalGasto: round2(totalGasto),
    totalEntradas: round2(totalEntradas),
    mediaGasto: qtdGastos > 0 ? round2(totalGasto / qtdGastos) : 0,
    maiorGasto,
    porCategoria,
  };
}
