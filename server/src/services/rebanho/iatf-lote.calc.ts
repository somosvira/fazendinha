// Cálculo puro do resumo de uma PROGRAMAÇÃO IATF de lote — sem I/O, testável isoladamente.
// Uma programação aplica UM protocolo a UM lote num mesmo D0, então UMA agenda D0/D7/D9/D11
// vale para todos os animais. Reusa `agendarEtapas` (do agendamento individual, #163) e
// só acrescenta a leitura de PROGRESSO do lote: qual a próxima etapa e quantas já passaram.
//
// Determinístico: `hoje` sempre vem do chamador (mesma convenção de vacina.calc/iatf.calc).

import { agendarEtapas, type EtapaAgendada, type EtapaProtocolo } from "./iatf.calc.js";

export interface ResumoProgramacaoIn {
  etapas: readonly EtapaProtocolo[];
  dataInicio: string; // D0 (YYYY-MM-DD)
  hoje: string; // YYYY-MM-DD
}

export interface ResumoProgramacao {
  agenda: EtapaAgendada[]; // D0/D7/D9/D11… com data civil de cada etapa
  totalEtapas: number;
  etapasConcluidas: number; // etapas cuja data já passou (data < hoje)
  proxima: EtapaAgendada | null; // primeira etapa com data >= hoje; null se terminou
  dataFim: string | null; // data da última etapa (fim do protocolo)
  concluido: boolean; // não há mais etapa futura
}

/**
 * Primeira etapa da agenda cuja data é hoje ou no futuro (a próxima ação do lote).
 * Inclusivo no dia da etapa: se hoje é o dia de uma etapa, ela é a "próxima" (ainda a fazer).
 * `null` quando todas as etapas já passaram (protocolo terminado).
 */
export function proximaEtapa(agenda: readonly EtapaAgendada[], hoje: string): EtapaAgendada | null {
  return agenda.find((e) => e.data >= hoje) ?? null;
}

/** Deriva a agenda coletiva do lote e a leitura de progresso a partir do D0. */
export function resumoProgramacao({ etapas, dataInicio, hoje }: ResumoProgramacaoIn): ResumoProgramacao {
  const agenda = agendarEtapas(etapas, dataInicio);
  const etapasConcluidas = agenda.filter((e) => e.data < hoje).length;
  const proxima = proximaEtapa(agenda, hoje);
  return {
    agenda,
    totalEtapas: agenda.length,
    etapasConcluidas,
    proxima,
    dataFim: agenda.length ? agenda[agenda.length - 1].data : null,
    concluido: proxima === null,
  };
}
