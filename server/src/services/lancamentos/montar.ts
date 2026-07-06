// Núcleo puro (sem Prisma) que monta o shape `DadosLancamentoNovo` a partir do
// payload já validado da rota + os valores resolvidos (valor positivo em
// string, data como Date, clienteFornecedorId resolvido). Fica isolado aqui
// pra ser testável sem banco: é onde moram as regras de natureza, de
// dataLiquidacao (pago → mesma data; senão null → ABERTO) e das datas de
// competência/vencimento.

import type { DadosLancamentoNovo } from "../notaFiscal/confirmarPendente.js";

// Só os campos do payload que influenciam a montagem — mantém a função pura e
// desacoplada do schema Zod completo da rota.
export type PayloadMontagem = {
  natureza: "DEBITO" | "CREDITO";
  categoriaId: number;
  centroCustoId: number;
  contaBancariaId?: number | null;
  pago: boolean;
  descricao?: string | null;
  numeroDocumento?: string | null;
};

// Valores já resolvidos fora (parse BR + upsert/lookup de fornecedor).
export type ValoresResolvidos = {
  valor: string; // sempre positivo, "38450.00"
  data: Date; // competência = vencimento = data informada
  clienteFornecedorId: number | null;
  // Sítio resolvido pelo escopo do request (multi-propriedade). Ausente → null
  // (consolidado / fazenda de 1 sítio, onde a rota já resolve a principal).
  propriedadeId?: number | null;
};

export function montarDadosLancamento(
  payload: PayloadMontagem,
  resolvidos: ValoresResolvidos,
): DadosLancamentoNovo {
  // pago=true → LIQUIDADO com a mesma data de caixa; senão fica ABERTO (null).
  const dataLiquidacao = payload.pago ? resolvidos.data : null;
  return {
    natureza: payload.natureza,
    valor: resolvidos.valor,
    dataCompetencia: resolvidos.data,
    dataVencimento: resolvidos.data,
    dataLiquidacao,
    categoriaId: payload.categoriaId,
    centroCustoId: payload.centroCustoId,
    contaBancariaId: payload.contaBancariaId ?? null,
    clienteFornecedorId: resolvidos.clienteFornecedorId,
    propriedadeId: resolvidos.propriedadeId ?? null,
    descricao: payload.descricao ?? null,
    numeroDocumento: payload.numeroDocumento ?? null,
  };
}
