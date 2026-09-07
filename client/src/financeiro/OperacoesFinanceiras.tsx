import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, ChevronRight, Plus, Search } from "lucide-react";
import { Loader } from "../components/Loading";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { parseOperacaoFinanceiraId } from "../router";
import { listarOperacoes, obterConfiguracoesFinanceiras, type ConfiguracoesFinanceiras, type Operacao } from "./novo-api";
import { FormOperacao } from "./FormOperacao";
import { OperacaoFinanceiraDetalhe } from "./OperacaoFinanceiraDetalhe";
import { brl, Button, dataBR, Empty, ErrorBox, PageHeader, Panel, Pill, StatusPill, TIPO_OPERACAO } from "./financeiro-ui";

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
  return <Popover open={aberto} onOpenChange={(novo) => { setAberto(novo); if (novo) { setRascunhoInicio(inicio); setRascunhoFim(fim); } }}><PopoverTrigger asChild><button type="button" className="inline-flex h-[42px] min-w-[210px] items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 text-sm font-medium text-ink"><span className="inline-flex items-center gap-2"><CalendarRange size={16} className="text-ink-3" />{rotuloPeriodo(inicio, fim)}</span><span className="text-[10px] text-ink-3">▾</span></button></PopoverTrigger><PopoverContent align="start" sideOffset={6} className="w-[360px] rounded-xl border border-border bg-white p-4 shadow-xl"><div className="grid grid-cols-3 rounded-lg bg-[#f4f2e9] p-1">{(["DIA", "MES", "INTERVALO"] as ModoPeriodo[]).map((item) => <button key={item} type="button" onClick={() => setModo(item)} className={`rounded-md px-2 py-2 text-xs font-semibold ${modo === item ? "bg-white text-ink shadow-sm" : "text-ink-3"}`}>{item === "DIA" ? "Dia" : item === "MES" ? "Mês" : "Intervalo"}</button>)}</div>{modo === "DIA" && <label className="mt-4 block text-sm font-medium">Data<input aria-label="Escolher uma data" type="date" defaultValue={inicio} onChange={(e) => escolherDia(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-white p-2.5 font-normal" /></label>}{modo === "MES" && <label className="mt-4 block text-sm font-medium">Mês<input aria-label="Escolher um mês" type="month" defaultValue={mesPorIso(inicio)} onChange={(e) => escolherMes(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-white p-2.5 font-normal" /></label>}{modo === "INTERVALO" && <div className="mt-4"><div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">De<input aria-label="Início do intervalo" type="date" value={rascunhoInicio} max={rascunhoFim} onChange={(e) => setRascunhoInicio(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-white p-2.5 font-normal" /></label><label className="text-sm font-medium">Até<input aria-label="Fim do intervalo" type="date" value={rascunhoFim} min={rascunhoInicio} onChange={(e) => setRascunhoFim(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-white p-2.5 font-normal" /></label></div><Button className="mt-4 w-full" disabled={!rascunhoInicio || !rascunhoFim || rascunhoInicio > rascunhoFim} onClick={aplicarIntervalo}>Aplicar período</Button></div>}</PopoverContent></Popover>;
}

function Efeitos({ operacao }: { operacao: Operacao }) {
  const estoque = operacao.movimentosEstoque.length > 0; const transacoes = operacao.transacoes.filter((item) => item.tipo !== "REVERSAO"); const compromissos = operacao.compromissos;
  return <div className="flex flex-wrap gap-1.5">{estoque && <Pill tone="brown">estoque</Pill>}{transacoes.length > 0 && <Pill tone="green">{transacoes.some((t) => t.tipo === "RECEBIMENTO") ? "recebimento" : transacoes.some((t) => t.tipo === "TRANSFERENCIA") ? "transferência" : "pagamento"}</Pill>}{compromissos.length > 0 && <Pill tone="amber">{compromissos[0]?.tipo === "RECEBER" ? "a receber" : "a pagar"}</Pill>}{!estoque && !transacoes.length && !compromissos.length && <Pill>sem efeitos</Pill>}</div>;
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

export function OperacoesFinanceiras() {
  const [itens, setItens] = useState<Operacao[]>([]); const [config, setConfig] = useState<ConfiguracoesFinanceiras | null>(null); const [form, setForm] = useState(false); const [operacaoBase, setOperacaoBase] = useState<Operacao | null>(null); const [loading, setLoading] = useState(true); const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState(""); const [status, setStatus] = useState("TODOS"); const [tipo, setTipo] = useState("TODOS"); const [efeito, setEfeito] = useState<EfeitoFiltro>("TODOS"); const [inicio, setInicio] = useState(inicioMes); const [fim, setFim] = useState(hojeLocal);
  const [detalheId, setDetalheId] = useState<number | null>(() => typeof window === "undefined" ? null : parseOperacaoFinanceiraId(window.location.pathname));
  const carregar = useCallback(async () => { setLoading(true); setErro(null); try { const [ops, cfg] = await Promise.all([listarOperacoes({ inicio, fim }), obterConfiguracoesFinanceiras()]); setItens(ops); setConfig(cfg); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setLoading(false); } }, [inicio, fim]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { const onPop = () => setDetalheId(parseOperacaoFinanceiraId(window.location.pathname)); window.addEventListener("popstate", onPop); return () => window.removeEventListener("popstate", onPop); }, []);
  const filtradas = useMemo(() => itens.filter((operacao) => (status === "TODOS" || operacao.status === status) && (tipo === "TODOS" || operacao.tipo === tipo) && possuiEfeito(operacao, efeito) && `${operacao.descricao} ${operacao.parceiro?.nome} ${operacao.id}`.toLowerCase().includes(busca.toLowerCase())), [itens, busca, status, tipo, efeito]);
  const abrirDetalhe = (id: number) => { window.history.pushState(null, "", `/financeiro/operacoes/${id}`); setDetalheId(id); setForm(false); };
  const voltar = () => { window.history.pushState(null, "", "/financeiro/operacoes"); setDetalheId(null); };
  const corrigir = (operacao: Operacao) => { voltar(); setOperacaoBase(operacao); setForm(true); };

  if (detalheId != null) return <OperacaoFinanceiraDetalhe operacaoId={detalheId} onVoltar={voltar} onAbrir={abrirDetalhe} onCorrigir={corrigir} />;
  if (loading && !config) return <Loader label="Carregando operações" />;

  return <div className="shell-wide pb-10">
    <PageHeader titulo="Operações" descricao="Fatos de negócio e seus efeitos financeiros e físicos, preservados em um histórico auditável." acao={<Button onClick={() => { setOperacaoBase(null); setForm(true); }}><Plus size={16} /> Nova operação</Button>} />
    {form && config && <FormOperacao config={config} operacaoBase={operacaoBase} onCancelar={() => { setForm(false); setOperacaoBase(null); }} onSalvo={async (aviso) => { setForm(false); setOperacaoBase(null); await carregar(); if (aviso) setErro(aviso); }} />}
    <ErrorBox erro={erro} />
    <Panel className="mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
        <label className="relative min-w-[240px] flex-[1_1_300px]"><Search size={16} className="absolute left-3 top-3 text-ink-3" /><input aria-label="Buscar operações" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por operação, parceiro ou número" className="h-[42px] w-full rounded-lg border border-border bg-white py-2.5 pl-9 pr-3 text-sm" /></label>
        <FiltroPeriodo inicio={inicio} fim={fim} onChange={(novoInicio, novoFim) => { setInicio(novoInicio); setFim(novoFim); }} />
        <select aria-label="Filtrar por tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-[42px] min-w-[180px] flex-[1_1_180px] rounded-lg border border-border bg-white px-3 text-sm"><option value="TODOS">Todos os tipos</option>{Object.entries(TIPO_OPERACAO).map(([chave, nome]) => <option key={chave} value={chave}>{nome}</option>)}</select>
        <select aria-label="Filtrar por efeito" value={efeito} onChange={(e) => setEfeito(e.target.value as EfeitoFiltro)} className="h-[42px] min-w-[170px] flex-[1_1_170px] rounded-lg border border-border bg-white px-3 text-sm"><option value="TODOS">Todos os efeitos</option><option value="ESTOQUE">Estoque</option><option value="PAGAMENTO">Pagamento</option><option value="RECEBIMENTO">Recebimento</option><option value="A_PAGAR">A pagar</option><option value="A_RECEBER">A receber</option><option value="TRANSFERENCIA">Transferência</option><option value="SEM_EFEITOS">Sem efeitos</option></select>
        <select aria-label="Filtrar por status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-[42px] min-w-[150px] flex-[1_1_150px] rounded-lg border border-border bg-white px-3 text-sm"><option value="TODOS">Todos os status</option><option value="CONFIRMADA">Confirmadas</option><option value="CANCELADA">Canceladas</option></select>
      </div>
      {filtradas.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-left text-sm"><thead className="bg-[#f4f2e9] text-[11px] uppercase tracking-[.08em] text-ink-3"><tr><th className="p-4">Data</th><th className="p-4">Operação</th><th className="p-4">Tipo</th><th className="p-4">Parceiro</th><th className="p-4">Efeitos</th><th className="p-4">Status</th><th className="p-4 text-right">Valor</th><th className="w-10" /></tr></thead><tbody className="divide-y divide-border">{filtradas.map((operacao) => <tr key={operacao.id} onClick={() => abrirDetalhe(operacao.id)} className={`cursor-pointer hover:bg-[#faf9f4] ${operacao.status === "CANCELADA" ? "opacity-60" : ""}`}><td className="p-4 text-ink-3">{dataBR(operacao.data)}</td><td className="p-4"><strong>{operacao.descricao || TIPO_OPERACAO[operacao.tipo]}</strong><div className="mt-1 text-xs text-ink-3">OP-{String(operacao.id).padStart(4, "0")}</div></td><td className="p-4 text-ink-2">{TIPO_OPERACAO[operacao.tipo] ?? operacao.tipo}</td><td className="p-4">{operacao.parceiro?.nome ?? "—"}</td><td className="p-4"><Efeitos operacao={operacao} /></td><td className="p-4"><StatusPill status={operacao.status} /></td><td className="p-4 text-right font-semibold">{brl(operacao.valorTotal)}</td><td className="pr-4"><ChevronRight size={16} className="text-ink-3" /></td></tr>)}</tbody></table></div> : <Empty>Nenhuma operação encontrada no período e filtros selecionados.</Empty>}
    </Panel>
  </div>;
}
