import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CalendarDays } from "lucide-react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { descartarRascunhoOperacao, liquidarCompromisso, listarCompromissos, obterConfiguracoesFinanceiras, obterRascunhoOperacao, type Compromisso, type ConfiguracoesFinanceiras } from "./novo-api";
import { brl, Button, dataBR, Empty, ErrorBox, hoje, Metric, Modal, PageHeader, PaginaCarregando, PaginaFinanceira, Panel, Pill, StatusPill, TIPO_OPERACAO } from "./financeiro-ui";
import type { Tab } from "../components/Shell";
import { tituloCompromisso } from "./lib/compromissos";

export function CompromissosFinanceiros({ onNav }: { onNav: (tab: Tab) => void }) {
  const [itens, setItens] = useState<Compromisso[]>([]); const [config, setConfig] = useState<ConfiguracoesFinanceiras | null>(null); const [pagando, setPagando] = useState<Compromisso | null>(null); const [contaId, setContaId] = useState(""); const [valor, setValor] = useState(""); const [erro, setErro] = useState<string | null>(null); const [aba, setAba] = useState<"PAGAR" | "RECEBER" | "LIQUIDADOS">("PAGAR"); const [soVencidos, setSoVencidos] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [novoCompromissoPendente, setNovoCompromissoPendente] = useState<"PAGAR" | "RECEBER" | null>(null); const [preparando, setPreparando] = useState(false);
  const carregar = useCallback(() => Promise.all([listarCompromissos(), obterConfiguracoesFinanceiras()]).then(([c, cfg]) => { setItens(c); setConfig(cfg); }).catch((e) => setErro(e.message)).finally(() => setCarregando(false)), []);
  useEffect(() => { carregar(); }, [carregar]);
  const lista = itens
    .filter((c) => aba === "LIQUIDADOS" ? c.status === "LIQUIDADO" : c.tipo === aba && c.status !== "LIQUIDADO")
    .filter((c) => !soVencidos || c.vencido)
    .map((c) => ({ ...c, operacao: { ...c.operacao, descricao: tituloCompromisso(c) } }));
  const total = lista.reduce((s, c) => s + Number(c.saldoPendente), 0);
  const pagar = async () => { if (!pagando) return; try { await liquidarCompromisso(pagando.id, { contaId: Number(contaId), valor: Number(valor), data: hoje(), formaPagamento: "PIX" }); setPagando(null); setContaId(""); setValor(""); await carregar(); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } };
  const criarCompromisso = (tipo: "PAGAR" | "RECEBER") => { onNav("lancar"); window.setTimeout(() => { window.history.pushState(null, "", `/financeiro/operacoes/nova?compromisso=${tipo}`); window.dispatchEvent(new PopStateEvent("popstate")); }, 0); };
  const verRascunhoAtual = () => {
    setNovoCompromissoPendente(null);
    onNav("lancar");
    window.setTimeout(() => { window.history.pushState(null, "", "/financeiro/operacoes/nova"); window.dispatchEvent(new PopStateEvent("popstate")); }, 0);
  };
  const prepararNovoCompromisso = async (tipo: "PAGAR" | "RECEBER") => {
    setPreparando(true); setErro(null);
    try {
      const rascunho = await obterRascunhoOperacao();
      if (rascunho) setNovoCompromissoPendente(tipo);
      else criarCompromisso(tipo);
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
    finally { setPreparando(false); }
  };
  const descartarECriarCompromisso = async () => {
    const tipo = novoCompromissoPendente;
    if (!tipo) return;
    setPreparando(true); setErro(null);
    try { await descartarRascunhoOperacao(); setNovoCompromissoPendente(null); criarCompromisso(tipo); }
    catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
    finally { setPreparando(false); }
  };

  if (carregando && !config) return <PaginaCarregando label="Carregando compromissos" />;

  return <PaginaFinanceira>
    <PageHeader titulo="Compromissos" descricao="Agenda de valores futuros. Vencimento indica prazo; o status informa se a obrigação está pendente, parcial ou liquidada." acao={<div className="flex flex-wrap gap-2"><Button secondary disabled={preparando} onClick={() => { void prepararNovoCompromisso("RECEBER"); }}>Criar a receber</Button><Button disabled={preparando} onClick={() => { void prepararNovoCompromisso("PAGAR"); }}>Criar a pagar</Button></div>} />
    <ErrorBox erro={erro} />
    <div className="mt-6 grid gap-4 md:grid-cols-3"><Metric label="A pagar" valor={brl(itens.filter((c) => c.tipo === "PAGAR" && !["LIQUIDADO", "CANCELADO"].includes(c.status)).reduce((s, c) => s + Number(c.saldoPendente), 0))} detalhe="Saldo pendente" icon={ArrowUpRight} /><Metric label="A receber" valor={brl(itens.filter((c) => c.tipo === "RECEBER" && !["LIQUIDADO", "CANCELADO"].includes(c.status)).reduce((s, c) => s + Number(c.saldoPendente), 0))} detalhe="Saldo pendente" icon={ArrowDownLeft} /><Metric label="Vencidos" valor={String(itens.filter((c) => c.vencido).length)} detalhe="Condição de prazo, não status" icon={CalendarDays} tone="red" /></div>
    <Panel className="mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4"><div className="flex flex-wrap gap-2">{([['PAGAR', 'A pagar'], ['RECEBER', 'A receber'], ['LIQUIDADOS', 'Liquidados']] as const).map(([k, label]) => <button key={k} onClick={() => setAba(k)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${aba === k ? "bg-mast text-white" : "bg-[#f4f2e9] text-ink"}`}>{label}</button>)}</div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={soVencidos} onChange={(e) => setSoVencidos(e.target.checked)} /> Mostrar somente vencidos</label></div>
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#faf9f4] px-5 py-3 text-sm"><span className="text-ink-3">{lista.length} compromissos na visão</span><strong className="whitespace-nowrap">Total pendente: {brl(total)}</strong></div>
      {lista.length ? <div className="divide-y divide-border">{lista.map((c) => <div key={c.id} className="grid items-center gap-4 p-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,.8fr)_minmax(0,.7fr)_auto]"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="break-words">{c.operacao.descricao || TIPO_OPERACAO[c.operacao.tipo]}</strong><StatusPill status={c.status} />{c.vencido && <Pill tone="red">Vencido</Pill>}</div><div className="mt-1 break-words text-xs text-ink-3">OP-{String(c.operacao.id).padStart(4, "0")} · {c.parceiro?.nome ?? "Sem parceiro"}</div></div><div className="min-w-0"><div className="text-xs text-ink-3">Vencimento</div><div className="mt-1 whitespace-nowrap font-medium">{dataBR(c.dataVencimento)}</div></div><div className="min-w-0 lg:text-right"><div className="text-xs text-ink-3">Saldo pendente</div><strong className={`mt-1 block whitespace-nowrap text-lg ${c.tipo === "RECEBER" ? "text-green-800" : ""}`}>{brl(c.saldoPendente)}</strong>{Number(c.valorLiquidado) > 0 && <div className="whitespace-nowrap text-[11px] text-ink-3">de {brl(c.valorOriginal)}</div>}</div>{c.status !== "LIQUIDADO" && c.status !== "CANCELADO" ? <Button className="w-full lg:w-auto" secondary onClick={() => { setPagando(c); setValor(String(Number(c.saldoPendente))); }}>{c.tipo === "PAGAR" ? "Registrar pagamento" : "Registrar recebimento"}</Button> : <span />}</div>)}</div> : <Empty>Nenhum compromisso nesta visão.</Empty>}
    </Panel>

    {pagando && <Modal titulo={`Registrar ${pagando.tipo === "PAGAR" ? "pagamento" : "recebimento"}`} eyebrow="Confirmação financeira" onClose={() => setPagando(null)}><div className="p-5"><div className="rounded-lg bg-[#f7f5ed] p-4"><strong className="break-words">{pagando.operacao.descricao}</strong><div className="mt-1 break-words text-sm text-ink-3">{pagando.parceiro?.nome ?? "Sem parceiro"} · pendente {brl(pagando.saldoPendente)}</div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Conta<select className="mt-1.5 w-full rounded-lg border border-border bg-white p-2.5 font-normal" value={contaId} onChange={(e) => setContaId(e.target.value)}><option value="">Selecione</option>{config?.contas.filter((x) => x.ativo).map((x) => <option key={x.id} value={x.id}>{x.nome} · {brl(x.saldoAtual)}</option>)}</select></label><label className="text-sm font-medium">Valor<input type="number" min="0.01" max={Number(pagando.saldoPendente)} step="0.01" className="mt-1.5 w-full rounded-lg border border-border p-2.5 font-normal" value={valor} onChange={(e) => setValor(e.target.value)} /></label></div><div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Ao confirmar, o saldo da conta será alterado e o compromisso ficará parcial ou liquidado. O registro poderá ser revertido posteriormente com histórico.</div><div className="mt-5 flex justify-end gap-2"><Button secondary onClick={() => setPagando(null)}>Cancelar</Button><Button disabled={!contaId || Number(valor) <= 0 || Number(valor) > Number(pagando.saldoPendente)} onClick={pagar}>Confirmar liquidação</Button></div></div></Modal>}
    <ConfirmDialog
      open={novoCompromissoPendente != null}
      title={novoCompromissoPendente === "RECEBER" ? "Criar um novo valor a receber?" : "Criar um novo valor a pagar?"}
      message={<><p>Você já tem um rascunho de operação em andamento.</p><p className="mt-2">Para iniciar este novo lançamento, o rascunho atual será descartado. Os dados preenchidos e documentos anexados serão excluídos permanentemente.</p></>}
      confirmLabel="Criar mesmo assim"
      cancelLabel="Ver rascunho atual"
      cancelTone="safe"
      tone="danger"
      dangerFilled
      processando={preparando}
      onCancel={verRascunhoAtual}
      onDismiss={() => setNovoCompromissoPendente(null)}
      onConfirm={() => { void descartarECriarCompromisso(); }}
    />
  </PaginaFinanceira>;
}
