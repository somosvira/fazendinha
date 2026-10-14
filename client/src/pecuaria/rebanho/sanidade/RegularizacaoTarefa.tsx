import { RegularizarOrigem, consumoMantidoUltimaAnulacao, type EventoRegularizacao } from "../reproducao/RegularizarOrigem";
export const rotuloSituacaoTarefa = (situacao: string) => ({ PENDENTE:"Pendente", REALIZADA:"Realizada", DISPENSADA:"Dispensada", EXECUCAO_CANCELADA:"Execução cancelada", REGULARIZACAO_PENDENTE:"Regularização pendente", ENCERRADA_SEM_SUBSTITUICAO:"Encerrada sem substituição" } as Record<string,string>)[situacao] ?? situacao;
export type DadosRegularizacaoTarefa = { id:string; regularizacaoPendente?:boolean; historicoRegularizacao?: EventoRegularizacao[]; propriedadeRegularizacaoId?:number | null; execucao: { propriedadeId:number | null; canceladaEm?:string | null } };
export function RegularizacaoTarefa({ tarefa, podeLancar, onMudou }: { tarefa:DadosRegularizacaoTarefa; podeLancar:boolean; onMudou:()=>Promise<void> }) {
  const sitio=tarefa.propriedadeRegularizacaoId??tarefa.execucao.propriedadeId;
  return <div className="grid gap-2">
    {podeLancar && tarefa.regularizacaoPendente && sitio && <RegularizarOrigem path={`/sanidade/tarefas/${tarefa.id}/regularizacao`} propriedadeId={sitio} consumoMantido={consumoMantidoUltimaAnulacao(tarefa.historicoRegularizacao)} reabrirPermitido={!tarefa.execucao.canceladaEm} onMudou={onMudou} />}
    {!!tarefa.historicoRegularizacao?.length && <details><summary className="text-sm cursor-pointer">Histórico de regularização</summary><ol className="text-sm space-y-2">{tarefa.historicoRegularizacao.map((e,i)=><li key={i}>{({FATO_ANULADO:"Fato anulado",REABRIR:"Pendência reaberta",VINCULAR_SUBSTITUTO:"Fato substituto vinculado",ENCERRAR_SEM_SUBSTITUICAO:"Encerrada sem substituição"} as Record<string,string>)[e.acao??""]??e.acao}{"motivo" in e && typeof e.motivo === "string" ? ` · ${e.motivo}` : ""}</li>)}</ol></details>}
  </div>;
}
