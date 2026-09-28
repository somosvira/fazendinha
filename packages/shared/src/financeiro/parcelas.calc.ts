import { arredondarDinheiro, multiplicarDecimais, paraCentavos, somarDecimais, type ValorDecimal } from "../lib/decimal.js";
import { ErroValidacaoFinanceira } from "./erros.js";
import type { SimulacaoParcelasValidada } from "../schemas/financeiro.schemas.js";

export type ItemMonetario = { quantidade: ValorDecimal; valorUnitario?: ValorDecimal; valorTotal?: ValorDecimal };
export type ParcelaGerada = { valor: number; dataVencimento: string };

/** Valor do item em dinheiro: o total informado manda; senão quantidade × unitário. */
export function valorItemFinanceiro(item: ItemMonetario): number {
  return item.valorTotal === undefined
    ? multiplicarDecimais(item.quantidade, item.valorUnitario ?? 0, 2)
    : arredondarDinheiro(item.valorTotal);
}

export function totalItensFinanceiros(itens: readonly ItemMonetario[]): number {
  return somarDecimais(itens.map(valorItemFinanceiro), 2);
}

function dataIso(data: Date) {
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}-${String(data.getUTCDate()).padStart(2, "0")}`;
}

function validarData(data: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new ErroValidacaoFinanceira("Informe um primeiro vencimento válido", "primeiroVencimento");
  const [ano, mes, dia] = data.split("-").map(Number);
  const validada = new Date(Date.UTC(ano, mes - 1, dia));
  if (dataIso(validada) !== data) throw new ErroValidacaoFinanceira("Informe um primeiro vencimento válido", "primeiroVencimento");
  return { ano, mes, dia };
}

function vencimentoMensal(data: string, indice: number) {
  const { ano, mes, dia } = validarData(data);
  const primeiro = new Date(Date.UTC(ano, mes - 1 + indice, 1));
  const ultimoDia = new Date(Date.UTC(primeiro.getUTCFullYear(), primeiro.getUTCMonth() + 1, 0)).getUTCDate();
  return dataIso(new Date(Date.UTC(primeiro.getUTCFullYear(), primeiro.getUTCMonth(), Math.min(dia, ultimoDia))));
}

export function gerarParcelasFinanceiras(total: ValorDecimal, quantidade: number, frequencia: "SEMANAL" | "MENSAL", primeiroVencimento: string): ParcelaGerada[] {
  validarData(primeiroVencimento);
  const centavos = paraCentavos(total);
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 360 || quantidade > centavos) {
    throw new ErroValidacaoFinanceira("Informe uma quantidade de parcelas entre 1 e o valor disponível", "quantidadeParcelas");
  }
  const base = Math.floor(centavos / quantidade);
  const resto = centavos % quantidade;
  const inicioSemanal = new Date(`${primeiroVencimento}T12:00:00Z`).getTime();
  return Array.from({ length: quantidade }, (_, indice) => ({
    valor: (base + (indice < resto ? 1 : 0)) / 100,
    dataVencimento: frequencia === "MENSAL"
      ? vencimentoMensal(primeiroVencimento, indice)
      : dataIso(new Date(inicioSemanal + indice * 7 * 86_400_000)),
  }));
}

export function simularParcelas(input: SimulacaoParcelasValidada) {
  const totalOperacao = input.itens.length ? totalItensFinanceiros(input.itens) : arredondarDinheiro(input.valorTotal ?? 0);
  const valorPagoAgora = arredondarDinheiro(input.valorPagoAgora ?? 0);
  const saldoAPrazo = somarDecimais([totalOperacao, -valorPagoAgora], 2);
  if (saldoAPrazo <= 0) throw new ErroValidacaoFinanceira("O saldo a prazo deve ser maior que zero", "valorPagoAgora");
  return {
    totalOperacao,
    valorPagoAgora,
    saldoAPrazo,
    parcelas: gerarParcelasFinanceiras(saldoAPrazo, input.quantidadeParcelas, input.frequencia, input.primeiroVencimento),
  };
}
