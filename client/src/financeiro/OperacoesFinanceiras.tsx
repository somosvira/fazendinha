import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, ChevronRight, FilePenLine, Plus, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { entradaDeNovaOperacao, isNovaOperacaoFinanceira, parseOperacaoFinanceiraId, URL_NOVA_OPERACAO } from "../router";
import { descartarRascunhoOperacao, listarOperacoes, obterConfiguracoesFinanceiras, obterRascunhoOperacao, type ConfiguracoesFinanceiras, type Operacao } from "./novo-api";
import { useRascunhoAtivo } from "./rascunhoAtivo";
import { FormOperacao } from "./FormOperacao";
import { OperacaoFinanceiraDetalhe } from "./OperacaoFinanceiraDetalhe";
import { brl, Button, type ColunaTabela, dataBR, Empty, ErrorBox, PageHeader, PaginaCarregando, PaginaFinanceira, Panel, Pill, StatusPill, TabelaFinanceira, TIPO_OPERACAO } from "./financeiro-ui";

type EfeitoFiltro = "TODOS" | "ESTOQUE" | "PAGAMENTO" | "RECEBIMENTO" | "A_PAGAR" | "A_RECEBER" | "TRANSFERENCIA" | "SEM_EFEITOS";
type ModoPeriodo = "DIA" | "MES" | "INTERVALO";

