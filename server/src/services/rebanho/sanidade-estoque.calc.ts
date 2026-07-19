// Cálculo puro: decide se um evento sanitário deve gerar baixa de estoque (SAIDA) e monta o
// payload. Sem I/O. A baixa só ocorre quando o evento CONSOME um produto do estoque, i.e.:
//  - o tipo é de consumo (APLICACAO de medicamento ou VACINA);
//  - há um produtoId (produto vinculado ao estoque, não texto livre);
//  - a quantidade usada é positiva.
// O valor é qtd × custo unitário (custo 0 quando desconhecido — a baixa física ainda vale).

const TIPOS_CONSOMEM_ESTOQUE = new Set(["APLICACAO", "VACINA"]);

export interface BaixaSanidadeIn {
  tipo: string;
  produtoId: number | null;
  quantidadeUsada: number | null;
  custoUnitario: number | null;
}

export interface BaixaSanidadePlan {
  produtoId: number;
  quantidade: number;
  custoUnitario: number;
  valorTotal: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function planejarBaixaSanidade(input: BaixaSanidadeIn): BaixaSanidadePlan | null {
  if (!TIPOS_CONSOMEM_ESTOQUE.has(input.tipo)) return null;
  if (input.produtoId == null) return null;
  const qtd = input.quantidadeUsada;
  if (qtd == null || qtd <= 0) return null;
  const custo = input.custoUnitario ?? 0;
  return { produtoId: input.produtoId, quantidade: qtd, custoUnitario: custo, valorTotal: round2(qtd * custo) };
}
