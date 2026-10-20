import "./compromissos-consulta.css";
import { useFiltrosTabelaLocal } from "./useFiltrosTabelaLocal";
import { useRascunhoConsulta } from "./useRascunhoConsulta";
import { filtrosDasColunas, type CampoConsulta } from "./FiltroColunaConsulta";
import { BarraConsulta } from "@/financeiro/BarraConsulta";
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
import { ArrowDownLeft, ArrowUpRight, CalendarDays, CircleAlert, Search, X } from "lucide-react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { descartarRascunhoOperacao, listarCompromissos, obterConfiguracoesFinanceiras, obterRascunhoOperacao, type Compromisso, type ConfiguracoesFinanceiras } from "./novo-api";
import { brl, Button, dataBR, Empty, ErrorBox, mesAtual, Metric, PageHeader, PaginaCarregando, PaginaFinanceira, Panel, StatusPill, Paginacao, TabelaFinanceira } from "./financeiro-ui";
import type { Tab } from "../components/Shell";
import { abrirRotaNovaOperacao } from "../router";
import { tituloCompromisso } from "./lib/compromissos";
import { CalendarioCompromissos } from "./CalendarioCompromissos";
import { ControleVisaoCompromissos, type VisaoCompromissos } from "./ControleVisaoCompromissos";
import { LiquidarCompromissoModal } from "./LiquidarCompromissoModal";
import { deCentavos, paraCentavos } from "./lib/parcelas";
import { ParceiroOperacao } from "./ContextoOperacao";
import { codigoOperacao } from "../estoque/navegacao";

const SITUACOES_COMPROMISSO = ["PENDENTE", "PARCIAL", "LIQUIDADO", "CANCELADO"];
function criteriosIniciaisCompromissos() {
  const query = new URLSearchParams(window.location.search);
  const situacao = query.get("situacao");
  const status = query.get("status");
  return {
    tipos: situacao === "todos" ? [] : [situacao === "receber" ? "RECEBER" : "PAGAR"],
    status: status === "todos" || (!status && situacao === "todos") ? [] : status ? status.split(",").filter(s => SITUACOES_COMPROMISSO.includes(s)) : ["PENDENTE", "PARCIAL"],
    vencidos: query.get("vencidos") === "1",
  };
}

