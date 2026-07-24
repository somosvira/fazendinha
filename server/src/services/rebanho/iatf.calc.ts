// Cálculo puro do agendamento de um protocolo IATF — sem I/O, testável isoladamente.
// Um protocolo é uma sequência de etapas com um offset `dia` a partir do D0
// (dia 0 = data de início da aplicação no animal). Agendar = somar cada offset
// à data de início e devolver a data civil de cada etapa.
//
// Datas são sempre a data civil ISO (YYYY-MM-DD); a soma é feita em UTC-meia-noite
// para não escorregar de dia por fuso (mesma convenção de vacina.calc.ts).

export interface EtapaProtocolo {
  dia: number; // offset em dias a partir do D0 (0, 7, 9, 11…)
  acao: string; // o que fazer nessa etapa
  hormonio: string | null; // hormônio/fármaco aplicado (quando houver)
  ordem: number; // desempate quando duas etapas caem no mesmo dia
}

export interface EtapaAgendada extends EtapaProtocolo {
  rotulo: string; // "D0", "D7", "D9", "D11"…
  data: string; // data civil (YYYY-MM-DD) = dataInicio + dia
}

const MS = 86_400_000;
const somaDias = (isoDia: string, dias: number) =>
  new Date(Date.parse(`${isoDia}T00:00:00Z`) + dias * MS).toISOString().slice(0, 10);

/** Ordena por `dia` crescente e, no empate, por `ordem` — sem mutar a entrada. */
export function ordenarEtapas<T extends EtapaProtocolo>(etapas: readonly T[]): T[] {
  return [...etapas].sort((a, b) => a.dia - b.dia || a.ordem - b.ordem);
}

/**
 * Agenda as etapas de um protocolo a partir de `dataInicio` (o D0).
 * Cada etapa ganha a data civil `dataInicio + dia` e o rótulo `D<dia>`.
 */
export function agendarEtapas(etapas: readonly EtapaProtocolo[], dataInicio: string): EtapaAgendada[] {
  return ordenarEtapas(etapas).map((e) => ({
    ...e,
    rotulo: `D${e.dia}`,
    data: somaDias(dataInicio, e.dia),
  }));
}

export type StatusExecucao = "PENDENTE" | "CONCLUIDA" | "PULADA";

export interface ExecucaoEtapa {
  id?: number;
  dia: number;
  acao: string;
  hormonio: string | null;
  ordem: number;
  dataPlanejada: string;
  status: StatusExecucao;
  dataExecucao: string | null;
  produto?: string | null;
  dose?: string | null;
  observacao?: string | null;
}

export interface EtapaComStatus extends EtapaAgendada {
  execucaoId: number | null;
  status: StatusExecucao;
  dataExecucao: string | null;
  dataEfetiva: string; // dataExecucao se concluída/pulada, senão data planejada
  atrasada: boolean; // pendente e dataPlanejada < hoje
}

/** Cruza agenda projetada com execuções materializadas (por dia+ordem). */
export function etapasComStatus(
  etapas: readonly EtapaProtocolo[],
  dataInicio: string,
  execucoes: readonly ExecucaoEtapa[],
  hoje: string,
): EtapaComStatus[] {
  const byKey = new Map(execucoes.map((e) => [`${e.dia}:${e.ordem}`, e]));
  return agendarEtapas(etapas, dataInicio).map((ag) => {
    const ex = byKey.get(`${ag.dia}:${ag.ordem}`);
    const status: StatusExecucao = ex?.status ?? "PENDENTE";
    const dataExecucao = ex?.dataExecucao ?? null;
    const dataEfetiva = (status !== "PENDENTE" && dataExecucao) ? dataExecucao : ag.data;
    return {
      ...ag,
      execucaoId: ex?.id ?? null,
      status,
      dataExecucao,
      dataEfetiva,
      atrasada: status === "PENDENTE" && ag.data < hoje,
    };
  });
}

/** Progresso real: concluídas+puladas contam como resolvidas; próxima = primeira pendente. */
export function progressoExecucao(etapas: readonly EtapaComStatus[]): {
  total: number;
  resolvidas: number;
  concluidas: number;
  puladas: number;
  pendentes: number;
  proxima: EtapaComStatus | null;
  concluido: boolean;
} {
  const resolvidas = etapas.filter((e) => e.status === "CONCLUIDA" || e.status === "PULADA");
  const pendentes = etapas.filter((e) => e.status === "PENDENTE");
  return {
    total: etapas.length,
    resolvidas: resolvidas.length,
    concluidas: etapas.filter((e) => e.status === "CONCLUIDA").length,
    puladas: etapas.filter((e) => e.status === "PULADA").length,
    pendentes: pendentes.length,
    proxima: pendentes[0] ?? null,
    concluido: pendentes.length === 0 && etapas.length > 0,
  };
}