const isoLocal = (data: Date) => `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
const mesPorIso = (valor: string) => valor.slice(0, 7);
const rotuloPeriodo = (inicio: string, fim: string) => inicio === fim ? dataBR(inicio) : `${dataBR(inicio)} – ${dataBR(fim)}`;

function FiltroPeriodo({ inicio, fim, onChange }: { inicio: string; fim: string; onChange: (inicio: string, fim: string) => void }) {
  const [aberto, setAberto] = useState(false); const [modo, setModo] = useState<ModoPeriodo>("INTERVALO"); const [rascunhoInicio, setRascunhoInicio] = useState(inicio); const [rascunhoFim, setRascunhoFim] = useState(fim);
  const escolherDia = (dia: string) => { if (!dia) return; onChange(dia, dia); setAberto(false); };
  const escolherMes = (mes: string) => { if (!mes) return; const [ano, numero] = mes.split("-").map(Number); onChange(`${mes}-01`, isoLocal(new Date(ano, numero, 0))); setAberto(false); };
  const aplicarIntervalo = () => { if (!rascunhoInicio || !rascunhoFim || rascunhoInicio > rascunhoFim) return; onChange(rascunhoInicio, rascunhoFim); setAberto(false); };
  return <Popover open={aberto} onOpenChange={(novo) => { setAberto(novo); if (novo) { setRascunhoInicio(inicio); setRascunhoFim(fim); } }}><PopoverTrigger asChild><button type="button" className="inline-flex h-[42px] w-full min-w-0 flex-[1_1_210px] items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 text-sm font-medium text-ink sm:w-auto"><span className="inline-flex min-w-0 items-center gap-2"><CalendarRange size={16} className="shrink-0 text-ink-3" /><span className="truncate">{rotuloPeriodo(inicio, fim)}</span></span><span className="text-[10px] text-ink-3">▾</span></button></PopoverTrigger><PopoverContent align="start" sideOffset={6} className="w-[min(360px,calc(100vw-24px))] rounded-xl border border-border bg-white p-4 shadow-xl"><div className="grid grid-cols-3 rounded-lg bg-[#f4f2e9] p-1">{(["DIA", "MES", "INTERVALO"] as ModoPeriodo[]).map((item) => <button key={item} type="button" onClick={() => setModo(item)} className={`rounded-md px-2 py-2 text-xs font-semibold ${modo === item ? "bg-white text-ink shadow-sm" : "text-ink-3"}`}>{item === "DIA" ? "Dia" : item === "MES" ? "Mês" : "Intervalo"}</button>)}</div>{modo === "DIA" && <label className="mt-4 block text-sm font-medium">Data<input aria-label="Escolher uma data" type="date" defaultValue={inicio} onChange={(e) => escolherDia(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-white p-2.5 font-normal" /></label>}{modo === "MES" && <label className="mt-4 block text-sm font-medium">Mês<input aria-label="Escolher um mês" type="month" defaultValue={mesPorIso(inicio)} onChange={(e) => escolherMes(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-white p-2.5 font-normal" /></label>}{modo === "INTERVALO" && <div className="mt-4"><div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">De<input aria-label="Início do intervalo" type="date" value={rascunhoInicio} max={rascunhoFim} onChange={(e) => setRascunhoInicio(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-white p-2.5 font-normal" /></label><label className="text-sm font-medium">Até<input aria-label="Fim do intervalo" type="date" value={rascunhoFim} min={rascunhoInicio} onChange={(e) => setRascunhoFim(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-white p-2.5 font-normal" /></label></div><Button className="mt-4 w-full" disabled={!rascunhoInicio || !rascunhoFim || rascunhoInicio > rascunhoFim} onClick={aplicarIntervalo}>Aplicar período</Button></div>}</PopoverContent></Popover>;
}

function Efeitos({ operacao }: { operacao: Operacao }) {
  const estoque = operacao.movimentosEstoque.length > 0; const transacoes = operacao.transacoes.filter((item) => item.tipo !== "REVERSAO"); const compromissos = operacao.compromissos;
  return <div className="flex flex-wrap gap-1.5 md:justify-start">{estoque && <Pill tone="brown">estoque</Pill>}{transacoes.length > 0 && <Pill tone="green">{transacoes.some((t) => t.tipo === "RECEBIMENTO") ? "recebimento" : transacoes.some((t) => t.tipo === "TRANSFERENCIA") ? "transferência" : "pagamento"}</Pill>}{compromissos.length > 0 && <Pill tone="amber">{compromissos[0]?.tipo === "RECEBER" ? "a receber" : "a pagar"}</Pill>}{!estoque && !transacoes.length && !compromissos.length && <Pill>sem efeitos</Pill>}</div>;
}

function possuiEfeito(operacao: Operacao, filtro: EfeitoFiltro) {
  if (filtro === "TODOS") return true;
  const transacoes = operacao.transacoes.filter((item) => item.tipo !== "REVERSAO");
  if (filtro === "ESTOQUE") return operacao.movimentosEstoque.length > 0;
  if (filtro === "PAGAMENTO") return transacoes.some((item) => item.tipo === "PAGAMENTO");
  if (filtro === "RECEBIMENTO") return transacoes.some((item) => item.tipo === "RECEBIMENTO");
  if (filtro === "TRANSFERENCIA") return transacoes.some((item) => item.tipo === "TRANSFERENCIA");
  if (filtro === "A_PAGAR") return operacao.compromissos.some((item) => item.tipo === "PAGAR");
  if (filtro === "A_RECEBER") return operacao.compromissos.some((item) => item.tipo === "RECEBER");
  return !operacao.movimentosEstoque.length && !transacoes.length && !operacao.compromissos.length;
}

const inicioMes = () => { const data = new Date(); return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-01`; };
const hojeLocal = () => { const data = new Date(); return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`; };

/* Colunas da lista de operações. `alinhamento` vale para o cabeçalho, para a
 * célula e para o valor no cartão — não há como cabeçalho e conteúdo divergirem. */
const COLUNAS: ColunaTabela<Operacao>[] = [
  { chave: "data", titulo: "Data", larguraMinima: 100, celula: (operacao) => <span className="whitespace-nowrap text-ink-3">{dataBR(operacao.data)}</span> },
  { chave: "operacao", titulo: "Operação", larguraMinima: 230, principal: true, celula: (operacao) => <><strong className="break-words">{operacao.descricao || TIPO_OPERACAO[operacao.tipo]}</strong><div className="mt-1 text-xs text-ink-3">OP-{String(operacao.id).padStart(4, "0")}</div></> },
  { chave: "tipo", titulo: "Tipo", larguraMinima: 145, celula: (operacao) => <span className="break-words text-ink-2">{TIPO_OPERACAO[operacao.tipo] ?? operacao.tipo}</span> },
  { chave: "parceiro", titulo: "Parceiro", larguraMinima: 175, celula: (operacao) => <span className="break-words">{operacao.parceiro?.nome ?? "—"}</span> },
  { chave: "efeitos", titulo: "Efeitos", larguraMinima: 140, celula: (operacao) => <Efeitos operacao={operacao} /> },
  { chave: "status", titulo: "Status", larguraMinima: 110, celula: (operacao) => <StatusPill status={operacao.status} /> },
  { chave: "valor", titulo: "Valor", alinhamento: "direita", larguraMinima: 100, celula: (operacao) => <strong className="whitespace-nowrap font-semibold">{brl(operacao.valorTotal)}</strong> },
  { chave: "abrir", titulo: "", alinhamento: "direita", larguraMinima: 44, ocultarNoCartao: true, celula: () => <ChevronRight size={16} className="inline text-ink-3" aria-hidden /> },
];

export function OperacoesFinanceiras({ podeLancar = true }: { podeLancar?: boolean }) {
  const [itens, setItens] = useState<Operacao[]>([]); const [config, setConfig] = useState<ConfiguracoesFinanceiras | null>(null); const { rascunho } = useRascunhoAtivo(); const [form, setForm] = useState(() => typeof window !== "undefined" && isNovaOperacaoFinanceira(window.location.pathname)); const [operacaoBase, setOperacaoBase] = useState<Operacao | null>(null); const [loading, setLoading] = useState(true); const [erro, setErro] = useState<string | null>(null);
  const [iniciandoNova, setIniciandoNova] = useState(false);
  const [busca, setBusca] = useState(""); const [status, setStatus] = useState("TODOS"); const [tipo, setTipo] = useState("TODOS"); const [efeito, setEfeito] = useState<EfeitoFiltro>("TODOS"); const [inicio, setInicio] = useState(inicioMes); const [fim, setFim] = useState(hojeLocal);
  const [detalheId, setDetalheId] = useState<number | null>(() => typeof window === "undefined" ? null : parseOperacaoFinanceiraId(window.location.pathname));
  // O rascunho vem da store compartilhada (a mesma do atalho da sidebar):
  // obterRascunhoOperacao a atualiza, e cada autosave também.
  const carregar = useCallback(async () => { setLoading(true); setErro(null); try { const [ops, cfg] = await Promise.all([listarOperacoes({ inicio, fim }), podeLancar ? obterConfiguracoesFinanceiras() : Promise.resolve(null), podeLancar ? obterRascunhoOperacao() : Promise.resolve(null)]); setItens(ops); setConfig(cfg); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setLoading(false); } }, [inicio, fim, podeLancar]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    const onPop = (evento: PopStateEvent) => {
      setDetalheId(parseOperacaoFinanceiraId(window.location.pathname)); setForm(isNovaOperacaoFinanceira(window.location.pathname));
      // Atalhos para o rascunho (sidebar, Compromissos) substituem uma correção em curso.
      if (entradaDeNovaOperacao(evento.state)) setOperacaoBase(null);
    };
    window.addEventListener("popstate", onPop); return () => window.removeEventListener("popstate", onPop);
  }, []);
  const filtradas = useMemo(() => itens.filter((operacao) => (status === "TODOS" || operacao.status === status) && (tipo === "TODOS" || operacao.tipo === tipo) && possuiEfeito(operacao, efeito) && `${operacao.descricao} ${operacao.parceiro?.nome} ${operacao.id}`.toLowerCase().includes(busca.toLowerCase())), [itens, busca, status, tipo, efeito]);
  const abrirDetalhe = (id: number) => { window.history.pushState(null, "", `/financeiro/operacoes/${id}`); setDetalheId(id); setForm(false); };
  const voltar = () => { window.history.pushState(null, "", "/financeiro/operacoes"); setDetalheId(null); };
  const abrirFormulario = (base: Operacao | null = null) => { window.history.pushState(null, "", URL_NOVA_OPERACAO); setDetalheId(null); setOperacaoBase(base); setForm(true); };
  const abrirNovaOperacao = async () => {
    setIniciandoNova(true); setErro(null);
    try {
      if (rascunho) await descartarRascunhoOperacao();
      abrirFormulario();
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
    finally { setIniciandoNova(false); }
  };
  const continuarRascunho = () => abrirFormulario();
  const corrigir = (operacao: Operacao) => abrirFormulario(operacao);

  if (detalheId != null) return <OperacaoFinanceiraDetalhe operacaoId={detalheId} onVoltar={voltar} onAbrir={abrirDetalhe} onCorrigir={corrigir} podeLancar={podeLancar} />;
  if (loading && !config) return <PaginaCarregando label="Carregando operações" />;
  const compromissoInicial = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("compromisso");
  // A chave separa correção de rascunho: trocar de um para o outro remonta o
  // formulário, senão o autosave gravaria os dados da correção no rascunho.
  if (form && config) return <FormOperacao key={operacaoBase ? `correcao-${operacaoBase.id}` : "rascunho"} config={config} rascunho={operacaoBase ? null : rascunho} operacaoBase={operacaoBase} condicaoInicial={compromissoInicial ? "A_PRAZO" : undefined} tipoInicial={compromissoInicial === "RECEBER" ? "VENDA" : compromissoInicial === "PAGAR" ? "COMPRA_CONSUMO_DIRETO" : undefined} onSalvo={async (operacao, aviso) => { setForm(false); setOperacaoBase(null); await carregar(); if (aviso) setErro(aviso); abrirDetalhe(operacao.id); }} />;

  return <PaginaFinanceira>
    <PageHeader titulo="Operações" descricao="Fatos de negócio e seus efeitos financeiros e físicos, preservados em um histórico auditável." acao={podeLancar ? <div className="flex flex-wrap gap-2">{rascunho && <Button secondary onClick={continuarRascunho}><FilePenLine size={16} /> Continuar operação</Button>}<Button disabled={iniciandoNova} onClick={() => { void abrirNovaOperacao(); }}><Plus size={16} /> {iniciandoNova ? "Iniciando…" : "Nova operação"}</Button></div> : undefined} />
    <ErrorBox erro={erro} />
    <Panel className="mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
        <label className="relative w-full min-w-0 flex-[1_1_260px] sm:w-auto"><Search size={16} className="absolute left-3 top-3 text-ink-3" /><input aria-label="Buscar operações" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por operação, parceiro ou número" className="h-[42px] w-full rounded-lg border border-border bg-white py-2.5 pl-9 pr-3 text-sm" /></label>
        <FiltroPeriodo inicio={inicio} fim={fim} onChange={(novoInicio, novoFim) => { setInicio(novoInicio); setFim(novoFim); }} />
        <select aria-label="Filtrar por tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-[42px] w-full min-w-0 flex-[1_1_180px] rounded-lg border border-border bg-white px-3 text-sm sm:w-auto"><option value="TODOS">Todos os tipos</option>{Object.entries(TIPO_OPERACAO).map(([chave, nome]) => <option key={chave} value={chave}>{nome}</option>)}</select>
        <select aria-label="Filtrar por efeito" value={efeito} onChange={(e) => setEfeito(e.target.value as EfeitoFiltro)} className="h-[42px] w-full min-w-0 flex-[1_1_170px] rounded-lg border border-border bg-white px-3 text-sm sm:w-auto"><option value="TODOS">Todos os efeitos</option><option value="ESTOQUE">Estoque</option><option value="PAGAMENTO">Pagamento</option><option value="RECEBIMENTO">Recebimento</option><option value="A_PAGAR">A pagar</option><option value="A_RECEBER">A receber</option><option value="TRANSFERENCIA">Transferência</option><option value="SEM_EFEITOS">Sem efeitos</option></select>
        <select aria-label="Filtrar por status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-[42px] w-full min-w-0 flex-[1_1_150px] rounded-lg border border-border bg-white px-3 text-sm sm:w-auto"><option value="TODOS">Todos os status</option><option value="CONFIRMADA">Confirmadas</option><option value="CANCELADA">Canceladas</option></select>
      </div>
      {filtradas.length ? <TabelaFinanceira rotulo="Operações do período" itens={filtradas} colunas={COLUNAS} chaveDe={(operacao) => operacao.id} onAbrir={(operacao) => abrirDetalhe(operacao.id)} classeLinha={(operacao) => operacao.status === "CANCELADA" ? "opacity-60" : ""} /> : <Empty>Nenhuma operação encontrada no período e filtros selecionados.</Empty>}
    </Panel>
  </PaginaFinanceira>;
}
