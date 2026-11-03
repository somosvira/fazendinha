import { formatarDataBR } from "../lib/rotulos";
import { LinhaTempoConsulta, CartaoConsulta } from "@/components/ConsultaVisual";
import { DatePicker } from "@/components/DatePicker";
import { AjudaCampo } from "@/components/Dica";
import { resumoAuditoriaLegivel } from "../lib/auditoriaRotulos";
import { SelectCampo } from "@/financeiro/SelectCampo";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Baby, Beef, History, HeartPulse, Leaf, Search, type LucideIcon } from "lucide-react";
import { Button as BotaoDetalhes } from "../../../components/ui/button";
import { Button } from "../../../financeiro/financeiro-ui";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { buscarAuditoriaAnimal, RebanhoApiError } from "../api";
import type { EntradaAuditoria, FiltrosAuditoriaAnimal, ResultadoAuditoriaAnimal, TransicaoFatoAnimal } from "../types";

import { RebModal } from "@/components/rb/RebModal";
import { AuditoriaFatoAnimal, DadosAuditoria } from "./AuditoriaFatoAnimal";
import { auditoriaConstituiFato, identidadeHistorico, dataRelativaFato } from "../lib/historicoAnimal";

export type FatoHistoricoAnimal = { id: string; entidade: string; entidadeId: string; eixo: "REBANHO" | "REPRODUCAO" | "SANIDADE" | "NUTRICAO"; data: string; titulo: string; detalhe: ReactNode; textoBusca: string; Icone: LucideIcon; abrir?: () => void; projetarTransicao?: (transicao: TransicaoFatoAnimal) => { detalhe: ReactNode; textoBusca: string } };

const TAMANHO_PAGINA = 20;
const EIXOS = {
  REBANHO: { nome: "Rebanho", Icone: Beef }, REPRODUCAO: { nome: "Reprodução", Icone: Baby },
  SANIDADE: { nome: "Sanidade", Icone: HeartPulse }, NUTRICAO: { nome: "Nutrição", Icone: Leaf },
};
const campo = "h-9 w-full min-w-0 rounded-md border border-border bg-surface px-2 text-sm text-ink";
const corEvento = (entidade?: string) => ({ LocalizacaoAnimal: "text-sky-800", FinalidadeAnimal: "text-violet-800", DestinoAnimal: "text-violet-800", Pesagem: "text-amber-800", AplicacaoProduto: "text-rose-800", ExameAnimal: "text-teal-800" }[entidade ?? ""] ?? "text-mast");
const rotulo = "grid min-w-0 gap-1 text-sm text-ink-3";

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

