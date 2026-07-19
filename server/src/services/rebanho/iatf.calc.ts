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
