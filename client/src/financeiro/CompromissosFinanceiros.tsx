import { Button as ShadcnButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CompromissoDetalheDialog } from "./CompromissoDetalheDialog";
import { LinkOperacaoFinanceira } from "./LinkOperacaoFinanceira";
import { normalizarBuscaFinanceira } from "./ListaCadastroFinanceiro";
import { SkeletonListaFinanceira } from "./CarregamentoFinanceiro";
import { PeriodoFinanceiroControl } from "./PeriodoFinanceiroControl";
import { periodoInicial } from "./lib/periodo";
import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CalendarDays } from "lucide-react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { descartarRascunhoOperacao, listarCompromissos, obterConfiguracoesFinanceiras, obterRascunhoOperacao, type Compromisso, type ConfiguracoesFinanceiras } from "./novo-api";
import { brl, Button, dataBR, Empty, ErrorBox, mesAtual, Metric, PageHeader, PaginaCarregando, PaginaFinanceira, Panel, Pill, StatusPill, Paginacao, TabelaFinanceira } from "./financeiro-ui";
import type { Tab } from "../components/Shell";
import { abrirRotaNovaOperacao } from "../router";
import { tituloCompromisso } from "./lib/compromissos";
import { CalendarioCompromissos } from "./CalendarioCompromissos";
import { ControleVisaoCompromissos, type VisaoCompromissos } from "./ControleVisaoCompromissos";
import { LiquidarCompromissoModal } from "./LiquidarCompromissoModal";
import { codigoOperacao } from "../estoque/navegacao";

