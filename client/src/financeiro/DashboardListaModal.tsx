import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogFinanceiro } from "./DialogFinanceiro";
import { SkeletonListaFinanceira } from "./CarregamentoFinanceiro";
import { CompromissoDetalheDialog } from "./CompromissoDetalheDialog";
import { filtrarMovimentosExtratoGeral } from "./ExtratoGeral";
import { obterExtratoGeral, type Compromisso, type MovimentoGeral } from "./novo-api";
import { brl, dataBR, Paginacao } from "./financeiro-ui";
import { tituloCompromisso } from "./lib/compromissos";
import { LinkOperacaoFinanceira } from "./LinkOperacaoFinanceira";

export type TipoListaDashboard = "recebimentos" | "pagamentos" | "pagar" | "receber";
const TITULOS = { recebimentos: "Últimos recebimentos", pagamentos: "Últimos pagamentos", pagar: "Compromissos a pagar", receber: "Compromissos a receber" };

export function DashboardListaModal({ tipo, inicio, fim, pendentes, onClose }: {
  tipo: TipoListaDashboard; inicio: string; fim: string; pendentes: Compromisso[]; onClose: () => void;
}) {
  const [movimentos, setMovimentos] = useState<MovimentoGeral[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [selecionado, setSelecionado] = useState<Compromisso | null>(null);
  const realizado = tipo === "recebimentos" || tipo === "pagamentos";
  useEffect(() => {
    let vigente = true;
    setPagina(1); setMovimentos(null); setErro(null);
    if (realizado) obterExtratoGeral().then(dados => { if (vigente) setMovimentos(dados); }).catch(falha => { if (vigente) setErro(falha instanceof Error ? falha.message : String(falha)); });
    return () => { vigente = false; };
  }, [tipo, inicio, fim, tentativa, realizado]);
  const recentes = filtrarMovimentosExtratoGeral(movimentos ?? [], { inicio, fim, conta: "", instituicao: "", natureza: tipo }).sort((a, b) => b.transacao.data.localeCompare(a.transacao.data) || b.seq - a.seq);
  const compromissos = pendentes.filter(item => item.tipo === (tipo === "pagar" ? "PAGAR" : "RECEBER")).sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento) || a.seq - b.seq);
  const total = realizado ? recentes.length : compromissos.length;
  return <DialogFinanceiro titulo={TITULOS[tipo]} eyebrow={`${dataBR(inicio)} a ${dataBR(fim)}`} onClose={onClose} className="max-w-3xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
    <div className="min-h-0 overflow-y-auto p-4">
      {erro ? <div role="alert"><p>{erro}</p><Button variant="outline" onClick={() => setTentativa(valor => valor + 1)}>Tentar novamente</Button></div> : realizado && !movimentos ? <SkeletonListaFinanceira label={`Carregando ${tipo}`} /> : <>
        <p className="mb-3 text-xs text-muted-foreground">{realizado ? "Mais recentes primeiro · inclui estornos identificados · transferências excluídas" : "Ordenados por vencimento · saldo ainda pendente"}</p>
        {!total ? <p role="status" className="py-4">Nenhum item no período selecionado.</p> : <ul className="divide-y divide-border">
          {realizado ? recentes.slice((pagina - 1) * 15, pagina * 15).map(item => <li key={item.id} className="py-3"><div className="flex flex-wrap justify-between gap-2"><strong className="min-w-0 flex-1 break-words text-sm">{item.transacao.descricao ?? item.transacao.tipo.replaceAll("_", " ")}</strong><strong className={`tabular-nums ${item.direcao === "ENTRADA" ? "text-[var(--pos)]" : "text-destructive"}`}>{item.direcao === "ENTRADA" ? "+" : "−"}{brl(item.valor)}</strong></div><p className="mt-1 text-xs text-muted-foreground">{dataBR(item.transacao.data)} · {item.conta.nome} · {item.transacao.parceiro?.nome ?? "Sem parceiro"}{item.transacao.tipo === "REVERSAO" ? " · Estorno" : item.transacao.status === "REVERTIDA" ? " · Revertida" : ""}</p>{item.transacao.operacao && <LinkOperacaoFinanceira id={item.transacao.operacao.id} numero={item.transacao.operacao.numero} />}</li>) : compromissos.slice((pagina - 1) * 15, pagina * 15).map(item => <li key={item.id}><Button variant="ghost" className="h-auto w-full flex-col items-start gap-1 whitespace-normal px-0 py-3 text-left" onClick={() => setSelecionado(item)}><span className="flex w-full flex-wrap justify-between gap-2"><strong className="min-w-0 flex-1 break-words">{tituloCompromisso(item)}</strong><strong className="tabular-nums">{brl(item.saldoPendente)}</strong></span><span className={`text-xs ${item.vencido ? "text-destructive" : "text-muted-foreground"}`}>{dataBR(item.dataVencimento)} · {item.parceiro?.nome ?? "Sem parceiro"} · {item.vencido ? "Vencido" : item.status === "PARCIAL" ? "Parcial" : "Pendente"}</span></Button></li>)}
        </ul>}
        {!!total && <Paginacao ocultarControlesPaginaUnica pagina={pagina} totalPaginas={Math.max(1, Math.ceil(total / 15))} total={total} porPagina={15} rotulo="Paginação dos itens" substantivo="itens" idSelect="pagina-dashboard-modal" onPagina={setPagina} />}
      </>}
    </div>
    {selecionado && <CompromissoDetalheDialog compromisso={selecionado} onClose={() => setSelecionado(null)} />}
  </DialogFinanceiro>;
}
