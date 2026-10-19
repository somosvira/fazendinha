import { resumoAuditoriaLegivel } from "../lib/auditoriaRotulos";
import { SelectCampo } from "@/financeiro/SelectCampo";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Baby, Beef, ChevronDown, ChevronUp, HeartPulse, Leaf, Search } from "lucide-react";
import { Button as BotaoDetalhes } from "../../../components/ui/button";
import { Button } from "../../../financeiro/financeiro-ui";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { buscarAuditoriaAnimal, RebanhoApiError } from "../api";
import type { FiltrosAuditoriaAnimal, ResultadoAuditoriaAnimal } from "../types";

const TAMANHO_PAGINA = 20;
const EIXOS = {
  REBANHO: { nome: "Rebanho", Icone: Beef }, REPRODUCAO: { nome: "Reprodução", Icone: Baby },
  SANIDADE: { nome: "Sanidade", Icone: HeartPulse }, NUTRICAO: { nome: "Nutrição", Icone: Leaf },
};
const campo = "h-9 w-full min-w-0 rounded-md border border-border bg-surface px-2 text-sm text-ink";
const rotulo = "grid min-w-0 gap-1 text-xs text-ink-3";

type Consulta = { pagina: number; periodo: string; inicio: string; fim: string; eixo: string; acao: string; responsavel: string; busca: string };
function diaLocal(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function periodo(dias: number) {
  const fim = new Date(); const inicio = new Date(fim); inicio.setDate(inicio.getDate() - dias + 1);
  return { inicio: diaLocal(inicio), fim: diaLocal(fim) };
}
function mensagemErro(e: unknown): string {
  return e instanceof RebanhoApiError || e instanceof Error ? e.message : String(e);
}
function formatarDataHoraBR(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d)} ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(d)}`;
}

export function AuditoriaAnimal({ id, recarregarToken }: { id: string; recarregarToken?: string | number }) {
  const [consulta, setConsulta] = useState<Consulta>(() => ({ pagina: 1, periodo: "30", ...periodo(30), eixo: "", acao: "", responsavel: "", busca: "" }));
  const [busca, setBusca] = useState("");
  const [resultado, setResultado] = useState<ResultadoAuditoriaAnimal | null>(null);
  const [opcoes, setOpcoes] = useState<ResultadoAuditoriaAnimal["filtros"]>();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const propriedadeId = getPropriedadeAtiva();
  const parametros = useMemo<FiltrosAuditoriaAnimal>(() => ({
    page: consulta.pagina, pageSize: TAMANHO_PAGINA,
    ...(consulta.inicio ? { inicio: new Date(`${consulta.inicio}T00:00:00`).toISOString() } : {}),
    ...(consulta.fim ? { fim: new Date(`${consulta.fim}T23:59:59.999`).toISOString() } : {}),
    ...(consulta.eixo ? { eixo: consulta.eixo as FiltrosAuditoriaAnimal["eixo"] } : {}),
    ...(consulta.acao ? { acao: consulta.acao } : {}),
    ...(consulta.responsavel ? { responsavel: consulta.responsavel === "sem" ? "sem" as const : Number(consulta.responsavel) } : {}),
    ...(consulta.busca ? { busca: consulta.busca } : {}),
  }), [consulta]);
  const intervaloInvalido = !!consulta.inicio && !!consulta.fim && consulta.inicio > consulta.fim;

  useEffect(() => {
    let vigente = true;
    setCarregando(true); setErro(null); setResultado(null); setExpandidos(new Set());
    if (intervaloInvalido) { setCarregando(false); return; }
    buscarAuditoriaAnimal(id, parametros)
      .then((r) => {
        if (!vigente) return;
        setOpcoes(r.filtros);
        const ultimaPagina = Math.max(1, Math.ceil(r.total / TAMANHO_PAGINA));
        if ((parametros.page ?? 1) > ultimaPagina) setConsulta((q) => ({ ...q, pagina: ultimaPagina }));
        else setResultado(r);
      })
      .catch((e) => { if (vigente) setErro(mensagemErro(e)); })
      .finally(() => { if (vigente) setCarregando(false); });
    return () => { vigente = false; };
  }, [id, propriedadeId, recarregarToken, parametros, tentativa, intervaloInvalido]);

  // Uma escrita ou a troca de animal/sítio volta ao início da consulta. A
  // limpeza do efeito acima impede uma resposta antiga de ocupar a nova ficha.
  useEffect(() => { setConsulta((q) => q.pagina === 1 ? q : { ...q, pagina: 1 }); setOpcoes(undefined); }, [id, propriedadeId, recarregarToken]);
  const alterar = (alteracoes: Partial<Consulta>) => setConsulta((q) => ({ ...q, ...alteracoes, pagina: 1 }));
  const alternar = (chave: string) => setExpandidos((atuais) => {
    const novo = new Set(atuais); if (novo.has(chave)) novo.delete(chave); else novo.add(chave); return novo;
  });
  const total = resultado?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / TAMANHO_PAGINA));
  const pagina = consulta.pagina;

  return <div className="mt-3 text-sm">
    <form aria-label="Filtros de auditoria" onSubmit={(e) => { e.preventDefault(); alterar({ busca: busca.trim() }); }} className="grid gap-3 rounded-t-lg border border-border bg-surface p-3 md:grid-cols-[1.3fr_1fr_1fr_1fr_1.3fr]">
      <label className={rotulo}>Período<SelectCampo className={campo} value={consulta.periodo} onValueChange={(valorSelecionado) => {
        const valor = valorSelecionado;
        alterar({ periodo: valor, ...(valor === "todos" ? { inicio: "", fim: "" } : valor === "personalizado" ? {} : periodo(Number(valor))) });
      }}><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="todos">Todo o período</option><option value="personalizado">Período personalizado</option></SelectCampo></label>
      <label className={rotulo}>Eixo<SelectCampo className={campo} value={consulta.eixo} onValueChange={(valorSelecionado) => alterar({ eixo: valorSelecionado })}><option value="">Todos os eixos</option>{Object.entries(EIXOS).map(([valor, eixo]) => <option key={valor} value={valor}>{eixo.nome}</option>)}<option value="NAO_CLASSIFICADO">Não classificado</option></SelectCampo></label>
      <label className={rotulo}>Ação<SelectCampo className={campo} value={consulta.acao} onValueChange={(valorSelecionado) => alterar({ acao: valorSelecionado })}><option value="">Todas</option>{opcoes?.acoes.map((a) => <option key={a.valor} value={a.valor}>{a.rotulo}</option>)}</SelectCampo></label>
      <label className={rotulo}>Responsável<SelectCampo className={campo} value={consulta.responsavel} onValueChange={(valorSelecionado) => alterar({ responsavel: valorSelecionado })}><option value="">Todos</option>{opcoes?.responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}{opcoes?.semResponsavel && <option value="sem">Não informado</option>}</SelectCampo></label>
      <div className={rotulo}><label htmlFor={`busca-auditoria-${id}`}>Buscar registro</label><div className="flex gap-1"><input id={`busca-auditoria-${id}`} className={campo} type="search" maxLength={200} placeholder="Nome ou identificador" value={busca} onChange={(e) => setBusca(e.target.value)} /><button type="submit" aria-label="Buscar registros" className="rounded-md border border-border px-2 hover:bg-surface-2"><Search size={16} aria-hidden="true" /></button></div></div>
      {consulta.periodo === "personalizado" && <div className="flex flex-wrap gap-3 md:col-span-5"><label className={rotulo}>De<input className={campo} type="date" value={consulta.inicio} onChange={(e) => alterar({ inicio: e.target.value })} /></label><label className={rotulo}>Até<input className={campo} type="date" value={consulta.fim} onChange={(e) => alterar({ fim: e.target.value })} /></label></div>}
    </form>
    {intervaloInvalido && <p role="alert" className="p-3 text-red-700">O início deve ser anterior ao fim.</p>}
    {carregando && <p role="status" className="p-4 text-ink-3">Carregando auditoria…</p>}
    {erro && <div className="flex items-center gap-3 p-3"><p role="alert" className="text-red-700">{erro}</p><Button secondary onClick={() => setTentativa((v) => v + 1)}>Tentar novamente</Button></div>}
    {!carregando && !erro && !intervaloInvalido && resultado && <>
      <div className="overflow-x-auto rounded-b-lg border border-t-0 border-border"><table className="w-full min-w-[780px] text-left text-xs consulta-tabela"><caption className="sr-only">Auditoria dos registros do animal</caption>
        <thead className="bg-surface-2 text-ink-3"><tr>{["Data e hora", "Eixo", "Ação", "Registro afetado", "Responsável", "Detalhes"].map((titulo) => <th scope="col" key={titulo} className="px-3 py-2 font-semibold">{titulo}</th>)}</tr></thead>
        <tbody className="divide-y divide-border">{resultado.itens.map((entrada, indice) => {
          const chave = entrada.id ?? `${entrada.entidadeId}-${entrada.em}-${indice}`;
          const aberto = expandidos.has(chave); const eixo = entrada.eixo ? EIXOS[entrada.eixo] : null;
          const detalhesId = `auditoria-${id}-${pagina}-${indice}`;
          return <Fragment key={chave}><tr className="align-top"><td className="whitespace-nowrap px-3 py-3">{formatarDataHoraBR(entrada.em)}</td><td className="px-3 py-3">{eixo ? <span className="flex items-center gap-2"><eixo.Icone size={17} aria-hidden="true" />{eixo.nome}</span> : "Não classificado"}</td><td className="px-3 py-3">{entrada.acaoRotulo ?? entrada.acao}</td><td className="px-3 py-3">{entrada.registro ?? resumoAuditoriaLegivel(entrada)}</td><td className="px-3 py-3">{entrada.usuarioNome ?? "Não informado"}</td><td className="px-3 py-3"><BotaoDetalhes variant="outline" size="sm" type="button" aria-expanded={aberto} aria-controls={aberto ? detalhesId : undefined} onClick={() => alternar(chave)} className="inline-flex items-center gap-2 whitespace-nowrap">{aberto ? "Ocultar detalhes" : "Ver detalhes"}{aberto ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}</BotaoDetalhes></td></tr>
            {aberto && <tr><td colSpan={6} className="p-3 pt-0"><div id={detalhesId} className="rounded-md border border-border bg-surface-2 p-3"><p className="mb-2 text-ink-3">{resumoAuditoriaLegivel(entrada)} · Registro: {entrada.entidadeId}</p>{entrada.alteracoes.length ? <table className="w-full table-fixed text-left consulta-tabela"><thead><tr>{["Campo", "Antes", "Depois"].map((r) => <th scope="col" key={r} className="pb-2 pr-3 font-medium text-ink-3">{r}</th>)}</tr></thead><tbody>{entrada.alteracoes.map((a) => <tr key={a.campo}><th scope="row" className="break-words py-1 pr-3 font-medium">{a.rotulo}</th><td className="break-words py-1 pr-3">{a.antes ?? "—"}</td><td className="break-words py-1 pr-3">{a.depois ?? "—"}</td></tr>)}</tbody></table> : <p className="text-ink-3">Sem detalhes de campos disponíveis nesta consulta.</p>}</div></td></tr>}
          </Fragment>;
        })}{!resultado.itens.length && <tr><td colSpan={6} className="p-5 text-center text-ink-3">Nenhum registro de auditoria neste período com os filtros selecionados.</td></tr>}</tbody>
      </table></div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-3"><span>{total ? `${(pagina - 1) * TAMANHO_PAGINA + 1}–${Math.min(pagina * TAMANHO_PAGINA, total)}` : "0"} de {total} registros</span><div className="flex items-center gap-2"><Button secondary disabled={pagina <= 1} onClick={() => setConsulta((q) => ({ ...q, pagina: q.pagina - 1 }))}>Anterior</Button><label className="sr-only" htmlFor={`pagina-auditoria-${id}`}>Página da auditoria</label><SelectCampo id={`pagina-auditoria-${id}`} className="h-9 rounded-md border border-border bg-surface px-2 text-ink" value={pagina} onValueChange={(valorSelecionado) => setConsulta((q) => ({ ...q, pagina: Number(valorSelecionado) }))}>{Array.from({ length: paginas }, (_, i) => <option key={i + 1} value={i + 1}>Página {i + 1} de {paginas}</option>)}</SelectCampo><Button secondary disabled={pagina >= paginas} onClick={() => setConsulta((q) => ({ ...q, pagina: q.pagina + 1 }))}>Próxima</Button></div></div>
    </>}
    <p className="mt-3 text-xs text-ink-3">Responsável é a autoria registrada na auditoria. Registros coletivos aparecem quando há vínculo persistido com o animal; detalhes dependem dos snapshots disponíveis e das permissões.</p>
  </div>;
}
