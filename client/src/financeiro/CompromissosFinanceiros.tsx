import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CalendarDays } from "lucide-react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { descartarRascunhoOperacao, listarCompromissos, obterConfiguracoesFinanceiras, obterRascunhoOperacao, type Compromisso, type ConfiguracoesFinanceiras } from "./novo-api";
import { brl, Button, dataBR, Empty, ErrorBox, mesAtual, Metric, PageHeader, PaginaCarregando, PaginaFinanceira, Panel, Pill, StatusPill } from "./financeiro-ui";
import type { Tab } from "../components/Shell";
import { abrirRotaNovaOperacao } from "../router";
import { tituloCompromisso } from "./lib/compromissos";
import { CalendarioCompromissos } from "./CalendarioCompromissos";
import { ControleVisaoCompromissos, type VisaoCompromissos } from "./ControleVisaoCompromissos";
import { LiquidarCompromissoModal } from "./LiquidarCompromissoModal";

export function CompromissosFinanceiros({ onNav, podeLancar = true }: { onNav: (tab: Tab) => void; podeLancar?: boolean }) {
  const [itens, setItens] = useState<Compromisso[]>([]); const [config, setConfig] = useState<ConfiguracoesFinanceiras | null>(null); const [pagando, setPagando] = useState<Compromisso | null>(null); const [erro, setErro] = useState<string | null>(null); const [aba, setAba] = useState<"PAGAR" | "RECEBER" | "LIQUIDADOS">("PAGAR"); const [soVencidos, setSoVencidos] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [visao, setVisao] = useState<VisaoCompromissos>("lista");
  const [mes, setMes] = useState(mesAtual());
  const [novoCompromissoPendente, setNovoCompromissoPendente] = useState<"PAGAR" | "RECEBER" | null>(null); const [preparando, setPreparando] = useState(false);
  const carregar = useCallback(() => Promise.all([listarCompromissos(), podeLancar ? obterConfiguracoesFinanceiras() : Promise.resolve(null)]).then(([c, cfg]) => { setItens(c); setConfig(cfg); }).catch((e) => setErro(e.message)).finally(() => setCarregando(false)), [podeLancar]);
  useEffect(() => { carregar(); }, [carregar]);
  const lista = itens
    .filter((c) => aba === "LIQUIDADOS" ? c.status === "LIQUIDADO" : c.tipo === aba && ["PENDENTE", "PARCIAL"].includes(c.status))
    .filter((c) => !soVencidos || c.vencido);
  const itensNaVisao = visao === "calendario" ? lista.filter(c => c.dataVencimento.startsWith(mes)) : lista;
  const total = itensNaVisao.reduce((s, c) => s + Number(c.saldoPendente), 0);
  const criarCompromisso = (tipo: "PAGAR" | "RECEBER") => { abrirRotaNovaOperacao(tipo); onNav("lancar"); };
  const verRascunhoAtual = () => {
    setNovoCompromissoPendente(null);
    abrirRotaNovaOperacao();
    onNav("lancar");
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
    <PageHeader titulo="Compromissos" descricao="Agenda de valores futuros. Vencimento indica prazo; o status informa se a obrigação está pendente, parcial ou liquidada." acao={podeLancar ? <div className="flex flex-wrap gap-2"><Button secondary disabled={preparando} onClick={() => { void prepararNovoCompromisso("RECEBER"); }}>Criar a receber</Button><Button disabled={preparando} onClick={() => { void prepararNovoCompromisso("PAGAR"); }}>Criar a pagar</Button></div> : undefined} />
    <ErrorBox erro={erro} />
    <div className="mt-6 grid gap-4 md:grid-cols-3"><Metric label="A pagar" valor={brl(itens.filter((c) => c.tipo === "PAGAR" && !["LIQUIDADO", "CANCELADO"].includes(c.status)).reduce((s, c) => s + Number(c.saldoPendente), 0))} detalhe="Saldo pendente" icon={ArrowUpRight} /><Metric label="A receber" valor={brl(itens.filter((c) => c.tipo === "RECEBER" && !["LIQUIDADO", "CANCELADO"].includes(c.status)).reduce((s, c) => s + Number(c.saldoPendente), 0))} detalhe="Saldo pendente" icon={ArrowDownLeft} /><Metric label="Vencidos" valor={String(itens.filter((c) => c.vencido).length)} detalhe="Condição de prazo, não status" icon={CalendarDays} tone="red" /></div>
    <Panel className="mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4"><div className="flex flex-wrap gap-2">{([['PAGAR', 'A pagar'], ['RECEBER', 'A receber'], ['LIQUIDADOS', 'Liquidados']] as const).map(([k, label]) => <button key={k} onClick={() => setAba(k)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${aba === k ? "bg-mast text-white" : "bg-[#f4f2e9] text-ink"}`}>{label}</button>)}</div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={soVencidos} onChange={(e) => setSoVencidos(e.target.checked)} /> Mostrar somente vencidos</label></div>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#faf9f4] px-5 py-3 text-sm"><div className="flex flex-wrap items-center gap-x-4 gap-y-2"><span className="text-ink-3">{itensNaVisao.length} compromissos {visao === "calendario" ? "no mês" : "na visão"}</span><strong className="whitespace-nowrap">Total pendente: {brl(total)}</strong></div><ControleVisaoCompromissos visao={visao} onChange={setVisao} /></div>
      {visao === "calendario" ? <CalendarioCompromissos itens={lista} mes={mes} onChangeMes={setMes} onLiquidar={podeLancar ? setPagando : undefined} /> : <>
      {lista.length ? <div className="divide-y divide-border">{lista.map((c) => <div key={c.id} className={`grid items-center gap-4 p-5 ${podeLancar ? "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,.8fr)_minmax(0,.7fr)_auto]" : "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,.8fr)_minmax(0,.7fr)]"}`}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="break-words">{tituloCompromisso(c)}</strong><StatusPill status={c.status} />{c.vencido && <Pill tone="red">Vencido</Pill>}</div><div className="mt-1 break-words text-xs text-ink-3">OP-{String(c.operacao.id).padStart(4, "0")} · {c.parceiro?.nome ?? "Sem parceiro"}</div></div><div className="min-w-0"><div className="text-xs text-ink-3">Vencimento</div><div className="mt-1 whitespace-nowrap font-medium">{dataBR(c.dataVencimento)}</div></div><div className="min-w-0 lg:text-right"><div className="text-xs text-ink-3">Saldo pendente</div><strong className={`mt-1 block whitespace-nowrap text-lg ${c.tipo === "RECEBER" ? "text-green-800" : ""}`}>{brl(c.saldoPendente)}</strong>{Number(c.valorLiquidado) > 0 && <div className="whitespace-nowrap text-[11px] text-ink-3">de {brl(c.valorOriginal)}</div>}</div>{podeLancar && (c.status !== "LIQUIDADO" && c.status !== "CANCELADO" ? <Button className="w-full lg:w-auto" secondary onClick={() => setPagando(c)}>{c.tipo === "PAGAR" ? "Registrar pagamento" : "Registrar recebimento"}</Button> : <span />)}</div>)}</div> : <Empty>Nenhum compromisso nesta visão.</Empty>}
      </>}
    </Panel>

    {podeLancar && pagando && <LiquidarCompromissoModal key={pagando.id} compromisso={pagando} contas={config?.contas ?? []} onClose={() => setPagando(null)} onLiquidado={carregar} onErro={setErro} />}
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
