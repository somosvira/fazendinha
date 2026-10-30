import { CartoesLotes } from "./CartoesLotes";
import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from "@/components/VisualizacaoConsulta";
import { useOrdenacaoTabela } from "@/financeiro/OrdenarConsulta";
import { filtrosDasColunas, type CampoConsulta } from "@/financeiro/FiltroColunaConsulta";
import { CampoFiltro } from "@/financeiro/PainelFiltros";
import { useRascunhoConsulta } from "@/financeiro/useRascunhoConsulta";
import { BarraConsulta } from "@/financeiro/BarraConsulta";
import { SelectCampo } from "@/financeiro/SelectCampo";
import { DatePicker } from "@/components/DatePicker";
import { Checkbox } from "@/components/ui/checkbox";
// Lista de lotes — duas seções empilhadas (Lotes · Histórico de movimentações),
// no padrão das seções de DetalheLote.tsx (Panel com cabeçalho <h2 className=
// "font-serif text-xl">). Antes eram sub-abas; agora o histórico fica sempre
// visível, então mover/desfazer precisa recarregar as duas seções.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, Layers, Plus } from "lucide-react";
import { MultiSelect } from "../../../components/MultiSelect";
import { dataValida } from "../reproducao/periodo-consulta";
import { DateRangePicker, dateFromIso, isoDate } from "../../../components/DateRangePicker";
import { DialogFinanceiro } from "../../../financeiro/DialogFinanceiro";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Loader } from "@/components/Loading";
import { usePropriedades } from "../../../api/propriedades";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { AcoesLinha, Button, type ColunaTabela, ErrorBox, PageHeader, PaginaFinanceira, Panel, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { Paginacao, useAoMovimentarComToast } from "../ui";
import { NavRebanho } from "./NavRebanho";
import { editarLote, listarLotes, listarMovimentacoes, obterCatalogos } from "../api";
import type { AnimalResumo, Catalogos, Lote } from "../types";
import { FormLote } from "../cadastros/FormLote";
import { FormMovimentar } from "../forms/FormMovimentar";
import { SeletorAnimais } from "../components/SeletorAnimais";
import { HistoricoMovimentacoes } from "../components/HistoricoMovimentacoes";
import { DetalheMovimentacao } from "../components/DetalheMovimentacao";
import { BuscaLista } from "../../../components/BuscaLista";

type Painel = { modo: "novo" } | { modo: "editar"; id: string } | null;
const LOTES_POR_PAGINA = 15;

const colunasLotes = (editar: (l: Lote) => void, alternar: (l: Lote) => void): ColunaTabela<Lote>[] => [
  { chave: "lote", titulo: "Lote", larguraMinima: 160, principal: true, celula: (l) => <strong className="break-words">{l.nome}</strong> },
  { chave: "sitio", titulo: "Sítio", larguraMinima: 160, larguraFlexivel: true, celula: (l) => <span className="break-words">{l.propriedade.nome}</span> },
  { chave: "animais", titulo: "Animais ativos", alinhamento: "centro", larguraMinima: 130, celula: (l) => l.animaisAtivos },
  { chave: "situacao", titulo: "Situação", alinhamento: "direita", larguraMinima: 100, celula: (l) => <Pill tone={l.ativo ? "green" : "neutral"}>{l.ativo ? "Ativo" : "Inativo"}</Pill> },
  { chave: "acoes", titulo: "Ações", alinhamento: "direita", larguraMinima: 110, acoes: true, celula: (l) => <AcoesLinha nome={l.nome} ativo={l.ativo} onEditar={() => editar(l)} onAlternar={() => alternar(l)} /> },
];

/** Compartilhada com DetalheLote (mesma redação para desativar um lote). */
export function mensagemDesativar(lote: Lote): string {
  return lote.animaisAtivos > 0
    ? `Este lote tem ${lote.animaisAtivos} ${lote.animaisAtivos === 1 ? "animal ativo" : "animais ativos"}. Mova-os para outro lote antes de desativar.`
    : "O lote deixa de aparecer para novos cadastros e movimentações. Você pode reativar quando quiser.";
}

export function ListaLotes({ podeLancar = true, onAbrirLote }: { podeLancar?: boolean; onAbrirLote: (id: string) => void }) {
  const visual = useVisualizacaoConsulta("visualLotes");
  const sitioGlobal = getPropriedadeAtiva();
  const [mostrarInativos, setMostrarInativos] = useState(() => new URLSearchParams(window.location.search).get("lotesInativos") === "true");
  const [filtroSitio, setFiltroSitio] = useState(() => sitioGlobal == null ? new URLSearchParams(window.location.search).get("sitioLote") ?? "" : "");
  const [busca, setBusca] = useState(() => new URLSearchParams(window.location.search).get("buscaLote") ?? "");
  const [paginaLotes, setPaginaLotes] = useState(() => Math.max(1, Math.floor(Number(new URLSearchParams(window.location.search).get("paginaLotes")) || 1)));
  const [lotes, setLotes] = useState<Lote[] | null>(null);
  const sitios = usePropriedades();
  const [painel, setPainel] = useState<Painel>(null);
  const [confirmando, setConfirmando] = useState<Lote | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const emCurso = useRef(false);

  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [selecionandoAnimais, setSelecionandoAnimais] = useState(false);
  const [movimentando, setMovimentando] = useState<AnimalResumo[] | null>(null);
  useEffect(() => { obterCatalogos().then(setCatalogos).catch(() => undefined); }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    ["buscaLote", "sitioLote", "lotesInativos", "paginaLotes"].forEach(chave => params.delete(chave));
    if (busca) params.set("buscaLote", busca);
    if (filtroSitio && sitioGlobal == null) params.set("sitioLote", filtroSitio);
    if (mostrarInativos) params.set("lotesInativos", "true");
    if (paginaLotes > 1) params.set("paginaLotes", String(paginaLotes));
    window.history.replaceState(window.history.state, "", window.location.pathname + (params.size ? `?${params}` : "") + window.location.hash);
  }, [busca, filtroSitio, mostrarInativos, paginaLotes, sitioGlobal]);

  useEffect(() => {
    const restaurar = () => {
      const params = new URLSearchParams(window.location.search);
      setBusca(params.get("buscaLote") ?? "");
      setFiltroSitio(sitioGlobal == null ? params.get("sitioLote") ?? "" : "");
      setMostrarInativos(params.get("lotesInativos") === "true");
      setPaginaLotes(Math.max(1, Math.floor(Number(params.get("paginaLotes")) || 1)));
    };
    window.addEventListener("popstate", restaurar);
    return () => window.removeEventListener("popstate", restaurar);
  }, [sitioGlobal]);

  // ---------- histórico ----------
  const [sitiosHistorico, setSitiosHistorico] = useState<string[]>(()=>new URLSearchParams(window.location.search).getAll("movSitioIds"));
  const [lotesHistorico, setLotesHistorico] = useState<string[]>(()=>new URLSearchParams(window.location.search).getAll("movLoteIds"));
  const [dataDeHistorico, setDataDeHistorico] = useState(()=>new URLSearchParams(window.location.search).get("movDe")??"");
  const [dataAteHistorico, setDataAteHistorico] = useState(()=>new URLSearchParams(window.location.search).get("movAte")??"");
  const [mostrarDesfeitas, setMostrarDesfeitas] = useState(()=>new URLSearchParams(window.location.search).get("movDesfeitas")!=="false");
  /* bump manual: um desfazer/mover feito de dentro de DetalheMovimentacao ou do formulário
   * de movimentação não passa pelo próprio HistoricoMovimentacoes, então precisa forçar o
   * recarregamento por fora */
  const [paginaHistorico,setPaginaHistorico]=useState(()=>Math.max(1,Math.floor(Number(new URLSearchParams(window.location.search).get("movPagina"))||1)));
  const [historicoRefresh, setHistoricoRefresh] = useState(0);
  const [movimentacaoAbertaId, setMovimentacaoAbertaId] = useState<string | null>(null);

  const edicaoHistorico = useRascunhoConsulta({ sitios: sitiosHistorico, lotes: lotesHistorico, desfeitas: mostrarDesfeitas }, { sitios: [] as string[], lotes: [] as string[], desfeitas: false }, v => { setSitiosHistorico(v.sitios); setLotesHistorico(v.lotes); setMostrarDesfeitas(v.desfeitas); setPaginaHistorico(1); });
  const carregarHistorico = useCallback((pagina: number) => (dataDeHistorico && !dataValida(dataDeHistorico)) || (dataAteHistorico && !dataValida(dataAteHistorico)) ? Promise.reject(new Error("Informe datas válidas para o histórico de movimentações.")) : dataDeHistorico && dataAteHistorico && dataDeHistorico > dataAteHistorico ? Promise.reject(new Error("A data final não pode anteceder a inicial.")) : listarMovimentacoes({
    propriedadeIds: sitiosHistorico.length ? sitiosHistorico.map(Number) : undefined, loteIds: lotesHistorico.length ? lotesHistorico : undefined,
    dataDe: dataDeHistorico || undefined,
    dataAte: dataAteHistorico || undefined,
    incluirDesfeitas: mostrarDesfeitas,
    page: pagina,
    pageSize: 20,
  }), [dataDeHistorico, dataAteHistorico, mostrarDesfeitas, sitiosHistorico, lotesHistorico]);

  const recarregarTokenHistorico = `${dataDeHistorico}|${dataAteHistorico}|${mostrarDesfeitas}|${historicoRefresh}|${sitiosHistorico.join(",")}|${lotesHistorico.join(",")}`;

  const lotesDoSitioHistorico = useMemo(
    () => (catalogos?.lotes ?? []).filter((lote) => edicaoHistorico.rascunho.sitios.length ? edicaoHistorico.rascunho.sitios.includes(String(lote.propriedadeId)) : true),
    [catalogos, edicaoHistorico.rascunho.sitios],
  );

  useEffect(()=>{const p=new URLSearchParams(window.location.search);["movSitioIds","movLoteIds","movDe","movAte","movDesfeitas","movPagina"].forEach(k=>p.delete(k));sitiosHistorico.forEach(id=>p.append("movSitioIds",id));lotesHistorico.forEach(id=>p.append("movLoteIds",id));if(paginaHistorico>1)p.set("movPagina",String(paginaHistorico));if(!mostrarDesfeitas)p.set("movDesfeitas","false");if(dataDeHistorico)p.set("movDe",dataDeHistorico);if(dataAteHistorico)p.set("movAte",dataAteHistorico);window.history.replaceState(window.history.state,"",`${window.location.pathname}${p.size?`?${p}`:""}${window.location.hash}`);},[sitiosHistorico,lotesHistorico,dataDeHistorico,dataAteHistorico,mostrarDesfeitas,paginaHistorico]);
  useEffect(()=>{const restaurar=()=>{const p=new URLSearchParams(window.location.search);setSitiosHistorico(p.getAll("movSitioIds"));setLotesHistorico(p.getAll("movLoteIds"));setDataDeHistorico(p.get("movDe")??"");setDataAteHistorico(p.get("movAte")??"");setMostrarDesfeitas(p.get("movDesfeitas")!=="false");setPaginaHistorico(Math.max(1,Math.floor(Number(p.get("movPagina"))||1)));};window.addEventListener("popstate",restaurar);return()=>window.removeEventListener("popstate",restaurar);},[]);
  const carregarLotes = useCallback(() => listarLotes({ incluirInativos: mostrarInativos }).then(setLotes).catch((e) => setErro(e.message)), [mostrarInativos]);

  useEffect(() => { void carregarLotes(); }, [carregarLotes]);

  /** Recarrega as duas seções — usado depois de mover animais ou desfazer uma movimentação. */
  const recarregarAmbos = useCallback(async () => {
    setHistoricoRefresh((t) => t + 1);
    await carregarLotes();
  }, [carregarLotes]);
  const aoMovimentar = useAoMovimentarComToast(recarregarAmbos);

  const executar = async (acao: () => Promise<unknown>) => {
    if (emCurso.current) return;
    emCurso.current = true; setProcessando(true); setErro(null);
    try { await acao(); await carregarLotes(); }
    catch (e) { setConfirmando(null); setErro(e instanceof Error ? e.message : String(e)); }
    finally { emCurso.current = false; setProcessando(false); }
  };

  const abrirNovo = () => { if (!emCurso.current) setPainel({ modo: "novo" }); };
  const editar = (l: Lote) => { if (!emCurso.current) setPainel({ modo: "editar", id: l.id }); };

  const alternar = (l: Lote) => { if (emCurso.current) return; if (l.ativo) { setConfirmando(l); return; } void executar(() => editarLote(l.id, { ativo: true })); };

  const confirmarDesativacao = () => {
    if (!confirmando) return;
    void executar(async () => { await editarLote(confirmando.id, { ativo: false }); setConfirmando(null); });
  };

  const aoSalvar = async () => { setPainel(null); await carregarLotes(); };

  const loteSelecionado = painel?.modo === "editar" ? (lotes ?? []).find((l) => l.id === painel.id) ?? null : null;
  /* key força remount do formulário a cada abertura, zerando o estado local */
  const chavePainel = painel ? (painel.modo === "editar" ? `editar-${painel.id}` : "novo") : "fechado";

  const sitiosAtivos = sitios.data.filter((s) => s.ativo);
  const edicaoLotes = useRascunhoConsulta({busca,sitio:filtroSitio,inativos:mostrarInativos},{busca:"",sitio:"",inativos:false},v=>{setBusca(v.busca);setFiltroSitio(v.sitio);setMostrarInativos(v.inativos);setPaginaLotes(1);});
  const camposLotes: CampoConsulta[] = [
    {chave:"lote", naBarra: true,ativo:!!busca,limpar:()=>edicaoLotes.editar("busca",""),conteudo:<CampoFiltro rotulo="Lote ou sítio"><input aria-label="Buscar lote no filtro" className="w-full rounded-lg border border-border px-3" value={edicaoLotes.rascunho.busca} onChange={e=>edicaoLotes.editar("busca",e.target.value)}/></CampoFiltro>},
    ...(sitioGlobal == null ? [{chave:"sitio",ativo:!!filtroSitio,limpar:()=>edicaoLotes.editar("sitio",""),conteudo:<CampoFiltro rotulo="Sítio"><SelectCampo aria-label="Filtrar por sítio" value={edicaoLotes.rascunho.sitio} onValueChange={v=>edicaoLotes.editar("sitio",v)}><option value="">Todos os sítios</option>{sitiosAtivos.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}</SelectCampo></CampoFiltro>}] : []),
    {chave:"situacao",ativo:mostrarInativos,limpar:()=>edicaoLotes.editar("inativos",false),conteudo:<label className="flex items-center gap-2 text-sm"><Checkbox checked={edicaoLotes.rascunho.inativos} onCheckedChange={v=>edicaoLotes.editar("inativos",v===true)}/>Mostrar inativos</label>},
  ];
  const ordemLotes = useOrdenacaoTabela<Lote>([{chave:"nome",rotulo:"Lote",tipo:"texto",obter:l=>l.nome},{chave:"animais",rotulo:"Animais ativos",tipo:"numero",obter:l=>l.animaisAtivos}], "ordemLotes", ()=>setPaginaLotes(1));
  const lotesBase = (lotes ?? []).filter(l => (!filtroSitio || String(l.propriedadeId) === filtroSitio) && `${l.nome} ${l.propriedade.nome}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")));
  const lotesFiltrados = ordemLotes.ordenar(lotesBase);
  const totalPaginasLotes = Math.max(1, Math.ceil(lotesFiltrados.length / LOTES_POR_PAGINA));
  const paginaLotesAtual = Math.min(paginaLotes, totalPaginasLotes);
  const lotesDaPagina = lotesFiltrados.slice((paginaLotesAtual - 1) * LOTES_POR_PAGINA, paginaLotesAtual * LOTES_POR_PAGINA);
  useEffect(() => { if (lotes !== null) setPaginaLotes((pagina) => Math.min(pagina, totalPaginasLotes)); }, [totalPaginasLotes, lotes]);
  /* pré-seleciona o sítio ativo no seletor global (comPropriedade), quando houver, na criação de lote */
  const camposHistorico: CampoConsulta[] = [{chave:"origem",colunas:["origem","destino","situacao"],ativo:!!sitiosHistorico.length||!!lotesHistorico.length||mostrarDesfeitas,limpar:edicaoHistorico.limpar,conteudo: <div className="filtros-modal-grade"><MultiSelect compacto label="Sítios da movimentação" contentClassName="z-[1300]" options={sitiosAtivos.map(s=>({value:String(s.id),label:s.nome}))} value={edicaoHistorico.rascunho.sitios} onValueChange={v=>{edicaoHistorico.editar("sitios",v);edicaoHistorico.editar("lotes",[]);}}/><MultiSelect compacto label="Lotes da movimentação" contentClassName="z-[1300]" options={lotesDoSitioHistorico.map(l=>({value:l.id,label:l.nome}))} value={edicaoHistorico.rascunho.lotes} onValueChange={v=>edicaoHistorico.editar("lotes",v)}/><label className="flex items-center gap-2"><input type="checkbox" checked={edicaoHistorico.rascunho.desfeitas} onChange={e=>edicaoHistorico.editar("desfeitas",e.target.checked)}/>Incluir desfeitas</label></div>}];
  const propriedadeInicial = getPropriedadeAtiva() ?? sitiosAtivos[0]?.id ?? null;

  return <PaginaFinanceira>
    <PageHeader titulo={<span className="rotina-titulo"><span><Layers aria-hidden/></span>Lotes</span>} acao={podeLancar ? <Button onClick={abrirNovo}><Plus size={16} /> Novo lote</Button> : undefined} />
    <NavRebanho ativa="lotes" />
    <ErrorBox erro={erro} />

    <Panel className="mt-5 overflow-hidden">
      {/* filtros ficam fora do fieldset de escrita — quem só pode ver continua podendo filtrar (K7) */}
      <BarraConsulta ordenacao={ordemLotes.controle} campos={camposLotes} edicaoFiltros={edicaoLotes} criterios={[...(filtroSitio?[{id:"sitio",rotulo:`Sítio: ${sitiosAtivos.find(s=>String(s.id)===filtroSitio)?.nome ?? "Selecionado"}`,limpar:()=>{setFiltroSitio("");setPaginaLotes(1);}}]:[]),...(mostrarInativos?[{id:"inativos",rotulo:"Inclui inativos",limpar:()=>{setMostrarInativos(false);setPaginaLotes(1);}}]:[])]} acao={podeLancar ? <div className="flex flex-wrap gap-2">
      <Button secondary onClick={() => setSelecionandoAnimais(true)}><ArrowRightLeft size={16} /> Movimentar animais</Button>
    </div> : undefined}>
        <BuscaLista rotulo="Buscar lote" placeholder="Buscar lote ou sítio" valor={busca} onChange={valor => { setBusca(valor); setPaginaLotes(1); }} />
      </BarraConsulta>
      <div className="consulta-visual-barra"><span>{lotesFiltrados.length} lotes no recorte</span><AlternarVisualizacaoConsulta rotulo="Visualização dos lotes" {...visual}/></div>
      <fieldset disabled={processando} aria-busy={processando} className="min-w-0">
        {lotes === null
          ? <div className="p-6"><Loader label="Carregando lotes" /></div>
          : visual.modo === "visual" ? <CartoesLotes lotes={lotesDaPagina} todos={lotesFiltrados} onAbrir={onAbrirLote} acoes={l=>podeLancar?<AcoesLinha nome={l.nome} ativo={l.ativo} onEditar={()=>editar(l)} onAlternar={()=>alternar(l)}/>:null}/> : <TabelaFinanceira ordenacao={ordemLotes.controle} filtrosColunas={filtrosDasColunas(camposLotes,edicaoLotes)} rotulo="Lotes" itens={lotesDaPagina} colunas={colunasLotes(editar, alternar).filter(c=>podeLancar||!c.acoes)} chaveDe={(l) => l.id} onAbrir={(l) => onAbrirLote(l.id)} classeLinha={(l) => !l.ativo ? "opacity-55" : ""} />}
      </fieldset>
      {lotes !== null && <Paginacao paginaAtual={paginaLotesAtual} totalPaginas={totalPaginasLotes} totalItens={lotesFiltrados.length} itensPorPagina={LOTES_POR_PAGINA} onPaginaChange={setPaginaLotes} rotulo="lotes" idSelect="pagina-lista-lotes" />}
    </Panel>



    <Panel className="mt-5 overflow-hidden">
      <div className="border-b border-border p-5"><h2 className="font-serif text-xl">Histórico de movimentações</h2></div>
      <BarraConsulta campos={camposHistorico} edicaoFiltros={edicaoHistorico}><DateRangePicker value={{start:dataValida(dataDeHistorico)?dateFromIso(dataDeHistorico):null,end:dataValida(dataAteHistorico)?dateFromIso(dataAteHistorico):null}} onChange={r=>{setPaginaHistorico(1);setDataDeHistorico(r.start?isoDate(r.start):"");setDataAteHistorico(r.end?isoDate(r.end):"");}} triggerAriaLabel="Período das movimentações" triggerLabel={!dataDeHistorico&&!dataAteHistorico?"Todo o histórico":undefined}/></BarraConsulta>
      {(sitiosHistorico.length>0||lotesHistorico.length>0)&&<div className="flex flex-wrap gap-2 p-4 border-b border-border">{sitiosHistorico.map(id=><Button secondary key={id} onClick={()=>{setPaginaHistorico(1);setSitiosHistorico(v=>v.filter(x=>x!==id));setLotesHistorico([]);}}>Sítio: {sitiosAtivos.find(s=>String(s.id)===id)?.nome??"Selecionado"} ×</Button>)}{lotesHistorico.map(id=><Button secondary key={id} onClick={()=>{setPaginaHistorico(1);setLotesHistorico(v=>v.filter(x=>x!==id));}}>Lote: {catalogos?.lotes.find(l=>l.id===id)?.nome??"Selecionado"} ×</Button>)}</div>}

      <HistoricoMovimentacoes filtrosColunas={filtrosDasColunas(camposHistorico,edicaoHistorico)}
        paginaControlada={paginaHistorico}
        onPaginaChange={setPaginaHistorico}
        carregar={carregarHistorico}
        podeLancar={podeLancar}
        recarregarToken={recarregarTokenHistorico}
        onAbrir={(mov) => setMovimentacaoAbertaId(mov.id)}
        onMudou={() => void recarregarAmbos()}
      />
    </Panel>

    {painel && <FormLote key={chavePainel} lote={loteSelecionado} propriedades={sitiosAtivos} propriedadeInicialId={propriedadeInicial} onSalvo={aoSalvar} onFechar={() => setPainel(null)} />}

    <ConfirmDialog
      open={confirmando !== null}
      title={confirmando ? `Desativar ${confirmando.nome}?` : ""}
      message={confirmando ? mensagemDesativar(confirmando) : ""}
      confirmLabel="Desativar"
      cancelLabel="Manter ativo"
      tone="danger"
      processando={processando}
      onConfirm={confirmarDesativacao}
      onCancel={() => setConfirmando(null)}
    />

    {selecionandoAnimais && <SeletorAnimais
      onCancelar={() => setSelecionandoAnimais(false)}
      onConfirmar={(animais) => { setSelecionandoAnimais(false); setMovimentando(animais); }}
    />}
    {movimentando && catalogos && <FormMovimentar
      animais={movimentando}
      propriedades={catalogos.propriedades}
      lotes={catalogos.lotes}
      onFechar={() => setMovimentando(null)}
      onSalvo={async (resultado) => { setMovimentando(null); await aoMovimentar(resultado); }}
    />}

    {movimentacaoAbertaId && <DetalheMovimentacao
      id={movimentacaoAbertaId}
      podeLancar={podeLancar}
      onFechar={() => setMovimentacaoAbertaId(null)}
      onMudou={() => void recarregarAmbos()}
    />}
  </PaginaFinanceira>;
}
