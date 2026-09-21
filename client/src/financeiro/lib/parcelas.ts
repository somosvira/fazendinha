export type FrequenciaParcelas = "SEMANAL" | "MENSAL" | "PERSONALIZADA";

export type ParcelaCalculada = { valor: string; vencimento: string };

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

function dataIso(data: Date) {
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}-${String(data.getUTCDate()).padStart(2, "0")}`;
}

function adicionarMeses(data: string, meses: number) {
  const [ano, mes, dia] = data.split("-").map(Number);
  const primeiro = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(primeiro.getUTCFullYear(), primeiro.getUTCMonth() + 1, 0)).getUTCDate();
  return dataIso(new Date(Date.UTC(primeiro.getUTCFullYear(), primeiro.getUTCMonth(), Math.min(dia, ultimoDia))));
}

export function gerarParcelas(total: string, quantidade: number, frequencia: FrequenciaParcelas, primeiroVencimento: string): ParcelaCalculada[] {
  // Personalizada não tem regra de geração — o usuário edita cada parcela manualmente.
  if (frequencia === "PERSONALIZADA") return [];
  const centavos = paraCentavos(total);
  if (centavos == null || quantidade < 1 || !Number.isInteger(quantidade) || quantidade > centavos || !/^\d{4}-\d{2}-\d{2}$/.test(primeiroVencimento)) return [];
  const base = Math.floor(centavos / quantidade);
  const resto = centavos % quantidade;
  return Array.from({ length: quantidade }, (_, indice) => {
    const vencimento = frequencia === "MENSAL" ? adicionarMeses(primeiroVencimento, indice) : dataIso(new Date(new Date(`${primeiroVencimento}T12:00:00Z`).getTime() + indice * 7 * 86_400_000));
    return { valor: deCentavos(base + (indice < resto ? 1 : 0)), vencimento };
  });
}

export function somarParcelas(parcelas: readonly { valor: string }[]) {
  return parcelas.reduce((soma, parcela) => soma + (paraCentavos(parcela.valor) ?? 0), 0);
}
