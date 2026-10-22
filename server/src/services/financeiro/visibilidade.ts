import type { Context } from "hono";
import { getUsuario } from "../../middleware/permissao.js";
import { temArea, temPermissao } from "../auth/papeis.js";

export function podeVerValores(c: Context) {
  const u = getUsuario(c);
  return !!u && temArea(u, "financeiro") && temPermissao(u, "verValores");
}

// Contratos explícitos: só estes caminhos monetários são mascarados. Não se
// inferem campos por regex/nome; quantidade, saldo físico, IDs e contagens ficam.
type Contrato = { readonly [campo: string]: true | Contrato };
export type Mascarado<T, C extends Contrato> = T extends readonly (infer I)[] ? Mascarado<I, C>[] : T extends object ? {
  [K in keyof T]: K extends keyof C ? C[K] extends true ? T[K] | null : C[K] extends Contrato ? Mascarado<T[K], C[K]> : T[K] : T[K]
} : T;
export function mascararDto<T, C extends Contrato>(dados: T, contrato: C): Mascarado<T, C> {
  if (Array.isArray(dados)) return dados.map(item => mascararDto(item, contrato)) as Mascarado<T, C>;
  if (!dados || typeof dados !== "object") return dados as Mascarado<T, C>;
  const copia: Record<string, unknown> = Object.fromEntries(Object.entries(dados));
  for (const [campo, regra] of Object.entries(contrato)) {
    if (Object.hasOwn(copia, campo)) copia[campo] = regra === true ? null : mascararDto(copia[campo], regra);
  }
  return copia as Mascarado<T, C>;
}

export const valoresConta = { saldoAbertura: true, saldoAtual: true } as const;
export const valoresMovimentoEstoque = { custoUnitario: true, valorTotal: true, valorTotalMovimento: true, evidenciaValor: true } as const;
export const valoresTransacao = { valorTotal: true, movimentos: { valor: true }, liquidacoes: { valor: true }, operacao: { valorTotal: true } } as const;
export const valoresCompromisso = {
  valorOriginal: true, valorLiquidado: true, saldoPendente: true, saldoExigivel: true,
  operacao: { valorTotal: true }, liquidacoes: { valor: true, transacao: valoresTransacao },
} as const;
const valoresProcedimento = { valorProdutoAtribuido: true, valorServicoAtribuido: true } as const;
export const valoresOperacao = {
  valorTotal: true, composicaoComercial: true, itens: { valorUnitario: true, valorTotal: true, valorProdutoAtribuido: true, valorServicoAtribuido: true },
  compromissos: valoresCompromisso, transacoes: valoresTransacao, movimentosEstoque: valoresMovimentoEstoque,
  perdas: valoresMovimentoEstoque, transferencias: valoresMovimentoEstoque, procedimentosServico: { valor: true }, referenciaValor: true, evidenciaValor: true,
  procedimentosSanitarios: { aplicacoes: valoresProcedimento, exames: valoresProcedimento, execucoes: valoresProcedimento, protocolos: valoresProcedimento, tentativas: valoresProcedimento },
  resumoCancelamento: { compromissos: valoresCompromisso, transacoes: valoresTransacao, impactosPorConta: { entrada: true, saida: true } },
} as const;

export function apresentarValores<T, C extends Contrato>(c: Context, dados: T, contrato: C): T | Mascarado<T, C> {
  return podeVerValores(c) ? dados : mascararDto(dados, contrato);
}
