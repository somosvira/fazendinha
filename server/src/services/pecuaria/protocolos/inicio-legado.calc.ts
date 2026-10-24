import type { EtapaIatf } from "../reproducao/schemas.js";
import { calendarioIatf } from "../reproducao/regras.calc.js";
import { lerDataIatf, serializarDataIatf, type PrecisaoIatf } from "../reproducao/horarios.calc.js";

type TarefaInicio = {
  id: string; nome: string; etapa: number; previstaEm: Date; precisaoTemporal: PrecisaoIatf;
  previsaoPendente: boolean; realizadaEm: Date | null; dispensadaEm: Date | null;
};

/** Projeta somente alterações reais nas pendências, sem modificar os snapshots ou as tarefas. */
export function impactosInicioLegado(inicioEfetivo: string, etapas: EtapaIatf[], tarefas: TarefaInicio[]) {
  const temporal = lerDataIatf(inicioEfetivo);
  const calendario = calendarioIatf(temporal.instante, etapas, temporal.precisao);
  return tarefas.flatMap(tarefa => {
    if (tarefa.realizadaEm || tarefa.dispensadaEm) return [];
    const nova = calendario[tarefa.etapa];
    if (!nova || (tarefa.previstaEm.getTime() === nova.previstaEm.getTime()
      && tarefa.precisaoTemporal === nova.precisaoTemporal && tarefa.previsaoPendente === nova.previsaoPendente)) return [];
    return [{ id: tarefa.id, nome: tarefa.nome,
      previstaAnterior: serializarDataIatf(tarefa.previstaEm, tarefa.precisaoTemporal),
      previstaNova: serializarDataIatf(nova.previstaEm, nova.precisaoTemporal),
      precisaoAnterior: tarefa.precisaoTemporal, precisaoNova: nova.precisaoTemporal,
      previsaoPendenteAnterior: tarefa.previsaoPendente, previsaoPendente: nova.previsaoPendente }];
  });
}