export function CompromissosFinanceiros({ onNav, podeLancar = true }: { onNav: (tab: Tab) => void; podeLancar?: boolean }) {
  const [carregou, setCarregou] = useState(false);
  const [itens, setItens] = useState<Compromisso[]>([]); const [config, setConfig] = useState<ConfiguracoesFinanceiras | null>(null); const [pagando, setPagando] = useState<Compromisso | null>(null); const [erro, setErro] = useState<string | null>(null); const [situacoes, setSituacoes] = useState<string[]>(() => criteriosIniciaisCompromissos().tipos);
  const [soVencidos, setSoVencidos] = useState(() => criteriosIniciaisCompromissos().vencidos);
  const [status, setStatus] = useState<string[]>(() => criteriosIniciaisCompromissos().status);
  const selecionarTipo = (tipos: string[]) => setSituacoes(tipos);
  const [periodo, setPeriodo] = useState(() => periodoInicial({ inicio: "", fim: "" }, { permitirVazio: true }));
  const [carregando, setCarregando] = useState(true);
  const [visao, setVisao] = useState<VisaoCompromissos>("lista");
  const [busca, setBusca] = useState("");
  useEffect(() => {
    const sincronizar = () => {
      if (window.location.pathname !== "/financeiro/compromissos") return;
      const proximo = periodoInicial({ inicio: "", fim: "" }, { permitirVazio: true });
      const criterios = criteriosIniciaisCompromissos();
      setPeriodo(proximo); setSituacoes(criterios.tipos); setStatus(criterios.status); setSoVencidos(criterios.vencidos);
    };
    window.addEventListener("popstate", sincronizar);
    return () => window.removeEventListener("popstate", sincronizar);
  }, []);
  const [pagina, setPagina] = useState(1);
  const [selecionado, setSelecionado] = useState<Compromisso | null>(null);
  useEffect(() => {
    const alvo = new URLSearchParams(window.location.search).get("compromisso");
    if (alvo) { const item = itens.find(c => c.id === alvo); if (item) setSelecionado(item); }
  }, [itens]);
  const fecharDetalhe = () => {
    setSelecionado(null);
    const url = new URL(window.location.href); url.searchParams.delete("compromisso");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  };

  useEffect(() => setPagina(1), [situacoes, status, soVencidos, busca, periodo.inicio, periodo.fim]);
  useEffect(() => {
    if (window.location.pathname !== "/financeiro/compromissos") return;
    const url = new URL(window.location.href);
    url.searchParams.set("situacao", situacoes.length === 1 ? situacoes[0] === "RECEBER" ? "receber" : "pagar" : "todos");
    url.searchParams.set("status", status.join(",") || "todos");
    if (soVencidos) url.searchParams.set("vencidos", "1"); else url.searchParams.delete("vencidos");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [situacoes, status, soVencidos]);
  const [mes, setMes] = useState(() => periodo.inicio.slice(0, 7) || mesAtual());
  const [novoCompromissoPendente, setNovoCompromissoPendente] = useState<"PAGAR" | "RECEBER" | null>(null); const [preparando, setPreparando] = useState(false);
  const carregar = useCallback(async (vigente: () => boolean = () => true) => {
    setCarregando(true); setErro(null);
    try { const [c, cfg] = await Promise.all([listarCompromissos(), podeLancar ? obterConfiguracoesFinanceiras() : Promise.resolve(null)]); if (vigente()) { setItens(c); setConfig(cfg); } }
    catch (e) { if (vigente()) { setItens([]); setErro(e instanceof Error ? e.message : String(e)); } }
    finally { if (vigente()) { setCarregando(false); setCarregou(true); } }
  }, [podeLancar]);
  useEffect(() => { let vigente = true; void carregar(() => vigente); return () => { vigente = false; }; }, [carregar]);
  const consultaColunas = useFiltrosTabelaLocal<Compromisso>([
    { chave: "parceiro", rotulo: "Parceiro", tipo: "opcoes", obter: c => c.parceiro?.id ?? "SEM", opcoes: [{ valor: "SEM", texto: "Sem parceiro" }, ...Array.from(new Map(itens.filter(c => c.parceiro).map(c => [c.parceiro!.id, { valor: c.parceiro!.id, texto: c.parceiro!.nome }])).values())] },
    { chave: "valor", rotulo: "Saldo pendente", tipo: "valor", obter: c => c.status === "CANCELADO" ? "0" : c.saldoPendente, limiteSugerido: Math.max(1, ...itens.map(c => Number(c.saldoPendente))) },
  ], () => setPagina(1));
  const edicaoSituacao = useRascunhoConsulta({ situacoes, status, soVencidos }, { situacoes: [] as string[], status: [] as string[], soVencidos: false }, v => { selecionarTipo(v.situacoes); setStatus(v.status); setSoVencidos(v.soVencidos); });
  const edicao = { iniciar: () => { edicaoSituacao.iniciar(); consultaColunas.edicao.iniciar(); }, limpar: () => { edicaoSituacao.limpar(); consultaColunas.edicao.limpar(); }, aplicar: () => { edicaoSituacao.aplicar(); consultaColunas.edicao.aplicar(); setPagina(1); } };
  const camposSituacao: CampoConsulta[] = [
    { chave: "tipo", naBarra: true, colunas: [], ativo: !!situacoes.length, limpar: () => edicaoSituacao.editar("situacoes", []), conteudo: <MultiSelect compacto label="Tipo de compromisso" placeholder="Todos os tipos" value={edicaoSituacao.rascunho.situacoes} onValueChange={v => edicaoSituacao.editar("situacoes", v)} options={[{ value: "PAGAR", label: "A pagar" }, { value: "RECEBER", label: "A receber" }]} /> },
    { chave: "status", ativo: !!status.length, limpar: () => edicaoSituacao.editar("status", []), conteudo: <MultiSelect compacto label="Situação dos compromissos" placeholder="Todas as situações" value={edicaoSituacao.rascunho.status} onValueChange={v => edicaoSituacao.editar("status", v)} options={[{ value: "PENDENTE", label: "Pendente" }, { value: "PARCIAL", label: "Parcial" }, { value: "LIQUIDADO", label: "Liquidado" }, { value: "CANCELADO", label: "Cancelado" }]} /> },
    { chave: "vencidos", colunas: [], ativo: soVencidos, limpar: () => edicaoSituacao.editar("soVencidos", false), conteudo: <label className="flex items-center gap-2"><Checkbox aria-label="Mostrar somente vencidos" checked={edicaoSituacao.rascunho.soVencidos} onCheckedChange={v => edicaoSituacao.editar("soVencidos", v === true)} />Somente vencidos</label> },
  ];
  const campos = [...camposSituacao, ...consultaColunas.campos];
  const lista = consultaColunas.filtrar(itens)
    .filter(c => !situacoes.length || situacoes.includes(c.tipo))
    .filter(c => !status.length || status.includes(c.status))
    .filter(c => (!periodo.inicio || c.dataVencimento.slice(0, 10) >= periodo.inicio) && (!periodo.fim || c.dataVencimento.slice(0, 10) <= periodo.fim))
    .filter((c) => !soVencidos || c.vencido)
    .filter(c => normalizarBuscaFinanceira(`${tituloCompromisso(c)} ${c.parceiro?.nome ?? ""} ${codigoOperacao(c.operacao.numero)}`).includes(normalizarBuscaFinanceira(busca)));
  const totalPaginas = Math.max(1, Math.ceil(lista.length / 15));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const itensNaVisao = visao === "calendario" ? lista.filter(c => c.dataVencimento.startsWith(mes)) : lista;
  const somarPendentes = (colecao: Compromisso[], tipo: "PAGAR" | "RECEBER") => {
    const abertos = colecao.filter(c => c.tipo === tipo && ["PENDENTE", "PARCIAL"].includes(c.status));
    return abertos.some(c => c.saldoPendente == null) ? null : deCentavos(abertos.reduce((soma, c) => soma + (paraCentavos(c.saldoPendente) ?? 0), 0));
  };
  const totais = { PAGAR: somarPendentes(itensNaVisao, "PAGAR"), RECEBER: somarPendentes(itensNaVisao, "RECEBER") };
  const tiposExibidos = (["PAGAR", "RECEBER"] as const).filter(tipo => !situacoes.length || situacoes.includes(tipo));
  const emAberto = status.length === 2 && status.includes("PENDENTE") && status.includes("PARCIAL");
  const selecionarCard = (tipo: "PAGAR" | "RECEBER" | "VENCIDOS") => { selecionarTipo(tipo === "VENCIDOS" ? [] : [tipo]); setStatus(["PENDENTE", "PARCIAL"]); setSoVencidos(tipo === "VENCIDOS"); setPagina(1); };
  const resumoTotal = <div className="compromissos-totais">{tiposExibidos.map(tipo => <div key={tipo}><span>{tipo === "PAGAR" ? "Total a pagar" : "Total a receber"}</span><strong>{brl(totais[tipo])}</strong></div>)}</div>;

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
    <PageHeader eyebrow="" titulo="Compromissos" descricao="Acompanhe vencimentos, valores pendentes e registre pagamentos e recebimentos." acao={podeLancar ? <div className="flex flex-wrap gap-2"><Button secondary disabled={preparando} onClick={() => { void prepararNovoCompromisso("RECEBER"); }}>Criar a receber</Button><Button disabled={preparando} onClick={() => { void prepararNovoCompromisso("PAGAR"); }}>Criar a pagar</Button></div> : undefined} />
    <ErrorBox erro={erro} />
    {erro && <Button secondary onClick={() => { void carregar(); }}>Tentar novamente</Button>}
    {carregando && <AtualizandoFinanceiro />}
    {!erro && <div aria-busy={carregando} {...(carregando ? { inert: "" } : {})}>
    <div className="compromissos-indicadores">
      <div className="compromissos-indicador"><button className="compromissos-card-acionador" type="button" aria-label="Ver compromissos a pagar" aria-pressed={situacoes.length === 1 && situacoes[0] === "PAGAR" && !soVencidos} onClick={() => selecionarCard("PAGAR")} /><Metric compacto tom="pendente" label="A pagar" valor={brl(somarPendentes(itens, "PAGAR"))} detalhe="Saldo pendente" icon={ArrowUpRight} /></div>
      <div className="compromissos-indicador"><button className="compromissos-card-acionador" type="button" aria-label="Ver compromissos a receber" aria-pressed={situacoes.length === 1 && situacoes[0] === "RECEBER" && !soVencidos} onClick={() => selecionarCard("RECEBER")} /><Metric compacto tom="entrada" label="A receber" valor={brl(somarPendentes(itens, "RECEBER"))} detalhe="Saldo pendente" icon={ArrowDownLeft} /></div>
      <div className="compromissos-indicador compromissos-indicador-vencidos"><button className="compromissos-card-acionador" type="button" aria-label="Ver compromissos vencidos" aria-pressed={soVencidos} onClick={() => selecionarCard("VENCIDOS")} /><Metric compacto tom="alerta" label="Vencidos" valor={String(itens.filter(c => c.vencido).length)} detalhe="Com saldo pendente" icon={CalendarDays} tone="red" /></div>
    </div>
    <Panel tom="pendente" className="fin-painel compromissos-consulta mt-4 overflow-hidden">
      <div className="compromissos-controles">
        <div role="group" aria-label="Tipo de compromisso" className="compromissos-tipos">{(["PAGAR", "RECEBER"] as const).map(tipo => <ShadcnButton key={tipo} variant={situacoes.length === 1 && situacoes.includes(tipo) ? "default" : "ghost"} aria-pressed={situacoes.length === 1 && situacoes.includes(tipo)} onClick={() => selecionarTipo([tipo])}>{tipo === "PAGAR" ? "A pagar" : "A receber"}</ShadcnButton>)}</div>
        {emAberto && <ShadcnButton variant="outline" className="compromissos-abertos" aria-label="Remover filtro: Em aberto" onClick={() => setStatus([])}>Em aberto<X size={14} aria-hidden /></ShadcnButton>}
        <div className="compromissos-controles-direita">{resumoTotal}<ControleVisaoCompromissos visao={visao} onChange={setVisao} /></div>
      </div>
      <BarraConsulta campos={campos} edicaoFiltros={edicao} erroFiltros={consultaColunas.erro} criterios={[...consultaColunas.criterios, ...(!emAberto && status.length ? [{id:"status",rotulo:`Situação: ${status.map(v => ({PENDENTE:"Pendente",PARCIAL:"Parcial",LIQUIDADO:"Liquidado",CANCELADO:"Cancelado"}[v] ?? v)).join(", ")}`,limpar:()=>setStatus([])}] : []), ...(soVencidos ? [{id:"vencidos",rotulo:"Somente vencidos",limpar:()=>setSoVencidos(false)}] : [])]}>
        <label className="fin-filtro-busca min-w-0"><span className="sr-only">Buscar compromisso</span><span className="relative block"><Search aria-hidden="true" size={16} strokeWidth={1.8} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" /><Input type="search" placeholder="Descrição, parceiro ou operação…" value={busca} onChange={e => setBusca(e.target.value)} className="w-full bg-card pl-9 font-normal" /></span></label>
        <div className="fin-filtro-controle"><PeriodoFinanceiroControl showIcon inicio={periodo.inicio} fim={periodo.fim} allowAll label="Período de vencimento" onChange={p => { setPeriodo(p); if (p.inicio) setMes(p.inicio.slice(0, 7)); }} /></div>

      </BarraConsulta>
      {visao === "calendario" ? <CalendarioCompromissos itens={lista} mes={mes} onChangeMes={setMes} onLiquidar={podeLancar ? setPagando : undefined} /> : <>
      {lista.length ? <>
        <TabelaFinanceira filtrosColunas={filtrosDasColunas(campos, edicao, consultaColunas.erro)} compacta cartaoComLinks rotulo="Compromissos financeiros" itens={lista.slice((paginaAtual - 1) * 15, paginaAtual * 15)} chaveDe={c => c.id} onAbrir={setSelecionado} classeLinha={c => c.vencido ? "compromisso-vencido" : ""} colunas={[
          { chave: "descricao", titulo: "Compromisso", principal: true, larguraMinima: 240, larguraFlexivel: true, celula: c => <><strong>{tituloCompromisso(c)}</strong><div className="mt-1 text-xs text-ink-3"><LinkOperacaoFinanceira id={c.operacao.id} numero={c.operacao.numero} /></div></> },
          { chave: "parceiro", titulo: "Parceiro", larguraMinima: 180, celula: c => <ParceiroOperacao parceiro={c.parceiro} /> },
          { chave: "vencimento", titulo: "Vencimento", larguraMinima: 135, celula: c => <div className={c.vencido ? "compromisso-vencimento-atrasado" : ""}><time dateTime={c.dataVencimento}>{dataBR(c.dataVencimento)}</time>{c.vencido && <span className="compromisso-atraso"><CircleAlert size={14} aria-hidden />Vencido</span>}</div> },
          { chave: "status", titulo: "Situação", larguraMinima: 110, celula: c => <StatusPill status={c.status} /> },
          { chave: "original", titulo: "Valor original", alinhamento: "direita", larguraMinima: 130, celula: c => <span className="whitespace-nowrap">{brl(c.valorOriginal)}</span> },
          { chave: "valor", titulo: "Saldo pendente", alinhamento: "direita", larguraMinima: 145, celula: c => <strong className={`whitespace-nowrap ${c.vencido ? "compromisso-saldo-vencido" : ""}`}>{brl(c.status === "CANCELADO" ? "0" : c.saldoPendente)}</strong> },
          ...(podeLancar ? [{ chave: "acao", titulo: "Ação", acoes: true, larguraMinima: 170, celula: (c: Compromisso) => ["PENDENTE", "PARCIAL"].includes(c.status) ? <ShadcnButton variant="outline" className="w-full md:w-auto" onClick={e => { e.stopPropagation(); setPagando(c); }}>{c.tipo === "PAGAR" ? "Registrar pagamento" : "Registrar recebimento"}</ShadcnButton> : null }] : []),
        ]} />
        <div className="compromissos-rodape"><Paginacao pagina={paginaAtual} totalPaginas={totalPaginas} total={lista.length} porPagina={15} rotulo="Paginação dos compromissos" substantivo="compromissos" idSelect="pagina-compromissos" onPagina={setPagina} /><div className="compromissos-totais">{tiposExibidos.map(tipo => <div key={tipo}><span>{tiposExibidos.length === 1 ? "Total pendente" : tipo === "PAGAR" ? "A pagar" : "A receber"}</span><strong>{brl(totais[tipo])}</strong></div>)}</div></div>
      </> : <Empty>Nenhum compromisso nesta visão. Ajuste a busca ou os filtros.</Empty>}
      </>}
    </Panel></div>}

    {selecionado && <CompromissoDetalheDialog compromisso={selecionado} onClose={fecharDetalhe} onLiquidar={podeLancar ? c => { fecharDetalhe(); setPagando(c); } : undefined} />}
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
