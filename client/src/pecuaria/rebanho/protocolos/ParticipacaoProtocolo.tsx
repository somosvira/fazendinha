import { useState } from "react";
import { Button, PageHeader, PaginaFinanceira } from "../../../financeiro/financeiro-ui";
import { navegarPara } from "../../../router";
import { RegularizarOrigem, consumoMantidoUltimaAnulacao } from "../reproducao/RegularizarOrigem";
import { RegularizacaoTarefa } from "../sanidade/RegularizacaoTarefa";
import { OperacaoProtocolo } from "./OperacaoProtocolo";
export function ParticipacaoProtocolo({ id, tipo, propriedadeId, podeLancar }: { id: string; tipo: "SANITARIO" | "REPRODUTIVO"; propriedadeId?: number; podeLancar: boolean }) {
  const [revisao, setRevisao] = useState(0);
  const retornar = () => { const retorno = new URLSearchParams(window.location.search).get("retorno"); navegarPara(retorno?.startsWith("/pecuaria/") ? retorno : tipo === "SANITARIO" ? "/pecuaria/sanidade" : "/pecuaria/reproducao?rotina=programacoes"); };
  return <PaginaFinanceira><PageHeader eyebrow="Pecuária" titulo="Participação individual" acao={<Button secondary onClick={retornar}>Voltar</Button>} /><div className="protocolos-pagina protocolos-superficie mt-5"><OperacaoProtocolo participacaoId={id} propriedadeId={propriedadeId} podeLancar={podeLancar} revisao={revisao} aoSalvar={() => setRevisao(v => v + 1)} regularizacao={(t, atualizar) => tipo === "SANITARIO" ? <RegularizacaoTarefa tarefa={t.tarefaOrigem} podeLancar={podeLancar} onMudou={async () => atualizar()} /> : <RegularizarOrigem path={`/reproducao/tarefas-iatf/${t.id}/regularizacao`} propriedadeId={t.tarefaOrigem.propriedadeRegularizacaoId ?? t.propriedadeId} consumoMantido={consumoMantidoUltimaAnulacao(t.tarefaOrigem.historicoRegularizacao)} onMudou={async () => atualizar()} />} /></div></PaginaFinanceira>;
}
