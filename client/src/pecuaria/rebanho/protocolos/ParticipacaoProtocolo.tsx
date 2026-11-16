import { obterCabecalhoProtocolo, type CabecalhoProtocolo } from "./api";
import { RevisaoBloqueioParticipacao } from "../reproducao/RevisaoBloqueioParticipacao";
import { useEffect, useState } from "react";
import { Button, PageHeader, PaginaFinanceira } from "../../../financeiro/financeiro-ui";
import { navegarPara } from "../../../router";
import { RegularizarOrigem, consumoMantidoUltimaAnulacao } from "../reproducao/RegularizarOrigem";
import { RegularizacaoTarefa } from "../sanidade/RegularizacaoTarefa";
import { OperacaoProtocolo } from "./OperacaoProtocolo";
export function ParticipacaoProtocolo({ id, tipo, propriedadeId, podeLancar }: { id: string; tipo: "SANITARIO" | "REPRODUTIVO"; propriedadeId?: number; podeLancar: boolean }) {
  const [revisao, setRevisao] = useState(0);
  const [contexto, setContexto] = useState<{ id: string; sitio: number | undefined; cabecalho: CabecalhoProtocolo } | null>(null);
  const [revisando, setRevisando] = useState(false);
  useEffect(() => {
    let atual = true;
    setContexto(null); setRevisando(false);
    if (tipo === "REPRODUTIVO") obterCabecalhoProtocolo({ participacaoId: id }, propriedadeId).then(cabecalho => { if (atual) setContexto({ id, sitio: propriedadeId, cabecalho }); }).catch(() => { if (atual) setContexto(null); });
    return () => { atual = false; };
  }, [id, tipo, propriedadeId, revisao]);
  const cabecalho = contexto?.id === id && contexto.sitio === propriedadeId ? contexto.cabecalho : null;
  const podeRevisar = podeLancar && tipo === "REPRODUTIVO" && cabecalho?.modo === "INDIVIDUAL" && cabecalho.tipo === "REPRODUTIVO" && cabecalho.status === "ABERTA" && propriedadeId != null && cabecalho.propriedadeId === propriedadeId && !!cabecalho.bloqueadaEm;
  const atualizarBloqueio = () => { setRevisando(false); setContexto(null); setRevisao(v => v + 1); };
  const retornar = () => { const retorno = new URLSearchParams(window.location.search).get("retorno"); navegarPara(retorno?.startsWith("/pecuaria/") ? retorno : tipo === "SANITARIO" ? "/pecuaria/sanidade" : "/pecuaria/reproducao?rotina=programacoes"); };
  return <PaginaFinanceira><PageHeader eyebrow="" titulo="Participação individual" acao={<Button secondary onClick={retornar}>Voltar</Button>} /><div className="protocolos-pagina protocolos-superficie mt-5">{cabecalho?.bloqueadaEm && <div className="flex items-center justify-between gap-3 rounded-lg border p-4"><div><strong>Participação bloqueada</strong><p>{cabecalho.motivoBloqueio || "Motivo não informado"}</p></div>{podeRevisar && <Button secondary onClick={() => setRevisando(true)}>Revisar bloqueio</Button>}</div>}{revisando && podeRevisar && cabecalho?.bloqueadaEm && propriedadeId != null && <RevisaoBloqueioParticipacao participacaoId={id} animal={cabecalho.nome} propriedadeId={propriedadeId} bloqueadaEm={cabecalho.bloqueadaEm} motivoBloqueio={cabecalho.motivoBloqueio} aoFechar={() => setRevisando(false)} aoConfirmar={atualizarBloqueio} aoReconsultar={atualizarBloqueio} />}<OperacaoProtocolo participacaoId={id} propriedadeId={propriedadeId} podeLancar={podeLancar} revisao={revisao} aoSalvar={() => setRevisao(v => v + 1)} regularizacao={(t, atualizar) => tipo === "SANITARIO" ? <RegularizacaoTarefa tarefa={t.tarefaOrigem} podeLancar={podeLancar} onMudou={async () => atualizar()} /> : <RegularizarOrigem path={`/reproducao/tarefas-iatf/${t.id}/regularizacao`} propriedadeId={t.tarefaOrigem.propriedadeRegularizacaoId ?? t.propriedadeId} consumoMantido={consumoMantidoUltimaAnulacao(t.tarefaOrigem.historicoRegularizacao)} onMudou={async () => atualizar()} />} /></div></PaginaFinanceira>;
}
