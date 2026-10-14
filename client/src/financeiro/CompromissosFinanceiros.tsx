import { Button as ShadcnButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "../components/MultiSelect";
import { CompromissoDetalheDialog } from "./CompromissoDetalheDialog";
import { LinkOperacaoFinanceira } from "./LinkOperacaoFinanceira";
import { normalizarBuscaFinanceira } from "./ListaCadastroFinanceiro";
import { AtualizandoFinanceiro } from "./CarregamentoFinanceiro";
import { PeriodoFinanceiroControl } from "./PeriodoFinanceiroControl";
import { periodoInicial } from "./lib/periodo";
import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Search } from "lucide-react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { descartarRascunhoOperacao, listarCompromissos, obterConfiguracoesFinanceiras, obterRascunhoOperacao, type Compromisso, type ConfiguracoesFinanceiras } from "./novo-api";
import { brl, Button, CabecalhoTabela, dataBR, Empty, ErrorBox, mesAtual, Metric, PageHeader, PaginaCarregando, PaginaFinanceira, Panel, Pill, StatusPill, Paginacao, TabelaFinanceira } from "./financeiro-ui";
import type { Tab } from "../components/Shell";
import { abrirRotaNovaOperacao } from "../router";
import { tituloCompromisso } from "./lib/compromissos";
import { CalendarioCompromissos } from "./CalendarioCompromissos";
import { ControleVisaoCompromissos, type VisaoCompromissos } from "./ControleVisaoCompromissos";
import { LiquidarCompromissoModal } from "./LiquidarCompromissoModal";
import { codigoOperacao } from "../estoque/navegacao";

