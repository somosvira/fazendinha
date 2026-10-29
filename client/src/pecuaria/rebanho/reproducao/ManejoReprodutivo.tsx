import { listarCategorias } from "../api";
import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from "../../../components/VisualizacaoConsulta";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import type { ControleOrdenacao } from "../../../financeiro/OrdenarConsulta";
import { IdentificacaoReproducao, LinkReproducao } from "./ConsultaReproducaoUI";
import { useRascunhoConsulta } from "@/financeiro/useRascunhoConsulta";
import { filtrosDasColunas, type CampoConsulta } from "@/financeiro/FiltroColunaConsulta";
import { SelectCampo } from "@/financeiro/SelectCampo";
import { CampoFiltro } from "@/financeiro/PainelFiltros";
import { BarraConsulta } from "@/financeiro/BarraConsulta";
import { useEffect, useState } from "react";
import { ClipboardList, Search, Stethoscope, TriangleAlert, Venus } from "lucide-react";
import { ErrorBox, Panel, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { formatBRDateISO, getHojeISO } from "../../../lib/hoje";
import { Paginacao } from "../ui";
import { obterReproducao } from "./api";
import { consultarIndicadores } from "./indicadores-api";
import { descreverMotivo } from "./elegibilidade-api";

import { carregarAnimaisManejo, filtrarManejo, lerConsultaManejo, montarFilasManejo, type ConsultaManejo, type FilaManejo, type LinhaManejo } from "./manejo-reprodutivo";

const FILAS = [
  { id: "liberadas", titulo: "Liberadas sem serviço", descricao: "Matrizes com liberação comprovada até hoje.", Icone: Venus },
  { id: "diagnostico", titulo: "Aguardando diagnóstico", descricao: "Tentativas aguardando diagnóstico, sem presumir resultado ou prazo clínico.", Icone: Stethoscope },
  { id: "pendencias", titulo: "Pendências de cadastro e liberação", descricao: "Confira origem do ciclo, liberação, restrições e dados de escopo antes do manejo.", Icone: ClipboardList },
] as const;
type DadosManejo = { propriedadeId: number; hoje: string; filas: Record<FilaManejo, LinhaManejo[]> };
export function ManejoReprodutivo({ propriedadeId, podeLancar, onRegistrarEvento, recarregarToken = 0 }: {
  propriedadeId?: number; podeLancar: boolean; onRegistrarEvento?: () => void; onConsultarHistorico?: () => void; recarregarToken?: number;
}) {
  const visual = useVisualizacaoConsulta("visualAnimaisReproducao", "reproducao");
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
      listarCategorias(),
    ]).then(([painel, snapshot, animais, categorias]) => {
      if (!ativo) return;
      if (!snapshot.acompanhamento) throw new Error("A consulta não trouxe a fila de manejo. Tente novamente ou consulte os animais e ciclos.");
      setDados({ propriedadeId, hoje, filas: montarFilasManejo(painel, snapshot.acompanhamento, animais, hoje, categorias.itens) });
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
  const atual = FILAS.find(f => f.id === consulta.fila);
  const todas = [...new Map(Object.values(filtradas).flat().map(a => [a.animalId, a])).values()];
  const linhas = consulta.fila === "todas" ? filtrarManejo(todas, consulta)
    : consulta.fila === "manejo" ? filtrarManejo([...filtradas.liberadas, ...filtradas.diagnostico], consulta)
    : filtradas[consulta.fila];
  const filaDe = (id: string) => FILAS.find(f => filas?.[f.id].some(a => a.animalId === id))?.id;
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
    const edicaoFiltros = useRascunhoConsulta({fila:consulta.fila,busca:consulta.busca,lote:consulta.lote,ordem:consulta.ordem},{fila:"manejo" as ConsultaManejo["fila"],busca:"",lote:"",ordem:"maior-espera" as ConsultaManejo["ordem"]},v=>mudar(v));
  const campos: CampoConsulta[] = [
    {chave:"situacao",ativo:consulta.fila!=="manejo",limpar:()=>edicaoFiltros.editar("fila","manejo"),conteudo:<CampoFiltro rotulo="Situação"><SelectCampo aria-label="Filtrar situação do manejo" value={edicaoFiltros.rascunho.fila} onValueChange={v=>edicaoFiltros.editar("fila",v as ConsultaManejo["fila"])}><option value="manejo">Manejo: liberadas e diagnóstico</option><option value="todas">Todas as filas</option>{FILAS.map(f=><option key={f.id} value={f.id}>{f.titulo}</option>)}</SelectCampo></CampoFiltro>},
    {chave:"animal", naBarra: true,ativo:!!consulta.busca,limpar:()=>edicaoFiltros.editar("busca",""),conteudo:<CampoFiltro rotulo="Animal"><Input className={classeInput} aria-label="Buscar animal no filtro" value={edicaoFiltros.rascunho.busca} onChange={e=>edicaoFiltros.editar("busca",e.target.value)}/></CampoFiltro>},
    {chave:"lote",ativo:!!consulta.lote,limpar:()=>edicaoFiltros.editar("lote",""),conteudo:<CampoFiltro rotulo="Lote"><SelectCampo aria-label="Filtrar lote" value={edicaoFiltros.rascunho.lote} onValueChange={v=>edicaoFiltros.editar("lote",v)}><option value="">Todos os lotes</option><option value="sem-lote">Sem lote informado</option>{consulta.lote && consulta.lote!=="sem-lote" && !lotes.some(l=>l.id===consulta.lote) && <option value={consulta.lote}>Lote selecionado sem animais nesta consulta</option>}{lotes.map(l=><option key={l.id} value={l.id}>{l.nome}</option>)}</SelectCampo></CampoFiltro>},
    {chave:"ordem",colunas:[],ativo:consulta.ordem!=="maior-espera",limpar:()=>edicaoFiltros.editar("ordem","maior-espera"),conteudo:<CampoFiltro rotulo="Ordenar por"><SelectCampo aria-label="Ordenar animais" value={edicaoFiltros.rascunho.ordem} onValueChange={v=>edicaoFiltros.editar("ordem",v as ConsultaManejo["ordem"])}><option value="maior-espera">Maior espera</option><option value="menor-espera">Menor espera</option><option value="animal">Identificação do animal · A–Z</option><option value="animal-desc">Identificação do animal · Z–A</option></SelectCampo></CampoFiltro>},
  ];
  const ordenacao: ControleOrdenacao = { campo: consulta.ordem.startsWith("animal") ? "animal" : "espera", direcao: consulta.ordem === "menor-espera" || consulta.ordem === "animal" ? "asc" : "desc", campos: [{chave:"espera",rotulo:"Espera",tipo:"numero"},{chave:"animal",rotulo:"Animal",tipo:"texto"}], mudar: v=>mudar({ordem:v.campo==="animal"?(v.direcao==="asc"?"animal":"animal-desc"):(v.direcao==="asc"?"menor-espera":"maior-espera")}), restaurar:()=>mudar({ordem:"maior-espera"}) };
  if (!propriedadeId) return <p className="rounded-xl border p-5">Selecione um sítio para consultar as filas de manejo.</p>;
  return <section className="manejo-v4 space-y-5" aria-label="Manejo reprodutivo">
    <ErrorBox erro={erro}/>
    {erro && <Button variant="outline" onClick={() => setTentativa(v => v + 1)}>Tentar novamente</Button>}
    {visivel && filtradas.pendencias.length > 0 && <aside className="reproducao-pendencias"><TriangleAlert aria-hidden size={20}/><div><strong>{filtradas.pendencias.length} animais com pendências de cadastro e liberação</strong><p>Esta contagem não inclui os {filtradas.diagnostico.length} animais aguardando diagnóstico.</p></div><Button variant="outline" onClick={() => mudar({ fila: "pendencias" })}>Revisar pendências</Button></aside>}
    <Panel className="overflow-hidden">
      <header>

        <BarraConsulta ordenacao={ordenacao} campos={campos} edicaoFiltros={edicaoFiltros} acao={onRegistrarEvento && podeLancar ? <Button onClick={onRegistrarEvento}>Registrar evento</Button> : undefined} criterios={[...(consulta.fila!=="manejo"?[{id:"fila",rotulo:atual?.titulo??"Todas as filas",limpar:()=>mudar({fila:"manejo"})}]:[]),...(consulta.lote?[{id:"lote",rotulo:`Lote: ${lotes.find(l=>l.id===consulta.lote)?.nome??"Sem lote informado"}`,limpar:()=>mudar({lote:""})}]:[]),...(consulta.ordem!=="maior-espera"?[{id:"ordem",rotulo:`Ordenação: ${consulta.ordem.startsWith("animal")?`Identificação (${consulta.ordem==="animal"?"A–Z":"Z–A"})`:"Menor espera"}`,limpar:()=>mudar({ordem:"maior-espera"})}]:[])]}><label className="fin-filtro-busca relative"><Search aria-hidden size={18} className="pointer-events-none absolute left-3 top-3.5 text-muted-foreground"/><Input aria-label="Buscar animal" placeholder="Buscar animal" className={`${classeInput} pl-10`} value={consulta.busca} onChange={e=>mudar({busca:e.target.value})}/></label></BarraConsulta>
      </header>
      {carregando && <p role="status" className="p-5">Carregando filas de manejo…</p>}
      {visivel && <>
        <div className="repro-consulta-titulo"><div><h2>Filas de manejo <span>{linhas.length} animais</span></h2><p>{atual?.descricao ?? (consulta.fila === "manejo" ? "Liberadas sem serviço e aguardando diagnóstico. Pendências de cadastro são consultadas separadamente." : "Todas as filas, incluindo pendências de cadastro e liberação.")}</p></div><AlternarVisualizacaoConsulta {...visual} rotulo="Visualização dos animais e acompanhamentos"/></div>
        {visual.modo === "visual" && linhas.length > 0 ? <div className="reproducao-cartoes reproducao-manejo-cartoes">{linhas.slice((pagina - 1) * consulta.tamanho, pagina * consulta.tamanho).map(a => {
          const fila = filaDe(a.animalId);
          return <article className="reproducao-cartao" key={a.animalId}>
            <header><div><IdentificacaoReproducao id={a.animalId} brinco={a.brinco} nome={a.nome} sitio={propriedadeId}/><p>{a.lote?.nome ?? "Lote não informado"}</p></div><Pill tone={fila === "liberadas" ? "green" : "amber"}>{fila === "liberadas" ? "Liberada" : fila === "diagnostico" ? "Aguardando diagnóstico" : "Evidência pendente"}</Pill></header>
            <div className="reproducao-cartao-acompanhamento">{fila === "pendencias" ? <ul>{a.motivos.map(m => <li key={m}>{descreverMotivo(m)}</li>)}</ul> : <strong>{a.dias ?? "—"} dias {fila === "diagnostico" ? "desde a tentativa" : "sem serviço"}</strong>}</div>
            <dl><div><dt>Fila de manejo</dt><dd>{FILAS.find(f => f.id === fila)?.titulo ?? "Não informada"}</dd></div><div><dt>Data de referência</dt><dd>{a.data ? formatBRDateISO(a.data) : "Não comprovada"}</dd></div></dl>
            <footer><LinkReproducao botao sitio={propriedadeId} href={`/pecuaria/rebanho/animais/${a.animalId}#reproducao`}>Abrir ficha</LinkReproducao></footer>
          </article>;
        })}</div> : <TabelaFinanceira visualizacao="tabela" filtrosColunas={filtrosDasColunas(campos,edicaoFiltros)} rotulo={atual?.titulo ?? "Animais e acompanhamentos"} itens={linhas.slice((pagina - 1) * consulta.tamanho, pagina * consulta.tamanho)} chaveDe={a => a.animalId} colunas={[
          { chave: "animal", titulo: "Animal", principal: true, larguraMinima: 160, celula: a => <IdentificacaoReproducao id={a.animalId} brinco={a.brinco} nome={a.nome} sitio={propriedadeId}/> },
          { chave: "lote", titulo: "Lote", larguraMinima: 110, celula: a => a.lote?.nome ?? "Não informado" },
          { chave: "data", titulo: "Data de referência", celula: a => a.data ? <div>{formatBRDateISO(a.data)}<p className="text-xs text-muted-foreground">{a.dias ?? "—"} dias {filaDe(a.animalId)==="diagnostico"?"desde a tentativa":"sem serviço"}</p></div> : "Não comprovada" },
          { chave: "situacao", titulo: consulta.fila === "pendencias" ? "Conferência necessária" : "Situação", celula: a => filaDe(a.animalId) === "pendencias" ? <ul className="max-w-sm space-y-1 text-sm">{a.motivos.map(m => <li key={m}>{descreverMotivo(m)}</li>)}</ul> : <Pill tone={filaDe(a.animalId)==="liberadas"?"green":"amber"}>{filaDe(a.animalId) === "liberadas" ? "Liberada" : "Aguardando diagnóstico"}</Pill> },
          { chave: "acao", titulo: "Ação", acoes: true, celula: a => <LinkReproducao botao sitio={propriedadeId} href={`/pecuaria/rebanho/animais/${a.animalId}#reproducao`}>Abrir ficha</LinkReproducao> },
        ]}/>}
        <div className="flex flex-wrap items-center justify-end border-t border-border px-4 pt-3"><label className="text-sm">Animais por página <SelectCampo className="ml-2" aria-label="Animais por página" value={String(consulta.tamanho)} onValueChange={v => mudar({ tamanho: Number(v) })}>{[4,10,25,50].map(n => <option key={n} value={n}>{n} por página</option>)}</SelectCampo></label></div>
        <Paginacao paginaAtual={pagina} totalPaginas={paginas} totalItens={linhas.length} itensPorPagina={consulta.tamanho} onPaginaChange={pagina => mudar({ pagina })} rotulo="animais" idSelect="pagina-manejo"/>
      </>}
    </Panel>
  </section>;
}
