import type { StatusExecucao } from "./iatf.calc.js";

export interface ExecLote {
  id: number;
  dia: number;
  ordem: number;
  status: StatusExecucao;
  dataPlanejada: string;
}

export interface AplicacaoLoteExec {
  aplicacaoId: number;
  animalId: number;
  execucoes: ExecLote[];
}

export interface AlvoEtapa {
  dia: number;
  ordem: number;
}

export interface PlanoExecucao {
  execucaoId: number;
  aplicacaoId: number;
  animalId: number;
  status: StatusExecucao;
}

export interface EtapaResumoLote extends AlvoEtapa {
  concluidas: number;
  puladas: number;
  pendentes: number;
  atrasadas: number;
}

export interface ResumoLoteExec {
  totalAnimais: number;
  porEtapa: EtapaResumoLote[];
  proximaEtapa: AlvoEtapa | null;
  concluido: boolean;
}

/** Seleciona a execução da etapa alvo para cada animal, preservando exceções individuais. */
export function planejarExecucaoColetiva(
  aplicacoes: readonly AplicacaoLoteExec[],
  alvo: AlvoEtapa,
  status: StatusExecucao,
  excecoesAnimalIds: readonly number[],
): PlanoExecucao[] {
  const excecoes = new Set(excecoesAnimalIds);
  return aplicacoes.flatMap((aplicacao) => {
    if (excecoes.has(aplicacao.animalId)) return [];
    const execucao = aplicacao.execucoes.find(
      (item) => item.dia === alvo.dia && item.ordem === alvo.ordem,
    );
    if (!execucao) return [];
    return [{
      execucaoId: execucao.id,
      aplicacaoId: aplicacao.aplicacaoId,
      animalId: aplicacao.animalId,
      status,
    }];
  });
}

/** Agrega o status real das execuções, sem inferir conclusão pela passagem do calendário. */
export function agregarStatusLote(
  aplicacoes: readonly AplicacaoLoteExec[],
  hoje: string,
): ResumoLoteExec {
  const etapas = new Map<string, EtapaResumoLote>();

  for (const aplicacao of aplicacoes) {
    for (const execucao of aplicacao.execucoes) {
      const chave = `${execucao.dia}:${execucao.ordem}`;
      const resumo = etapas.get(chave) ?? {
        dia: execucao.dia,
        ordem: execucao.ordem,
        concluidas: 0,
        puladas: 0,
        pendentes: 0,
        atrasadas: 0,
      };

      if (execucao.status === "CONCLUIDA") resumo.concluidas++;
      else if (execucao.status === "PULADA") resumo.puladas++;
      else {
        resumo.pendentes++;
        if (execucao.dataPlanejada < hoje) resumo.atrasadas++;
      }
      etapas.set(chave, resumo);
    }
  }

  const porEtapa = [...etapas.values()].sort((a, b) => a.dia - b.dia || a.ordem - b.ordem);
  const proxima = porEtapa.find((etapa) => etapa.pendentes > 0) ?? null;
  return {
    totalAnimais: aplicacoes.length,
    porEtapa,
    proximaEtapa: proxima ? { dia: proxima.dia, ordem: proxima.ordem } : null,
    concluido: porEtapa.length > 0 && proxima === null,
  };
}
