// Lista de lotes — duas seções empilhadas (Lotes · Histórico de movimentações),
// no padrão das seções de DetalheLote.tsx (Panel com cabeçalho <h2 className=
// "font-serif text-xl">). Antes eram sub-abas; agora o histórico fica sempre
// visível, então mover/desfazer precisa recarregar as duas seções.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, Plus } from "lucide-react";
import { MultiSelect } from "../../../components/MultiSelect";
import { dataValida } from "../reproducao/periodo-consulta";
import { DateRangePicker, dateFromIso, isoDate } from "../../../components/DateRangePicker";
import { DialogFinanceiro } from "../../../financeiro/DialogFinanceiro";
import { SlidersHorizontal } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Loader } from "@/components/Loading";
import { usePropriedades } from "../../../api/propriedades";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { AcoesLinha, Button, type ColunaTabela, ErrorBox, PageHeader, PaginaFinanceira, Panel, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { BarraFiltros, useAoMovimentarComToast } from "../ui";
import { NavRebanho } from "./NavRebanho";
import { editarLote, listarLotes, listarMovimentacoes, obterCatalogos } from "../api";
import type { AnimalResumo, Catalogos, Lote } from "../types";
import { FormLote } from "../cadastros/FormLote";
import { FormMovimentar } from "../forms/FormMovimentar";
import { SeletorAnimais } from "../components/SeletorAnimais";
import { HistoricoMovimentacoes } from "../components/HistoricoMovimentacoes";
import { DetalheMovimentacao } from "../components/DetalheMovimentacao";

type Painel = { modo: "novo" } | { modo: "editar"; id: string } | null;

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
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [filtroSitio, setFiltroSitio] = useState("");
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

  // ---------- histórico ----------
  const [sitiosHistorico, setSitiosHistorico] = useState<string[]>(()=>new URLSearchParams(window.location.search).getAll("movSitioIds"));
  const [lotesHistorico, setLotesHistorico] = useState<string[]>(()=>new URLSearchParams(window.location.search).getAll("movLoteIds"));
  const [filtrosHistoricoAbertos,setFiltrosHistoricoAbertos]=useState(false);
  const [dataDeHistorico, setDataDeHistorico] = useState(()=>new URLSearchParams(window.location.search).get("movDe")??"");
  const [dataAteHistorico, setDataAteHistorico] = useState(()=>new URLSearchParams(window.location.search).get("movAte")??"");
  const [mostrarDesfeitas, setMostrarDesfeitas] = useState(()=>new URLSearchParams(window.location.search).get("movDesfeitas")!=="false");
  /* bump manual: um desfazer/mover feito de dentro de DetalheMovimentacao ou do formulário
   * de movimentação não passa pelo próprio HistoricoMovimentacoes, então precisa forçar o
   * recarregamento por fora */
  const [paginaHistorico,setPaginaHistorico]=useState(()=>Math.max(1,Math.floor(Number(new URLSearchParams(window.location.search).get("movPagina"))||1)));
  const [historicoRefresh, setHistoricoRefresh] = useState(0);
  const [movimentacaoAbertaId, setMovimentacaoAbertaId] = useState<string | null>(null);

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
    () => (catalogos?.lotes ?? []).filter((lote) => sitiosHistorico.length ? sitiosHistorico.includes(String(lote.propriedadeId)) : true),
    [catalogos, sitiosHistorico],
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
  const lotesFiltrados = filtroSitio ? (lotes ?? []).filter((l) => String(l.propriedadeId) === filtroSitio) : lotes ?? [];
  /* pré-seleciona o sítio ativo no seletor global (comPropriedade), quando houver, na criação de lote */
  const propriedadeInicial = getPropriedadeAtiva() ?? sitiosAtivos[0]?.id ?? null;

  return <PaginaFinanceira>
    <PageHeader eyebrow="" titulo="Lotes" descricao="Grupos de animais por sítio, usados na movimentação e nos filtros do rebanho." acao={podeLancar ? <div className="flex flex-wrap gap-2">
      <Button secondary onClick={() => setSelecionandoAnimais(true)}><ArrowRightLeft size={16} /> Movimentar animais</Button>
      <Button onClick={abrirNovo}><Plus size={16} /> Novo lote</Button>
    </div> : undefined} />
    <NavRebanho ativa="lotes" />
    <ErrorBox erro={erro} />

    <Panel className="mt-5 overflow-hidden">
      <div className="border-b border-border p-5"><h2 className="font-serif text-xl">Lotes</h2></div>
      {/* filtros ficam fora do fieldset de escrita — quem só pode ver continua podendo filtrar (K7) */}
      <BarraFiltros>
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" disabled={processando} checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />Mostrar inativos</label>
        <label className="flex items-center gap-2 text-sm font-medium">Sítio
          <select aria-label="Filtrar por sítio" disabled={processando} value={filtroSitio} onChange={(e) => setFiltroSitio(e.target.value)} className="rounded-lg border border-border bg-white p-2 text-sm font-normal">
            <option value="">Todos</option>
            {sitiosAtivos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </label>
      </BarraFiltros>
      <fieldset disabled={processando || !podeLancar} aria-busy={processando} className="min-w-0">
        {lotes === null
          ? <div className="p-6"><Loader label="Carregando lotes" /></div>
          : <TabelaFinanceira rotulo="Lotes" itens={lotesFiltrados} colunas={colunasLotes(editar, alternar)} chaveDe={(l) => l.id} onAbrir={(l) => onAbrirLote(l.id)} classeLinha={(l) => !l.ativo ? "opacity-55" : ""} />}
      </fieldset>
    </Panel>

    <Panel className="mt-5 overflow-hidden">
      <div className="border-b border-border p-5"><h2 className="font-serif text-xl">Histórico de movimentações</h2></div>
      <BarraFiltros><DateRangePicker value={{start:dataValida(dataDeHistorico)?dateFromIso(dataDeHistorico):null,end:dataValida(dataAteHistorico)?dateFromIso(dataAteHistorico):null}} onChange={r=>{setPaginaHistorico(1);setDataDeHistorico(r.start?isoDate(r.start):"");setDataAteHistorico(r.end?isoDate(r.end):"");}} triggerAriaLabel="Período das movimentações" triggerLabel={!dataDeHistorico&&!dataAteHistorico?"Todo o histórico":undefined}/><Button secondary onClick={()=>setFiltrosHistoricoAbertos(true)}><SlidersHorizontal size={16}/>Filtros</Button></BarraFiltros>
      {(sitiosHistorico.length>0||lotesHistorico.length>0)&&<div className="flex flex-wrap gap-2 p-4 border-b border-border">{sitiosHistorico.map(id=><Button secondary key={id} onClick={()=>{setPaginaHistorico(1);setSitiosHistorico(v=>v.filter(x=>x!==id));setLotesHistorico([]);}}>Sítio: {sitiosAtivos.find(s=>String(s.id)===id)?.nome??"Selecionado"} ×</Button>)}{lotesHistorico.map(id=><Button secondary key={id} onClick={()=>{setPaginaHistorico(1);setLotesHistorico(v=>v.filter(x=>x!==id));}}>Lote: {catalogos?.lotes.find(l=>l.id===id)?.nome??"Selecionado"} ×</Button>)}</div>}
      {filtrosHistoricoAbertos&&<DialogFinanceiro titulo="Filtrar movimentações" eyebrow="Rebanho" onClose={()=>setFiltrosHistoricoAbertos(false)} rodape={<Button onClick={()=>setFiltrosHistoricoAbertos(false)}>Concluir</Button>}><div className="grid gap-5 p-5"><MultiSelect compacto label="Sítios da movimentação" contentClassName="z-[1300]" options={sitiosAtivos.map(s=>({value:String(s.id),label:s.nome}))} value={sitiosHistorico} onValueChange={v=>{setPaginaHistorico(1);setSitiosHistorico(v);setLotesHistorico([]);}}/><MultiSelect compacto label="Lotes da movimentação" contentClassName="z-[1300]" options={lotesDoSitioHistorico.map(l=>({value:l.id,label:l.nome}))} value={lotesHistorico} onValueChange={v=>{setPaginaHistorico(1);setLotesHistorico(v);}}/><label className="flex items-center gap-2"><input type="checkbox" checked={mostrarDesfeitas} onChange={e=>{setPaginaHistorico(1);setMostrarDesfeitas(e.target.checked);}}/>Incluir desfeitas</label></div></DialogFinanceiro>}
      <HistoricoMovimentacoes
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
