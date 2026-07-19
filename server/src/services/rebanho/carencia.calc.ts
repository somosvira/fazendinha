// Cálculo puro da carência de leite (resíduo de medicamento) — sem I/O, testável isoladamente.
//
// A carência é registrada em HORAS no evento sanitário APLICACAO (campo `carencia`, ver
// eventos-sanidade.schemas.ts). A `data` do evento é `@db.Date` (dia-só, sem hora), então a
// janela começa em 00:00 do dia da aplicação e vai até `data + carencia horas`. Enquanto ativa,
// o leite da vaca não deve ser vendido.

const HORA_MS = 3_600_000;
const DIA_MS = 86_400_000;

export interface AplicacaoCarencia {
  data: Date;             // início do dia da aplicação (@db.Date normalizada em 00:00Z)
  carencia: number | null; // horas de carência; null/0/negativo = sem carência efetiva
}

export interface CarenciaAtiva {
  fim: Date;             // instante em que a carência termina (leite liberado a partir daí)
  horasRestantes: number; // horas até o fim, arredondadas para cima (≥ 1 enquanto ativa)
  diasRestantes: number;  // dias até o fim, arredondados para cima (transparência ao pecuarista)
}

/** Fim da janela de carência de uma aplicação, ou null quando não há carência efetiva. */
export function fimDaCarencia(data: Date, carencia: number | null): Date | null {
  if (carencia == null || carencia <= 0) return null;
  return new Date(data.getTime() + carencia * HORA_MS);
}

/**
 * Carência ativa do animal no instante `agora`: a janela que termina MAIS TARDE entre todas as
 * aplicações ainda em vigor (a mais restritiva — é ela que impede a venda do leite). Retorna null
 * quando nenhuma aplicação está em carência (sem eventos, todos sem carência, ou todos expirados).
 * A janela é fechada no fim: no exato instante do fim o leite já está liberado.
 */
export function carenciaAtiva(aplicacoes: AplicacaoCarencia[], agora: Date): CarenciaAtiva | null {
  let maiorFim: Date | null = null;
  for (const a of aplicacoes) {
    const fim = fimDaCarencia(a.data, a.carencia);
    if (fim == null || fim.getTime() <= agora.getTime()) continue; // expirada ou sem carência
    if (maiorFim == null || fim.getTime() > maiorFim.getTime()) maiorFim = fim;
  }
  if (maiorFim == null) return null;

  const restanteMs = maiorFim.getTime() - agora.getTime();
  return {
    fim: maiorFim,
    horasRestantes: Math.ceil(restanteMs / HORA_MS),
    diasRestantes: Math.ceil(restanteMs / DIA_MS),
  };
}
