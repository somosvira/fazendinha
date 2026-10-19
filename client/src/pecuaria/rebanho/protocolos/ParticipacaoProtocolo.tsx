import { useEffect, useState } from "react";
import { Button, ErrorBox, PageHeader, PaginaFinanceira } from "../../../financeiro/financeiro-ui";
import { navegarPara } from "../../../router";
import { obterReproducao, type PainelReprodutivo } from "../reproducao/api";
import { ExecucaoIatf } from "../reproducao/Iatf";
import { RegularizarOrigem, consumoMantidoUltimaAnulacao } from "../reproducao/RegularizarOrigem";
import { ExecutarEtapa } from "../sanidade/ExecutarEtapa";
import { RegularizacaoTarefa } from "../sanidade/RegularizacaoTarefa";
import { OperacaoProtocolo } from "./OperacaoProtocolo";
import type { TarefaOperacional } from "./api";
export function ParticipacaoProtocolo({ id, tipo, propriedadeId, podeLancar }: { id: string; tipo: "SANITARIO" | "REPRODUTIVO"; propriedadeId?: number; podeLancar: boolean }) {
  const [executando, setExecutando] = useState<TarefaOperacional[] | null>(null);
  const [painel, setPainel] = useState<PainelReprodutivo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [revisao, setRevisao] = useState(0);
  useEffect(() => { let vivo = true; setErro(null); if (tipo === "REPRODUTIVO") obterReproducao(undefined, propriedadeId).then(p => { if (vivo) setPainel(p); }).catch(e => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [tipo, propriedadeId, tentativa]);
  const salvo = () => { setExecutando(null); setRevisao(v => v + 1); };
  const retornar = () => { const retorno = new URLSearchParams(window.location.search).get("retorno"); navegarPara(retorno?.startsWith("/pecuaria/") ? retorno : tipo === "SANITARIO" ? "/pecuaria/sanidade" : "/pecuaria/reproducao?rotina=programacoes"); };
  return <PaginaFinanceira><PageHeader eyebrow="Pecuária" titulo="Participação individual" acao={<Button secondary onClick={retornar}>Voltar</Button>} /><ErrorBox erro={erro} />{erro && <Button secondary onClick={() => setTentativa(v => v + 1)}>Atualizar dados do atendimento</Button>}<div className="mt-5"><OperacaoProtocolo participacaoId={id} propriedadeId={propriedadeId} podeLancar={podeLancar} revisao={revisao} aoExecutar={tarefas => setExecutando(tarefas)} regularizacao={(t, atualizar) => tipo === "SANITARIO" ? <RegularizacaoTarefa tarefa={t.tarefaOrigem} podeLancar={podeLancar} onMudou={async () => atualizar()} /> : <RegularizarOrigem path={`/reproducao/tarefas-iatf/${t.id}/regularizacao`} propriedadeId={t.tarefaOrigem.propriedadeRegularizacaoId ?? t.propriedadeId} consumoMantido={consumoMantidoUltimaAnulacao(t.tarefaOrigem.historicoRegularizacao)} onMudou={async () => atualizar()} />} /></div>{executando && (tipo === "SANITARIO" ? <ExecutarEtapa key={executando.map(t => t.id).join(":")} tarefas={executando.map(t => t.tarefaOrigem)} onFechar={() => setExecutando(null)} onSalvo={salvo} /> : painel ? <ExecucaoIatf key={`${propriedadeId}:${executando[0].id}`} propriedadeId={propriedadeId ?? null} tarefa={executando[0].tarefaOrigem} animalId={executando[0].animal.id} painel={painel} onFechar={() => setExecutando(null)} onSalvo={salvo} /> : <p role="status">Carregando dados para o atendimento…</p>)}</PaginaFinanceira>;
}
