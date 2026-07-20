// Cálculo puro da agenda unificada de manejos futuros — sem I/O, testável isoladamente.
// Recebe itens já normalizados de cada fonte (vacinas agendadas, etapas IATF de lote) e devolve
// o calendário ordenado por data, com status atrasado/futuro e dias para a data.

export type TipoManejo = "VACINA" | "IATF";

export interface ItemAgendaIn {
  tipo: TipoManejo;
  data: string; // YYYY-MM-DD prevista
  titulo: string; // o que fazer
  alvo: string; // animal (#numero) ou lote
}

export interface ItemAgenda extends ItemAgendaIn {
  status: "atrasado" | "futuro";
  diasParaData: number; // negativo = dias de atraso
}

const MS = 86_400_000;
function diasEntre(deISO: string, ateISO: string): number {
  return Math.round((Date.parse(`${ateISO}T00:00:00Z`) - Date.parse(`${deISO}T00:00:00Z`)) / MS);
}

// Monta o calendário: ordena por data asc (empate: por tipo e alvo, estável) e classifica.
// `data < hoje` = atrasado; `data >= hoje` = futuro (hoje conta como futuro/a fazer).
export function montarAgenda(itens: readonly ItemAgendaIn[], hoje: string): ItemAgenda[] {
  return [...itens]
    .sort((a, b) => a.data.localeCompare(b.data) || a.tipo.localeCompare(b.tipo) || a.alvo.localeCompare(b.alvo))
    .map((it) => ({
      ...it,
      status: it.data < hoje ? "atrasado" : "futuro",
      diasParaData: diasEntre(hoje, it.data),
    }));
}
