import type { DateRange } from "../../../components/DateRangePicker";

/** Intervalo civil de doze meses, inclusivo até hoje, sem converter para UTC. */
export function ultimosDozeMeses(hoje: Date): DateRange {
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const ultimoDia = new Date(fim.getFullYear() - 1, fim.getMonth() + 1, 0).getDate();
  const inicio = new Date(fim.getFullYear() - 1, fim.getMonth(), Math.min(fim.getDate(), ultimoDia) + 1);
  return { start: inicio, end: fim };
}

/** Remove somente a referência técnica do formato gerado pelo serviço de custos. */
export function descricaoCusto(descricao: string): string {
  return descricao.replace(/^(Tentativa [A-Z_]+) · ciclo \d+ · (\d+)$/, "$1 · ordem $2");
}
