// Cálculo puro: decide se um evento sanitário deve gerar baixa de estoque (SAIDA) e monta o
// payload. Sem I/O. A baixa só ocorre quando o evento CONSOME um produto do estoque, i.e.:
//  - o tipo é de consumo (APLICACAO de medicamento ou VACINA);
//  - há um produtoId (produto vinculado ao estoque, não texto livre);
//  - o produto tem estoque no sítio (alguma entrada/ajuste confirmado — resolvido
//    por quem chama via produtoTemEstoque; o cadastro não diz se é estocado);
//  - a quantidade usada é positiva.
// O valor sai da base do custo médio do sítio (Σ quantidade, Σ valor — carregada por quem
// chama), sem arredondar o custo unitário antes de multiplicar; sem base → 0 (a baixa física
// ainda vale). Decimais via Prisma.Decimal.
import { Prisma } from "@prisma/client";
import { valorSaidaDaBase, type BaseCusto } from "../estoque/estoque.calc.js";

const TIPOS_CONSOMEM_ESTOQUE = new Set(["APLICACAO", "VACINA"]);

export interface BaixaSanidadeIn {
  tipo: string;
  produtoId: number | null;
  temEstoque: boolean;
  quantidadeUsada: number | null;
  baseCusto: BaseCusto | null;
}

export interface BaixaSanidadePlan {
  produtoId: number;
  quantidade: Prisma.Decimal;
  custoUnitario: Prisma.Decimal;
  valorTotal: Prisma.Decimal;
}

export function planejarBaixaSanidade(input: BaixaSanidadeIn): BaixaSanidadePlan | null {
  if (!TIPOS_CONSOMEM_ESTOQUE.has(input.tipo)) return null;
  if (input.produtoId == null) return null;
  if (!input.temEstoque) return null;
  const qtd = input.quantidadeUsada;
  if (qtd == null || qtd <= 0) return null;
  const quantidade = new Prisma.Decimal(qtd);
  return { produtoId: input.produtoId, quantidade, ...valorSaidaDaBase(quantidade, input.baseCusto) };
}