type AuditoriaAnimalProps = { id: string; recarregarToken?: string | number; fatos?: FatoHistoricoAnimal[]; modo?: "visual" | "tabela"; ativo?: boolean };
export function AuditoriaAnimal(props: AuditoriaAnimalProps) {
  return <ConsultaAuditoriaAnimal key={`${props.id}:${getPropriedadeAtiva() ?? "todos"}`} {...props} />;
}
function ConsultaAuditoriaAnimal({ id, recarregarToken, fatos, modo = "tabela", ativo = true }: AuditoriaAnimalProps) {
  const [consulta, setConsulta] = useState<Consulta>(() => ({ pagina: 1, periodo: fatos ? "todos" : "30", ...(fatos ? { inicio: "", fim: "" } : periodo(30)), eixo: "", acao: "", responsavel: "", busca: "" }));
  const [maisFiltros, setMaisFiltros] = useState(false);
  const [busca, setBusca] = useState("");
  const [resultado, setResultado] = useState<ResultadoAuditoriaAnimal | null>(null);
  const [opcoes, setOpcoes] = useState<ResultadoAuditoriaAnimal["filtros"]>();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [selecionado, setSelecionado] = useState<FatoHistoricoAnimal | EntradaAuditoria | null>(null);
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const atualizar = () => {
      const data = new Date(); setAgora(data);
      clearTimeout(timer);
      timer = setTimeout(atualizar, new Date(data.getFullYear(), data.getMonth(), data.getDate() + 1).getTime() - data.getTime());
    };
    atualizar();
    window.addEventListener("focus", atualizar);
    document.addEventListener("visibilitychange", atualizar);
    return () => { clearTimeout(timer); window.removeEventListener("focus", atualizar); document.removeEventListener("visibilitychange", atualizar); };
  }, []);
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
    if (!ativo) return;
    let vigente = true;
    setCarregando(true); setErro(null); setResultado(null); setSelecionado(null);
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
  }, [id, propriedadeId, recarregarToken, parametros, tentativa, intervaloInvalido, ativo]);

  // Uma escrita ou a troca de animal/sítio volta ao início da consulta. A
  // limpeza do efeito acima impede uma resposta antiga de ocupar a nova ficha.
  useEffect(() => { setConsulta((q) => q.pagina === 1 ? q : { ...q, pagina: 1 }); setOpcoes(undefined); }, [id, propriedadeId, recarregarToken]);
  const alterar = (alteracoes: Partial<Consulta>) => setConsulta((q) => ({ ...q, ...alteracoes, pagina: 1 }));
  const total = resultado?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / TAMANHO_PAGINA));
  const pagina = consulta.pagina;

  const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const transicoes = new Map((resultado?.transicoes ?? []).map(t => [identidadeHistorico(t.entidade, t.entidadeId), t]));
  const fatosProjetados = (fatos ?? []).map(f => {
    const transicao = transicoes.get(identidadeHistorico(f.entidade, f.entidadeId));
    return transicao && f.projetarTransicao ? { ...f, ...f.projetarTransicao(transicao) } : f;
  });
  const fatosPorIdentidade = new Map(fatosProjetados.map(f => [identidadeHistorico(f.entidade, f.entidadeId), f]));
  const fatosFiltrados = fatosProjetados.filter(f => {
    const dia = f.data.slice(0, 10);
    if ((consulta.inicio && dia < consulta.inicio) || (consulta.fim && dia > consulta.fim)) return false;
    if (consulta.eixo && f.eixo !== consulta.eixo) return false;
    if (consulta.busca && !normalizar(`${f.titulo} ${f.textoBusca} ${f.entidadeId}`).includes(normalizar(consulta.busca))) return false;
    if (consulta.acao || consulta.responsavel) return false;
    return true;
  });
  type Linha = { chave: string; data: string; fato?: FatoHistoricoAnimal; entrada?: EntradaAuditoria };
  const linhas: Linha[] = fatosFiltrados.map(fato => ({ chave: fato.id, data: fato.data, fato }));
  for (const entrada of resultado?.itens ?? []) {
    const fato = fatosPorIdentidade.get(identidadeHistorico(entrada.entidade, entrada.entidadeId));
    const transicao = transicoes.get(identidadeHistorico(entrada.entidade, entrada.entidadeId));
    const constitui = fato && auditoriaConstituiFato(entrada) && (!transicao?.auditoriaId || entrada.id === transicao.auditoriaId);
    // A entrada inicial compartilha a linha do fato. Correções, desfazimentos,
    // exclusões e auditorias sem fato vigente continuam linhas independentes.
    const existente = constitui ? linhas.find(l => l.fato?.id === fato.id) : undefined;
    if (existente && !existente.entrada) { existente.entrada = entrada; continue; }
    linhas.push({ chave: `auditoria-${entrada.id ?? `${entrada.entidade}-${entrada.entidadeId}-${entrada.em}-${linhas.length}`}`, data: entrada.em, entrada });
  }
  const diaLinha = (linha: Linha) => linha.fato ? linha.data.slice(0, 10) : diaLocal(new Date(linha.data));
  linhas.sort((a, b) => diaLinha(b).localeCompare(diaLinha(a)) || (!a.fato && !b.fato ? b.data.localeCompare(a.data) : Number(!!b.fato) - Number(!!a.fato)) || a.chave.localeCompare(b.chave));
  const acoesLinha = (linha: Linha) => <div className="flex flex-wrap justify-center gap-2"><BotaoDetalhes variant="outline" size="sm" onClick={() => setSelecionado(linha.fato ?? linha.entrada ?? null)}>Ver auditoria</BotaoDetalhes>{linha.fato?.abrir && <BotaoDetalhes variant="outline" size="sm" onClick={linha.fato.abrir}>Ver registro</BotaoDetalhes>}</div>;
  const dataLinha = (linha: Linha) => linha.fato ? <>{formatarDataBR(linha.data)} - {dataRelativaFato(linha.data, agora)}</> : <>Alteração em {formatarDataHoraBR(linha.data)}</>;
  return <div className="mt-3 text-sm">
    <form aria-label="Filtros de auditoria" onSubmit={(e) => { e.preventDefault(); alterar({ busca: busca.trim() }); }} className="ficha-historico-filtros">
      <label className={rotulo}>Período<SelectCampo className={campo} value={consulta.periodo} onValueChange={(valorSelecionado) => {
        const valor = valorSelecionado;
        alterar({ periodo: valor, ...(valor === "todos" ? { inicio: "", fim: "" } : valor === "personalizado" ? {} : periodo(Number(valor))) });
      }}><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="todos">Todo o período</option><option value="personalizado">Período personalizado</option></SelectCampo></label>
      <div className={`${rotulo} order-first min-w-[180px] flex-1`}><label htmlFor={`busca-auditoria-${id}`}>Buscar registro</label><div className="flex gap-1"><input id={`busca-auditoria-${id}`} className={campo} type="search" maxLength={200} placeholder="Nome ou identificador" value={busca} onChange={(e) => setBusca(e.target.value)} /><button type="submit" aria-label="Buscar registros" className="rounded-md border border-border px-2 hover:bg-surface-2"><Search size={16} aria-hidden="true" /></button></div></div>
      <BotaoDetalhes type="button" variant="outline" aria-expanded={maisFiltros} aria-controls={`filtros-historico-${id}`} onClick={() => setMaisFiltros(v => !v)}>Mais filtros</BotaoDetalhes>
      {maisFiltros && <RebModal title="Filtros do histórico" onClose={() => setMaisFiltros(false)} actions={<BotaoDetalhes onClick={() => setMaisFiltros(false)}>Concluir</BotaoDetalhes>}><div id={`filtros-historico-${id}`} className="grid gap-4">
      <label className={rotulo}>Eixo<SelectCampo className={campo} value={consulta.eixo} onValueChange={(valorSelecionado) => alterar({ eixo: valorSelecionado })}><option value="">Todos os eixos</option>{Object.entries(EIXOS).map(([valor, eixo]) => <option key={valor} value={valor}>{eixo.nome}</option>)}<option value="NAO_CLASSIFICADO">Não classificado</option></SelectCampo></label>
      <label className={rotulo}>Ação<SelectCampo className={campo} value={consulta.acao} onValueChange={(valorSelecionado) => alterar({ acao: valorSelecionado })}><option value="">Todas</option>{opcoes?.acoes.map((a) => <option key={a.valor} value={a.valor}>{a.rotulo}</option>)}</SelectCampo></label>
      <label className={rotulo}>Responsável<SelectCampo className={campo} value={consulta.responsavel} onValueChange={(valorSelecionado) => alterar({ responsavel: valorSelecionado })}><option value="">Todos</option>{opcoes?.responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}{opcoes?.semResponsavel && <option value="sem">Não informado</option>}</SelectCampo></label>
      </div></RebModal>}
      {consulta.periodo === "personalizado" && <div className="flex flex-wrap gap-3 md:col-span-5"><label className={rotulo}>De<DatePicker value={consulta.inicio} onChange={inicio => alterar({ inicio })} /></label><label className={rotulo}>Até<DatePicker value={consulta.fim} onChange={fim => alterar({ fim })} /></label></div>}
    </form>
    {intervaloInvalido && <p role="alert" className="p-3 text-red-700">O início deve ser anterior ao fim.</p>}
    {carregando && <p role="status" className="p-4 text-ink-3">Carregando auditoria…</p>}
    {erro && <div className="flex items-center gap-3 p-3"><p role="alert" className="text-red-700">{erro}</p><Button secondary onClick={() => setTentativa((v) => v + 1)}>Tentar novamente</Button></div>}
    {!intervaloInvalido && (resultado || fatos) && <>
      {modo === "visual" ? <LinhaTempoConsulta rotulo="Fatos e alterações do animal" itens={linhas} dataDe={diaLinha} chaveDe={l => l.chave} complementoData={data => <span className="font-normal text-ink-3"> - {dataRelativaFato(data, agora)}</span>} render={linha => {
        const fato = linha.fato; const entrada = linha.entrada;
        return <CartaoConsulta className={`ficha-historico-item ${corEvento(fato?.entidade ?? entrada?.entidade)}`} icon={fato?.Icone ?? History} titulo={fato?.titulo ?? `Alteração · ${entrada?.registro ?? entrada?.entidade}`} acoes={acoesLinha(linha)}><div className="text-sm text-ink">{fato?.detalhe ?? (entrada && resumoAuditoriaLegivel(entrada))}{!fato && <span className="block text-ink-3">{dataLinha(linha)}</span>}</div></CartaoConsulta>;
      }} /> : <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-center text-sm consulta-tabela"><caption className="sr-only">{fatos ? "Histórico e auditoria dos registros do animal" : "Auditoria dos registros do animal"}</caption>
        <thead className="bg-surface-2 text-ink-3"><tr>{["Data e hora", "Eixo", "Ação", "Registro afetado", "Responsável", "Detalhes"].map(titulo => <th scope="col" key={titulo} className="px-3 py-2 text-center font-semibold">{titulo}{titulo === "Responsável" && <AjudaCampo rotulo="Sobre a autoria e os detalhes de auditoria" texto="Responsável é a autoria registrada na auditoria. Consulte a trilha do fato para ver todas as alterações." />}</th>)}</tr></thead>
        <tbody className="divide-y divide-border">{linhas.map(linha => {
          const entrada = linha.entrada; const fato = linha.fato; const codigoEixo = fato?.eixo ?? entrada?.eixo; const eixo = codigoEixo ? EIXOS[codigoEixo] : null; const Icone = fato?.Icone ?? eixo?.Icone;
          return <tr key={linha.chave}><td className="px-3 py-2 text-center">{dataLinha(linha)}</td><td className="px-3 py-2 text-center">{eixo ? <span className="inline-flex items-center gap-2">{Icone && <Icone size={17} aria-hidden className={corEvento(fato?.entidade ?? entrada?.entidade)} />}{eixo.nome}</span> : "Não classificado"}</td><td className="px-3 py-2 text-center">{fato?.titulo ?? entrada?.acaoRotulo ?? entrada?.acao}</td><td className="px-3 py-2 text-center">{fato?.detalhe ?? entrada?.registro ?? (entrada && resumoAuditoriaLegivel(entrada))}</td><td className="px-3 py-2 text-center">{entrada?.usuarioNome ?? "Não informado"}</td><td className="px-3 py-2 text-center">{acoesLinha(linha)}</td></tr>;
        })}</tbody>
      </table></div>}
      {!linhas.length && !carregando && !erro && <p className="p-5 text-center text-sm text-ink-3">Nenhum registro de auditoria neste período com os filtros selecionados.</p>}
      {resultado && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-3"><span>{total ? `${(pagina - 1) * TAMANHO_PAGINA + 1}–${Math.min(pagina * TAMANHO_PAGINA, total)}` : "0"} de {total} registros{fatos && " de auditoria · fatos conhecidos da ficha exibidos no mesmo período"}</span><div className="flex items-center gap-2"><Button secondary disabled={pagina <= 1} onClick={() => setConsulta((q) => ({ ...q, pagina: q.pagina - 1 }))}>Anterior</Button><label className="sr-only" htmlFor={`pagina-auditoria-${id}`}>Página da auditoria</label><SelectCampo id={`pagina-auditoria-${id}`} className="h-9 rounded-md border border-border bg-surface px-2 text-ink" value={pagina} onValueChange={(valorSelecionado) => setConsulta((q) => ({ ...q, pagina: Number(valorSelecionado) }))}>{Array.from({ length: paginas }, (_, i) => <option key={i + 1} value={i + 1}>Página {i + 1} de {paginas}</option>)}</SelectCampo><Button secondary disabled={pagina >= paginas} onClick={() => setConsulta((q) => ({ ...q, pagina: q.pagina + 1 }))}>Próxima</Button></div></div>}
    </>}
    {selecionado && ("detalhe" in selecionado ? <AuditoriaFatoAnimal key={identidadeHistorico(selecionado.entidade, selecionado.entidadeId)} animalId={id} entidade={selecionado.entidade} entidadeId={selecionado.entidadeId} resumo={selecionado.detalhe} onClose={() => setSelecionado(null)} /> : <RebModal title="Auditoria do registro" onClose={() => setSelecionado(null)} className="w-[min(900px,calc(100vw-32px))]"><DadosAuditoria entrada={selecionado} /></RebModal>)}
  </div>;
}
