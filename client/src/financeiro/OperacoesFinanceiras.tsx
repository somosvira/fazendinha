import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, ChevronRight, Plus, Search, SlidersHorizontal } from "lucide-react";
import { Loader } from "../components/Loading";
import { parseOperacaoFinanceiraId } from "../router";
import { listarOperacoes, obterConfiguracoesFinanceiras, type ConfiguracoesFinanceiras, type Operacao } from "./novo-api";
import { FormOperacao } from "./FormOperacao";
import { OperacaoFinanceiraDetalhe } from "./OperacaoFinanceiraDetalhe";
import { brl, Button, dataBR, Empty, ErrorBox, PageHeader, Panel, Pill, StatusPill, TIPO_OPERACAO } from "./financeiro-ui";

type EfeitoFiltro = "TODOS" | "ESTOQUE" | "PAGAMENTO" | "RECEBIMENTO" | "A_PAGAR" | "A_RECEBER" | "TRANSFERENCIA" | "SEM_EFEITOS";

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
  const [busca, setBusca] = useState(""); const [status, setStatus] = useState("TODOS"); const [efeito, setEfeito] = useState<EfeitoFiltro>("TODOS"); const [inicio, setInicio] = useState(inicioMes); const [fim, setFim] = useState(hojeLocal);
  const [detalheId, setDetalheId] = useState<number | null>(() => typeof window === "undefined" ? null : parseOperacaoFinanceiraId(window.location.pathname));
  const carregar = useCallback(async () => { setLoading(true); setErro(null); try { const [ops, cfg] = await Promise.all([listarOperacoes({ inicio, fim }), obterConfiguracoesFinanceiras()]); setItens(ops); setConfig(cfg); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setLoading(false); } }, [inicio, fim]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { const onPop = () => setDetalheId(parseOperacaoFinanceiraId(window.location.pathname)); window.addEventListener("popstate", onPop); return () => window.removeEventListener("popstate", onPop); }, []);
  const filtradas = useMemo(() => itens.filter((operacao) => (status === "TODOS" || operacao.status === status) && possuiEfeito(operacao, efeito) && `${operacao.descricao} ${operacao.parceiro?.nome} ${operacao.id}`.toLowerCase().includes(busca.toLowerCase())), [itens, busca, status, efeito]);
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
      <div className="grid gap-3 border-b border-border p-4 xl:grid-cols-[minmax(260px,1fr)_170px_170px_210px_170px]">
        <label className="relative"><Search size={16} className="absolute left-3 top-3 text-ink-3" /><input aria-label="Buscar operações" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por operação, parceiro ou número" className="w-full rounded-lg border border-border bg-white py-2.5 pl-9 pr-3 text-sm" /></label>
        <label className="relative"><CalendarRange size={15} className="absolute left-3 top-3 text-ink-3" /><span className="sr-only">Data inicial</span><input aria-label="Data inicial" type="date" value={inicio} max={fim} onChange={(e) => setInicio(e.target.value)} className="w-full rounded-lg border border-border bg-white py-2.5 pl-9 pr-2 text-sm" /></label>
        <label><span className="sr-only">Data final</span><input aria-label="Data final" type="date" value={fim} min={inicio} onChange={(e) => setFim(e.target.value)} className="w-full rounded-lg border border-border bg-white p-2.5 text-sm" /></label>
        <label className="flex items-center gap-2 text-sm text-ink-3"><SlidersHorizontal size={15} /><select aria-label="Filtrar por efeito" value={efeito} onChange={(e) => setEfeito(e.target.value as EfeitoFiltro)} className="w-full rounded-lg border border-border bg-white p-2.5 text-ink"><option value="TODOS">Todos os efeitos</option><option value="ESTOQUE">Estoque</option><option value="PAGAMENTO">Pagamento</option><option value="RECEBIMENTO">Recebimento</option><option value="A_PAGAR">A pagar</option><option value="A_RECEBER">A receber</option><option value="TRANSFERENCIA">Transferência</option><option value="SEM_EFEITOS">Sem efeitos</option></select></label>
        <select aria-label="Filtrar por status" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-border bg-white p-2.5 text-sm"><option value="TODOS">Todos os status</option><option value="CONFIRMADA">Confirmadas</option><option value="CANCELADA">Canceladas</option></select>
      </div>
      {filtradas.length ? <div className="overflow-x-auto"><table className="w-full min-w-[880px] text-left text-sm"><thead className="bg-[#f4f2e9] text-[11px] uppercase tracking-[.08em] text-ink-3"><tr><th className="p-4">Data</th><th className="p-4">Operação</th><th className="p-4">Parceiro</th><th className="p-4">Efeitos</th><th className="p-4">Status</th><th className="p-4 text-right">Valor</th><th className="w-10" /></tr></thead><tbody className="divide-y divide-border">{filtradas.map((operacao) => <tr key={operacao.id} onClick={() => abrirDetalhe(operacao.id)} className={`cursor-pointer hover:bg-[#faf9f4] ${operacao.status === "CANCELADA" ? "opacity-60" : ""}`}><td className="p-4 text-ink-3">{dataBR(operacao.data)}</td><td className="p-4"><strong>{operacao.descricao || TIPO_OPERACAO[operacao.tipo]}</strong><div className="mt-1 text-xs text-ink-3">OP-{String(operacao.id).padStart(4, "0")}</div></td><td className="p-4">{operacao.parceiro?.nome ?? "—"}</td><td className="p-4"><Efeitos operacao={operacao} /></td><td className="p-4"><StatusPill status={operacao.status} /></td><td className="p-4 text-right font-semibold">{brl(operacao.valorTotal)}</td><td className="pr-4"><ChevronRight size={16} className="text-ink-3" /></td></tr>)}</tbody></table></div> : <Empty>Nenhuma operação encontrada no período e filtros selecionados.</Empty>}
    </Panel>
  </div>;
}
