import { useRascunhoConsulta } from "@/financeiro/useRascunhoConsulta";
import { filtrosDasColunas, type CampoConsulta } from "@/financeiro/FiltroColunaConsulta";
import { SelectCampo } from "@/financeiro/SelectCampo";
import { CampoFiltro } from "@/financeiro/PainelFiltros";
import { BarraConsulta } from "@/financeiro/BarraConsulta";
import { useEffect, useState } from "react";
import { ArrowRight, ClipboardList, FileClock, Search, Stethoscope, TriangleAlert, Venus } from "lucide-react";
import { Button, ErrorBox, Panel, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { formatBRDateISO, getHojeISO } from "../../../lib/hoje";
import { Paginacao } from "../ui";
import { obterReproducao } from "./api";
import { consultarIndicadores } from "./indicadores-api";
import { descreverMotivo } from "./elegibilidade-api";
import { navegarConsultaComSitio } from "./contexto-consulta";
import { carregarAnimaisManejo, filtrarManejo, lerConsultaManejo, montarFilasManejo, type ConsultaManejo, type FilaManejo, type LinhaManejo } from "./manejo-reprodutivo";

const FILAS = [
  { id: "liberadas", titulo: "Liberadas sem serviço", descricao: "Matrizes com liberação comprovada até hoje.", Icone: Venus },
  { id: "diagnostico", titulo: "Aguardando diagnóstico", descricao: "Tentativas aguardando diagnóstico, sem presumir resultado ou prazo clínico.", Icone: Stethoscope },
  { id: "pendencias", titulo: "Pendências", descricao: "Confira origem do ciclo, liberação, restrições e dados de escopo antes do manejo.", Icone: ClipboardList },
] as const;
type DadosManejo = { propriedadeId: number; hoje: string; filas: Record<FilaManejo, LinhaManejo[]> };
export function ManejoReprodutivo({ propriedadeId, podeLancar, onRegistrarEvento, onConsultarHistorico, recarregarToken = 0 }: {
  propriedadeId?: number; podeLancar: boolean; onRegistrarEvento?: () => void; onConsultarHistorico?: () => void; recarregarToken?: number;
}) {
  const [consulta, setConsulta] = useState(lerConsultaManejo);
  const [dados, setDados] = useState<DadosManejo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const hoje = getHojeISO();
  useEffect(() => {
    const atualizar = () => setConsulta(lerConsultaManejo());
    window.addEventListener("popstate", atualizar);
    return () => window.removeEventListener("popstate", atualizar);
  }, []);
  useEffect(() => {
    let ativo = true;
    setDados(null); setErro(null); setCarregando(true);
  if (!propriedadeId) { setCarregando(false); return; }
    void Promise.all([
      obterReproducao(undefined, propriedadeId),
      consultarIndicadores({ propriedadeId, inicio: hoje, fim: hoje, corte: hoje, deslocamentoTeDias: 7 }),
      carregarAnimaisManejo(propriedadeId, () => ativo),
    ]).then(([painel, snapshot, animais]) => {
      if (!ativo) return;
      if (!snapshot.acompanhamento) throw new Error("A consulta não trouxe a fila de manejo. Tente novamente ou consulte os animais e ciclos.");
      setDados({ propriedadeId, hoje, filas: montarFilasManejo(painel, snapshot.acompanhamento, animais, hoje) });
    }).catch(e => { if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível carregar o manejo."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [propriedadeId, hoje, tentativa, recarregarToken]);
  const visivel = dados && dados.propriedadeId === propriedadeId && dados.hoje === hoje ? dados : null;
  const filas = visivel?.filas;
  const filtradas = {
    liberadas: filtrarManejo(filas?.liberadas ?? [], consulta),
    diagnostico: filtrarManejo(filas?.diagnostico ?? [], consulta),
    pendencias: filtrarManejo(filas?.pendencias ?? [], consulta),
  };
  const atual = FILAS.find(f => f.id === consulta.fila)!;
  const linhas = filtradas[consulta.fila];
  const paginas = Math.max(1, Math.ceil(linhas.length / consulta.tamanho));
  const pagina = Math.min(consulta.pagina, paginas);
  const lotes = [...new Map(Object.values(filas ?? {}).flat().flatMap(a => a.lote ? [[a.lote.id, a.lote] as const] : [])).values()].sort((a,b) => a.nome.localeCompare(b.nome, "pt-BR"));
  function mudar(patch: Partial<ConsultaManejo>) {
    const proxima = { ...consulta, ...patch, pagina: patch.pagina ?? 1 };
    const url = new URL(window.location.href);
    for (const [chave, valor] of Object.entries({ fila: proxima.fila, q: proxima.busca, lote: proxima.lote, ordem: proxima.ordem, pagina: proxima.pagina, porPagina: proxima.tamanho })) {
      if (valor === "") url.searchParams.delete(chave); else url.searchParams.set(chave, String(valor));
    }
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    setConsulta(proxima);
  }
    const edicaoFiltros = useRascunhoConsulta({busca:consulta.busca,lote:consulta.lote,ordem:consulta.ordem},{busca:"",lote:"",ordem:"maior-espera" as ConsultaManejo["ordem"]},v=>mudar(v));
  const campos: CampoConsulta[] = [
    {chave:"animal", naBarra: true,ativo:!!consulta.busca,limpar:()=>edicaoFiltros.editar("busca",""),conteudo:<CampoFiltro rotulo="Animal"><input className={classeInput} aria-label="Buscar animal no filtro" value={edicaoFiltros.rascunho.busca} onChange={e=>edicaoFiltros.editar("busca",e.target.value)}/></CampoFiltro>},
    {chave:"lote",ativo:!!consulta.lote,limpar:()=>edicaoFiltros.editar("lote",""),conteudo:<CampoFiltro rotulo="Lote"><SelectCampo aria-label="Filtrar lote" value={edicaoFiltros.rascunho.lote} onValueChange={v=>edicaoFiltros.editar("lote",v)}><option value="">Todos os lotes</option><option value="sem-lote">Sem lote informado</option>{consulta.lote && consulta.lote!=="sem-lote" && !lotes.some(l=>l.id===consulta.lote) && <option value={consulta.lote}>Lote selecionado sem animais nesta consulta</option>}{lotes.map(l=><option key={l.id} value={l.id}>{l.nome}</option>)}</SelectCampo></CampoFiltro>},
    {chave:"ordem",colunas:[],ativo:consulta.ordem!=="maior-espera",limpar:()=>edicaoFiltros.editar("ordem","maior-espera"),conteudo:<CampoFiltro rotulo="Ordenar por"><SelectCampo aria-label="Ordenar animais" value={edicaoFiltros.rascunho.ordem} onValueChange={v=>edicaoFiltros.editar("ordem",v as ConsultaManejo["ordem"])}><option value="maior-espera">Maior espera</option><option value="menor-espera">Menor espera</option><option value="animal">Identificação do animal</option></SelectCampo></CampoFiltro>},
  ];
  if (!propriedadeId) return <p className="rounded-xl border p-5">Selecione um sítio para consultar as filas de manejo.</p>;
  return <section className="manejo-v4 space-y-5" aria-label="Manejo reprodutivo">
    {onRegistrarEvento && podeLancar && <div className="manejo-v4-acao flex justify-end"><Button onClick={onRegistrarEvento}>Registrar evento</Button></div>}
    <ErrorBox erro={erro}/>
    {erro && <Button secondary onClick={() => setTentativa(v => v + 1)}>Tentar novamente</Button>}
    <BarraConsulta criterios={consulta.ordem !== "maior-espera" ? [{id:"ordem",rotulo:`Ordenação: ${consulta.ordem === "animal" ? "Identificação" : "Menor espera"}`,limpar:()=>mudar({ordem:"maior-espera"})}] : []} onLimpar={()=>mudar({busca:"",lote:"",ordem:"maior-espera"})}>
      {FILAS.map(({ id, titulo, Icone }) => <button type="button" key={id} aria-label={`${titulo} ${visivel ? filtradas[id].length : "carregando"}`} aria-pressed={consulta.fila === id} onClick={() => mudar({ fila: id })}
        className={`flex min-h-20 items-center gap-4 rounded-xl border px-5 py-4 text-left font-semibold shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${consulta.fila === id ? "border-primary bg-primary text-primary-foreground ring-4 ring-white" : "border-border bg-white text-foreground hover:bg-muted"}`}>
        <Icone aria-hidden size={23}/><span className="flex-1">{titulo}</span><span className={`rounded-full px-3 py-1 text-sm ${consulta.fila === id ? "bg-white text-primary" : "bg-muted"}`}>{visivel ? filtradas[id].length : "—"}</span>
      </button>)}
    </BarraConsulta>
    <Panel className="overflow-hidden">
      <header className="space-y-4 p-5">
        <div><p className="mt-1 text-muted-foreground">{atual.descricao}</p></div>
        <BarraConsulta campos={campos} edicaoFiltros={edicaoFiltros} criterios={[...(consulta.lote?[{id:"lote",rotulo:`Lote: ${lotes.find(l=>l.id===consulta.lote)?.nome??"Sem lote informado"}`,limpar:()=>mudar({lote:""})}]:[]),...(consulta.ordem!=="maior-espera"?[{id:"ordem",rotulo:`Ordenação: ${consulta.ordem==="animal"?"Identificação":"Menor espera"}`,limpar:()=>mudar({ordem:"maior-espera"})}]:[])]}><label className="fin-filtro-busca relative"><Search aria-hidden size={18} className="pointer-events-none absolute left-3 top-3.5 text-muted-foreground"/><input aria-label="Buscar animal" placeholder="Buscar animal" className={`${classeInput} pl-10`} value={consulta.busca} onChange={e=>mudar({busca:e.target.value})}/></label></BarraConsulta>
      </header>
      {carregando && <p role="status" className="p-5">Carregando filas de manejo…</p>}
      {visivel && <>
        <TabelaFinanceira filtrosColunas={filtrosDasColunas(campos,edicaoFiltros)} rotulo={atual.titulo} itens={linhas.slice((pagina - 1) * consulta.tamanho, pagina * consulta.tamanho)} chaveDe={a => a.animalId} colunas={[
          { chave: "animal", titulo: "Animal", principal: true, larguraMinima: 230, celula: a => <div><p className="font-semibold text-base">{a.brinco}</p>{a.nome && <p className="mt-0.5 text-sm text-muted-foreground">{a.nome}</p>}</div> },
          { chave: "lote", titulo: "Lote", larguraMinima: 170, celula: a => a.lote?.nome ?? "Não informado" },
          { chave: "data", titulo: consulta.fila === "diagnostico" ? "Última tentativa" : "Liberada em", celula: a => a.data ? formatBRDateISO(a.data) : "Não comprovada" },
          { chave: "dias", titulo: consulta.fila === "diagnostico" ? "Dias desde tentativa" : "Dias sem serviço", celula: a => a.dias == null ? "Não comprovados" : `${a.dias} dias` },
          { chave: "situacao", titulo: consulta.fila === "pendencias" ? "Conferência necessária" : "Situação", celula: a => consulta.fila === "pendencias" ? <ul className="max-w-sm space-y-1 text-sm">{a.motivos.map(m => <li key={m}>{descreverMotivo(m)}</li>)}</ul> : <Pill tone="amber">{consulta.fila === "liberadas" ? "Liberada" : "Aguardando diagnóstico"}</Pill> },
          { chave: "acao", titulo: "Ação", acoes: true, celula: a => <button className="inline-flex items-center gap-2 whitespace-nowrap font-semibold text-primary hover:underline" onClick={() => navegarConsultaComSitio(`/pecuaria/rebanho/animais/${a.animalId}#reproducao`, propriedadeId)}>Abrir ficha <ArrowRight aria-hidden size={17}/></button> },
        ]}/>
        <div className="flex flex-wrap items-center justify-end border-t border-border px-4 pt-3"><label className="text-sm">Animais por página <select className="ml-2 rounded-lg border border-border bg-white px-3 py-2" aria-label="Animais por página" value={consulta.tamanho} onChange={e => mudar({ tamanho: Number(e.target.value) })}>{[4,10,25,50].map(n => <option key={n} value={n}>{n} por página</option>)}</select></label></div>
        <Paginacao paginaAtual={pagina} totalPaginas={paginas} totalItens={linhas.length} itensPorPagina={consulta.tamanho} onPaginaChange={pagina => mudar({ pagina })} rotulo="animais" idSelect="pagina-manejo"/>
      </>}
    </Panel>
    {visivel && filtradas.pendencias.length > 0 && consulta.fila !== "pendencias" && <aside className="flex flex-wrap items-center gap-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"><TriangleAlert aria-hidden size={28}/><div className="flex-1"><p className="font-semibold">{filtradas.pendencias.length} animais precisam de conferência</p><p className="text-sm">Liberação, restrições ou origem do ciclo precisam de revisão.</p></div><Button secondary onClick={() => mudar({ fila: "pendencias" })}>Abrir tabela de pendências <ArrowRight aria-hidden size={16}/></Button></aside>}
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm"><div className="flex flex-wrap gap-5">{onConsultarHistorico && <button className="inline-flex items-center gap-2 text-primary underline" onClick={onConsultarHistorico}><FileClock aria-hidden size={17}/>Consultar todos os animais e ciclos</button>}<button className="text-primary underline" onClick={() => navegarConsultaComSitio("/pecuaria/relatorios?tipo=indicadores", propriedadeId)}>Consultar histórico de períodos</button></div><span className="text-muted-foreground">Situação em {formatBRDateISO(hoje)}</span></footer>
  </section>;
}