export function CompromissosFinanceiros({ onNav, podeLancar = true }: { onNav: (tab: Tab) => void; podeLancar?: boolean }) {
  const [carregou, setCarregou] = useState(false);
  const [itens, setItens] = useState<Compromisso[]>([]); const [config, setConfig] = useState<ConfiguracoesFinanceiras | null>(null); const [pagando, setPagando] = useState<Compromisso | null>(null); const [erro, setErro] = useState<string | null>(null); const [situacoes, setSituacoes] = useState<string[]>(() => { const situacao = new URLSearchParams(window.location.search).get("situacao"); return situacao === "todos" ? [] : [situacao === "receber" ? "RECEBER" : "PAGAR"]; }); const [soVencidos, setSoVencidos] = useState(false);
  const [periodo, setPeriodo] = useState(() => periodoInicial({ inicio: "", fim: "" }, { permitirVazio: true }));
  const [carregando, setCarregando] = useState(true);
  const [visao, setVisao] = useState<VisaoCompromissos>("lista");
  const [busca, setBusca] = useState("");
  useEffect(() => {
    const sincronizar = () => {
      if (window.location.pathname !== "/financeiro/compromissos") return;
      const proximo = periodoInicial({ inicio: "", fim: "" }, { permitirVazio: true });
      const situacao = new URLSearchParams(window.location.search).get("situacao");
      setPeriodo(proximo); setSituacoes(situacao === "todos" ? [] : [situacao === "receber" ? "RECEBER" : "PAGAR"]);
    };
    window.addEventListener("popstate", sincronizar);
    return () => window.removeEventListener("popstate", sincronizar);
  }, []);
  const [pagina, setPagina] = useState(1);
  const [selecionado, setSelecionado] = useState<Compromisso | null>(null);
  useEffect(() => setPagina(1), [situacoes, soVencidos, busca, periodo.inicio, periodo.fim]);
  const [mes, setMes] = useState(() => periodo.inicio.slice(0, 7) || mesAtual());
  const [novoCompromissoPendente, setNovoCompromissoPendente] = useState<"PAGAR" | "RECEBER" | null>(null); const [preparando, setPreparando] = useState(false);
  const carregar = useCallback(async (vigente: () => boolean = () => true) => {
    setCarregando(true); setErro(null);
    try { const [c, cfg] = await Promise.all([listarCompromissos(), podeLancar ? obterConfiguracoesFinanceiras() : Promise.resolve(null)]); if (vigente()) { setItens(c); setConfig(cfg); } }
    catch (e) { if (vigente()) { setItens([]); setErro(e instanceof Error ? e.message : String(e)); } }
    finally { if (vigente()) { setCarregando(false); setCarregou(true); } }
  }, [podeLancar]);
  useEffect(() => { let vigente = true; void carregar(() => vigente); return () => { vigente = false; }; }, [carregar]);
  const lista = itens
    .filter(c => !situacoes.length || situacoes.some(s => s === "LIQUIDADOS" ? c.status === "LIQUIDADO" : c.tipo === s && ["PENDENTE", "PARCIAL"].includes(c.status)))
    .filter(c => (!periodo.inicio || c.dataVencimento.slice(0, 10) >= periodo.inicio) && (!periodo.fim || c.dataVencimento.slice(0, 10) <= periodo.fim))
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

  if (carregando && !carregou && !erro) return <PaginaCarregando label="Carregando compromissos" />;

  return <PaginaFinanceira colorida>
    <PageHeader eyebrow="" titulo="Compromissos" descricao="Acompanhe saldos pendentes e consulte os vencimentos e liquidações." acao={podeLancar ? <div className="flex flex-wrap gap-2"><Button secondary disabled={preparando} onClick={() => { void prepararNovoCompromisso("RECEBER"); }}>Criar a receber</Button><Button disabled={preparando} onClick={() => { void prepararNovoCompromisso("PAGAR"); }}>Criar a pagar</Button></div> : undefined} />
    <ErrorBox erro={erro} />
    {erro && <Button secondary onClick={() => { void carregar(); }}>Tentar novamente</Button>}
    {carregando && <AtualizandoFinanceiro />}
    {!erro && <div aria-busy={carregando} {...(carregando ? { inert: "" } : {})}>
    <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 [&>section:last-child]:col-span-2 md:[&>section:last-child]:col-span-1"><Metric compacto tom="pendente" label="A pagar" valor={brl(itens.filter((c) => c.tipo === "PAGAR" && !["LIQUIDADO", "CANCELADO"].includes(c.status)).reduce((s, c) => s + Number(c.saldoPendente), 0))} detalhe="Saldo pendente" icon={ArrowUpRight} /><Metric compacto tom="entrada" label="A receber" valor={brl(itens.filter((c) => c.tipo === "RECEBER" && !["LIQUIDADO", "CANCELADO"].includes(c.status)).reduce((s, c) => s + Number(c.saldoPendente), 0))} detalhe="Saldo pendente" icon={ArrowDownLeft} /><Metric compacto tom="alerta" label="Vencidos" valor={String(itens.filter((c) => c.vencido).length)} detalhe="Condição de prazo, não status" icon={CalendarDays} tone="red" /></div>
    <Panel tom="pendente" className="fin-painel mt-4 overflow-hidden">
      <CabecalhoTabela titulo="Compromissos financeiros" />
      <div className="fin-cabecalho fin-filtros-barra flex flex-wrap items-center gap-3 border-b border-border p-4">
        <label className="fin-filtro-busca min-w-0 text-sm font-medium">Buscar compromisso<span className="relative mt-2 block"><Search aria-hidden="true" size={16} strokeWidth={1.8} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" /><Input type="search" placeholder="Descrição, parceiro ou operação…" value={busca} onChange={e => setBusca(e.target.value)} className="w-full bg-card pl-9 font-normal" /></span></label>
        <div className="fin-filtro-controle"><MultiSelect compacto label="Situação dos compromissos" placeholder="Todas as situações" value={situacoes} onValueChange={setSituacoes} options={[{ value: "PAGAR", label: "A pagar" }, { value: "RECEBER", label: "A receber" }, { value: "LIQUIDADOS", label: "Liquidados" }]} /></div>
        <div className="fin-filtro-controle"><span className="mb-2 block text-sm font-medium">Vencimento</span><PeriodoFinanceiroControl inicio={periodo.inicio} fim={periodo.fim} allowAll label="Período de vencimento" onChange={p => { setPeriodo(p); if (p.inicio) setMes(p.inicio.slice(0, 7)); }} /></div>
        <label className="flex min-h-10 items-center gap-2 text-sm"><Checkbox aria-label="Mostrar somente vencidos" checked={soVencidos} onCheckedChange={v => setSoVencidos(v === true)} />Somente vencidos</label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted px-4 py-3 text-sm"><div className="flex flex-wrap items-center gap-x-4 gap-y-2"><span className="text-ink-3">{itensNaVisao.length} compromissos {visao === "calendario" ? "no mês" : "na visão"}</span><strong className="whitespace-nowrap">Total pendente: {brl(total)}</strong></div><ControleVisaoCompromissos visao={visao} onChange={setVisao} /></div>
      {visao === "calendario" ? <CalendarioCompromissos itens={lista} mes={mes} onChangeMes={setMes} onLiquidar={podeLancar ? setPagando : undefined} /> : <>
      {lista.length ? <>
        <TabelaFinanceira compacta cartaoComLinks rotulo="Compromissos financeiros" itens={lista.slice((paginaAtual - 1) * 15, paginaAtual * 15)} chaveDe={c => c.id} onAbrir={setSelecionado} classeLinha={c => c.vencido ? "border-l-2 border-l-destructive" : ""} colunas={[
          { chave: "descricao", titulo: "Compromisso", principal: true, larguraMinima: 300, celula: c => <><strong>{tituloCompromisso(c)}</strong><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3"><LinkOperacaoFinanceira id={c.operacao.id} numero={c.operacao.numero} /><span>{c.parceiro?.nome ?? "Sem parceiro"}</span><StatusPill status={c.status} />{c.vencido && <Pill tone="red">Vencido</Pill>}</div></> },
          { chave: "vencimento", titulo: "Vencimento", larguraMinima: 120, celula: c => <span className="whitespace-nowrap">{dataBR(c.dataVencimento)}</span> },
          { chave: "valor", titulo: "Saldo pendente", alinhamento: "direita", larguraMinima: 150, celula: c => <><strong className={`whitespace-nowrap ${c.status === "CANCELADO" ? "text-ink-3" : c.tipo === "RECEBER" ? "text-[var(--fin-entrada)]" : "text-foreground"}`}>{brl(c.status === "CANCELADO" ? c.valorOriginal : c.saldoPendente)}</strong>{c.status === "CANCELADO" ? <div className="text-xs text-ink-3">Valor original (cancelado)</div> : Number(c.valorLiquidado) > 0 && <div className="text-xs text-ink-3">de {brl(c.valorOriginal)}</div>}</> },
          ...(podeLancar ? [{ chave: "acao", titulo: "Ação", acoes: true, larguraMinima: 170, celula: (c: Compromisso) => ["PENDENTE", "PARCIAL"].includes(c.status) ? <ShadcnButton variant="outline" className="w-full md:w-auto" onClick={e => { e.stopPropagation(); setPagando(c); }}>{c.tipo === "PAGAR" ? "Registrar pagamento" : "Registrar recebimento"}</ShadcnButton> : null }] : []),
        ]} />
        <Paginacao pagina={paginaAtual} totalPaginas={totalPaginas} total={lista.length} porPagina={15} rotulo="Paginação dos compromissos" substantivo="compromissos" idSelect="pagina-compromissos" onPagina={setPagina} />
      </> : <Empty>Nenhum compromisso nesta visão. Ajuste a busca ou os filtros.</Empty>}
      </>}
    </Panel></div>}

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
