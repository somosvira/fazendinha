import { Prisma } from "@prisma/client";
import { dinheiro, FinanceiroError } from "./regras.js";

export type ItemMonetario = { quantidade: Prisma.Decimal.Value; valorUnitario?: Prisma.Decimal.Value; valorTotal?: Prisma.Decimal.Value };

export function totalItensFinanceiros(itens: readonly ItemMonetario[]) {
  return dinheiro(itens.reduce(
    (total, item) => total.plus(item.valorTotal === undefined
      ? dinheiro(new Prisma.Decimal(item.quantidade).mul(item.valorUnitario ?? 0))
      : dinheiro(item.valorTotal)),
    new Prisma.Decimal(0),
  ));
}

function dataIso(data: Date) {
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}-${String(data.getUTCDate()).padStart(2, "0")}`;
}

function validarData(data: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new FinanceiroError("VALIDACAO", "Informe um primeiro vencimento válido", "primeiroVencimento");
  const [ano, mes, dia] = data.split("-").map(Number);
  const validada = new Date(Date.UTC(ano, mes - 1, dia));
  if (dataIso(validada) !== data) throw new FinanceiroError("VALIDACAO", "Informe um primeiro vencimento válido", "primeiroVencimento");
  return { ano, mes, dia };
}

function vencimentoMensal(data: string, indice: number) {
  const { ano, mes, dia } = validarData(data);
  const primeiro = new Date(Date.UTC(ano, mes - 1 + indice, 1));
  const ultimoDia = new Date(Date.UTC(primeiro.getUTCFullYear(), primeiro.getUTCMonth() + 1, 0)).getUTCDate();
  return dataIso(new Date(Date.UTC(primeiro.getUTCFullYear(), primeiro.getUTCMonth(), Math.min(dia, ultimoDia))));
}

export function gerarParcelasFinanceiras(total: Prisma.Decimal.Value, quantidade: number, frequencia: "SEMANAL" | "MENSAL", primeiroVencimento: string) {
  validarData(primeiroVencimento);
  const centavos = dinheiro(total).mul(100).toNumber();
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 360 || quantidade > centavos) {
    throw new FinanceiroError("VALIDACAO", "Informe uma quantidade de parcelas entre 1 e o valor disponível", "quantidadeParcelas");
  }
  const base = Math.floor(centavos / quantidade);
  const resto = centavos % quantidade;
  const inicioSemanal = new Date(`${primeiroVencimento}T12:00:00Z`).getTime();
  return Array.from({ length: quantidade }, (_, indice) => ({
    valor: dinheiro(new Prisma.Decimal(base + (indice < resto ? 1 : 0)).div(100)),
    dataVencimento: frequencia === "MENSAL"
      ? vencimentoMensal(primeiroVencimento, indice)
      : dataIso(new Date(inicioSemanal + indice * 7 * 86_400_000)),
  }));
}
