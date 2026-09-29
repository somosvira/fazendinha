import { ErroValidacaoFinanceira, simulacaoParcelasSchema, simularParcelas } from "@rionovo/shared";
import { ApiError, type SimulacaoParcelas } from "../novo-api";
export type FrequenciaParcelas = "SEMANAL" | "MENSAL";

const inteiro = (valor: unknown): valor is string => typeof valor === "string" && /^\d+(?:[.,]\d{0,2})?$/.test(valor.trim());

export function paraCentavos(valor: unknown): number | null {
  if (!inteiro(valor)) return null;
  const [inteiroParte, decimal = ""] = valor.trim().replace(",", ".").split(".");
  const centavos = Number(inteiroParte) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(centavos) ? centavos : null;
}

export function deCentavos(centavos: number) {
  return (centavos / 100).toFixed(2);
}

export function somarParcelas(parcelas: readonly { valor: string }[]) {
  return parcelas.reduce((soma, parcela) => soma + (paraCentavos(parcela.valor) ?? 0), 0);
}

/** Mesmo cálculo da rota de simulação, feito no aparelho quando não há conexão. */
export function simularParcelasLocal(entrada: unknown): SimulacaoParcelas {
  const validacao = simulacaoParcelasSchema.safeParse(entrada);
  if (!validacao.success) {
    const [primeiro] = validacao.error.issues;
    throw new ApiError(primeiro?.message ?? "Dados inválidos", 422, "VALIDACAO", primeiro?.path[0] != null ? String(primeiro.path[0]) : undefined);
  }
  try {
    const simulacao = simularParcelas(validacao.data);
    return {
      totalOperacao: simulacao.totalOperacao.toFixed(2),
      valorPagoAgora: simulacao.valorPagoAgora.toFixed(2),
      saldoAPrazo: simulacao.saldoAPrazo.toFixed(2),
      parcelas: simulacao.parcelas.map((parcela) => ({ valor: parcela.valor.toFixed(2), dataVencimento: parcela.dataVencimento })),
    };
  } catch (falha) {
    if (falha instanceof ErroValidacaoFinanceira) throw new ApiError(falha.message, 422, "VALIDACAO", falha.campo);
    throw falha;
  }
}
