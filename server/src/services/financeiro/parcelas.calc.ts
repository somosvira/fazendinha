import { Prisma } from "@prisma/client";
import * as shared from "@rionovo/shared";
import { FinanceiroError } from "./regras.js";

/** Converte o erro de validação do cálculo compartilhado em FinanceiroError, com a mesma mensagem e campo. */
export function comoErroFinanceiro<T>(calcular: () => T): T {
  try {
    return calcular();
  } catch (erro) {
    if (erro instanceof shared.ErroValidacaoFinanceira) throw new FinanceiroError("VALIDACAO", erro.message, erro.campo);
    throw erro;
  }
}

export function simularParcelas(input: shared.SimulacaoParcelasValidada) {
  const simulacao = comoErroFinanceiro(() => shared.simularParcelas(input));
  return {
    totalOperacao: new Prisma.Decimal(simulacao.totalOperacao),
    valorPagoAgora: new Prisma.Decimal(simulacao.valorPagoAgora),
    saldoAPrazo: new Prisma.Decimal(simulacao.saldoAPrazo),
    parcelas: simulacao.parcelas.map((parcela) => ({ ...parcela, valor: new Prisma.Decimal(parcela.valor) })),
  };
}