export function CompromissosFinanceiros({ onNav, podeLancar = true }: { onNav: (tab: Tab) => void; podeLancar?: boolean }) {
  const [itens, setItens] = useState<Compromisso[]>([]); const [config, setConfig] = useState<ConfiguracoesFinanceiras | null>(null); const [pagando, setPagando] = useState<Compromisso | null>(null); const [erro, setErro] = useState<string | null>(null); const [aba, setAba] = useState<"PAGAR" | "RECEBER" | "LIQUIDADOS" | "TODOS">(() => new URLSearchParams(window.location.search).get("situacao") === "todos" ? "TODOS" : new URLSearchParams(window.location.search).get("situacao") === "receber" ? "RECEBER" : "PAGAR"); const [soVencidos, setSoVencidos] = useState(false);
  const [periodo, setPeriodo] = useState(() => periodoInicial({ inicio: "", fim: "" }, { permitirVazio: true }));
  const [carregando, setCarregando] = useState(true);
  const [visao, setVisao] = useState<VisaoCompromissos>("lista");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [selecionado, setSelecionado] = useState<Compromisso | null>(null);
  useEffect(() => setPagina(1), [aba, soVencidos, busca, periodo.inicio, periodo.fim]);
  const [mes, setMes] = useState(() => periodo.inicio.slice(0, 7) || mesAtual());
  const [novoCompromissoPendente, setNovoCompromissoPendente] = useState<"PAGAR" | "RECEBER" | null>(null); const [preparando, setPreparando] = useState(false);
  const carregar = useCallback(async (vigente: () => boolean = () => true) => {
    setCarregando(true); setErro(null); setItens([]);
    try { const [c, cfg] = await Promise.all([listarCompromissos(periodo), podeLancar ? obterConfiguracoesFinanceiras() : Promise.resolve(null)]); if (vigente()) { setItens(c); setConfig(cfg); } }
    catch (e) { if (vigente()) setErro(e instanceof Error ? e.message : String(e)); }
    finally { if (vigente()) setCarregando(false); }
  }, [podeLancar, periodo]);
  useEffect(() => { let vigente = true; void carregar(() => vigente); return () => { vigente = false; }; }, [carregar]);
  const lista = itens
    .filter((c) => aba === "TODOS" || (aba === "LIQUIDADOS" ? c.status === "LIQUIDADO" : c.tipo === aba && ["PENDENTE", "PARCIAL"].includes(c.status)))
    .filter((c) => !soVencidos || c.vencido)
    .filter(c => normalizarBuscaFinanceira(`${tituloCompromisso(c)} ${c.parceiro?.nome ?? ""} ${codigoOperacao(c.operacao.numero)}`).includes(normalizarBuscaFinanceira(busca)));
  const totalPaginas = Math.max(1, Math.ceil(lista.length / 15));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const itensNaVisao = visao === "calendario" ? lista.filter(c => c.dataVencimento.startsWith(mes)) : lista;
  const total = itensNaVisao.filter(c => ["PENDENTE", "PARCIAL"].includes(c.status)).reduce((s, c) => s + Number(c.saldoPendente), 0);
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

  if (carregando && !config && !erro) return <PaginaCarregando label="Carregando compromissos" />;

  return <PaginaFinanceira colorida>
    <PageHeader eyebrow="" titulo="Compromissos" descricao="Consulte vencimentos, saldos e liquidações do período." acao={podeLancar ? <div className="flex flex-wrap gap-2"><Button secondary disabled={preparando} onClick={() => { void prepararNovoCompromisso("RECEBER"); }}>Criar a receber</Button><Button disabled={preparando} onClick={() => { void prepararNovoCompromisso("PAGAR"); }}>Criar a pagar</Button></div> : undefined} />
    <ErrorBox erro={erro} />
    <div className="mt-4 flex flex-wrap items-center gap-3"><PeriodoFinanceiroControl inicio={periodo.inicio} fim={periodo.fim} allowAll label="Período de vencimento" onChange={p => { setPeriodo(p); if (p.inicio) setMes(p.inicio.slice(0, 7)); }} /><span className="text-xs text-ink-3">Filtro pela data de vencimento, inclusive nos liquidados.</span></div>
    {carregando && <p role="status">Carregando compromissos do período…</p>}
    <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 [&>section:last-child]:col-span-2 md:[&>section:last-child]:col-span-1"><Metric compacto tom="pendente" label="A pagar" valor={brl(itens.filter((c) => c.tipo === "PAGAR" && !["LIQUIDADO", "CANCELADO"].includes(c.status)).reduce((s, c) => s + Number(c.saldoPendente), 0))} detalhe="Saldo pendente" icon={ArrowUpRight} /><Metric compacto tom="entrada" label="A receber" valor={brl(itens.filter((c) => c.tipo === "RECEBER" && !["LIQUIDADO", "CANCELADO"].includes(c.status)).reduce((s, c) => s + Number(c.saldoPendente), 0))} detalhe="Saldo pendente" icon={ArrowDownLeft} /><Metric compacto tom="alerta" label="Vencidos" valor={String(itens.filter((c) => c.vencido).length)} detalhe="Condição de prazo, não status" icon={CalendarDays} tone="red" /></div>
    <Panel tom="pendente" className="fin-painel mt-3 overflow-hidden">
      <div className="fin-cabecalho flex flex-wrap items-center gap-3 border-b border-border p-3">
        <ToggleGroup type="single" value={aba} onValueChange={v => { if (v) setAba(v as typeof aba); }} aria-label="Situação dos compromissos" className="flex-wrap justify-start rounded-md border border-border bg-card">
          {([['PAGAR', 'A pagar'], ['RECEBER', 'A receber'], ['LIQUIDADOS', 'Liquidados'], ['TODOS', 'Todos']] as const).map(([k, label]) => <ToggleGroupItem key={k} value={k} className="data-[state=on]:bg-mast data-[state=on]:text-white">{label}</ToggleGroupItem>)}
        </ToggleGroup>
        <Input aria-label="Buscar compromisso" type="search" placeholder="Buscar descrição, parceiro ou operação…" value={busca} onChange={e => setBusca(e.target.value)} className="min-w-0 flex-[1_1_240px] bg-card" />
        <label className="flex items-center gap-2 text-sm"><Checkbox aria-label="Mostrar somente vencidos" checked={soVencidos} onCheckedChange={v => setSoVencidos(v === true)} />Somente vencidos</label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted px-3 py-2 text-sm"><div className="flex flex-wrap items-center gap-x-4 gap-y-2"><span className="text-ink-3">{itensNaVisao.length} compromissos {visao === "calendario" ? "no mês" : "na visão"}</span><strong className="whitespace-nowrap">Total pendente: {brl(total)}</strong></div><ControleVisaoCompromissos visao={visao} onChange={setVisao} /></div>
      {visao === "calendario" ? <CalendarioCompromissos itens={lista} mes={mes} onChangeMes={setMes} onLiquidar={podeLancar ? setPagando : undefined} /> : <>
      {carregando ? <SkeletonListaFinanceira label="Carregando compromissos do período" /> : lista.length ? <>
        <Paginacao pagina={paginaAtual} totalPaginas={totalPaginas} total={lista.length} porPagina={15} rotulo="Paginação dos compromissos" substantivo="compromissos" idSelect="pagina-compromissos" onPagina={setPagina} />
        <TabelaFinanceira compacta cartaoComLinks rotulo="Compromissos financeiros" itens={lista.slice((paginaAtual - 1) * 15, paginaAtual * 15)} chaveDe={c => c.id} onAbrir={setSelecionado} classeLinha={c => c.vencido ? "border-l-2 border-l-destructive" : ""} colunas={[
          { chave: "descricao", titulo: "Compromisso", principal: true, larguraMinima: 300, celula: c => <><strong>{tituloCompromisso(c)}</strong><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3"><LinkOperacaoFinanceira id={c.operacao.id} numero={c.operacao.numero} /><span>{c.parceiro?.nome ?? "Sem parceiro"}</span><StatusPill status={c.status} />{c.vencido && <Pill tone="red">Vencido</Pill>}</div></> },
          { chave: "vencimento", titulo: "Vencimento", larguraMinima: 120, celula: c => <span className="whitespace-nowrap">{dataBR(c.dataVencimento)}</span> },
          { chave: "valor", titulo: "Saldo pendente", alinhamento: "direita", larguraMinima: 150, celula: c => <><strong className={`whitespace-nowrap ${c.status === "CANCELADO" ? "text-ink-3" : c.tipo === "RECEBER" ? "text-[var(--fin-entrada)]" : "text-[var(--fin-saida)]"}`}>{brl(c.status === "CANCELADO" ? c.valorOriginal : c.saldoPendente)}</strong>{c.status === "CANCELADO" ? <div className="text-xs text-ink-3">Valor original (cancelado)</div> : Number(c.valorLiquidado) > 0 && <div className="text-xs text-ink-3">de {brl(c.valorOriginal)}</div>}</> },
          ...(podeLancar ? [{ chave: "acao", titulo: "Ação", acoes: true, larguraMinima: 170, celula: (c: Compromisso) => ["PENDENTE", "PARCIAL"].includes(c.status) ? <ShadcnButton variant="outline" className="w-full md:w-auto" onClick={e => { e.stopPropagation(); setPagando(c); }}>{c.tipo === "PAGAR" ? "Registrar pagamento" : "Registrar recebimento"}</ShadcnButton> : null }] : []),
        ]} />
      </> : <Empty>Nenhum compromisso nesta visão. Ajuste a busca ou os filtros.</Empty>}
      </>}
    </Panel>

    {selecionado && <CompromissoDetalheDialog compromisso={selecionado} onClose={() => setSelecionado(null)} onLiquidar={podeLancar ? c => { setSelecionado(null); setPagando(c); } : undefined} />}
    {podeLancar && pagando && <LiquidarCompromissoModal key={pagando.id} compromisso={pagando} contas={config?.contas ?? []} onClose={() => setPagando(null)} onLiquidado={() => carregar()} onErro={setErro} />}
    <ConfirmDialog
      open={novoCompromissoPendente != null}
      title={novoCompromissoPendente === "RECEBER" ? "Criar um novo valor a receber?" : "Criar um novo valor a pagar?"}
      message={<><p>Você já tem um rascunho de operação em andamento.</p><p className="mt-2">Para iniciar este novo lançamento, o rascunho atual será descartado. Os dados preenchidos e documentos anexados serão excluídos permanentemente.</p></>}
      confirmLabel="Criar mesmo assim"
      cancelLabel="Ver rascunho atual"
      cancelTone="safe"
      tone="danger"
      processando={preparando}
      onCancel={verRascunhoAtual}
      onDismiss={() => setNovoCompromissoPendente(null)}
      onConfirm={() => { void descartarECriarCompromisso(); }}
    />
  </PaginaFinanceira>;
}
