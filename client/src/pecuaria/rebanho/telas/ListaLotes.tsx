// Lista de lotes — BarraFiltros (inativos + sítio) + TabelaFinanceira + form de
// criação/edição, no padrão de ConfiguracoesFinanceiras.tsx (mesmo de onde essa
// tela foi desmembrada, ver Cadastros.tsx). Clicar na linha abre a página do
// lote; o lápis de Ações continua abrindo o formulário de editar.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, Plus } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Loader } from "@/components/Loading";
import { usePropriedades } from "../../../api/propriedades";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { AcoesLinha, Button, type ColunaTabela, ErrorBox, PageHeader, PaginaFinanceira, Panel, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { BarraFiltros, SubAbas } from "../ui";
import { NavRebanho } from "./NavRebanho";
import { editarLote, listarLotes, listarMovimentacoes, obterCatalogos } from "../api";
import type { AnimalResumo, Catalogos, Lote } from "../types";
import { FormLote } from "../cadastros/FormLote";
import { FormMovimentar } from "../forms/FormMovimentar";
import { SeletorAnimais } from "../components/SeletorAnimais";
import { HistoricoMovimentacoes } from "../components/HistoricoMovimentacoes";
import { DetalheMovimentacao } from "../components/DetalheMovimentacao";

type Aba = "lotes" | "historico";
type Painel = { modo: "novo" } | { modo: "editar"; id: string } | null;

const colunasLotes = (editar: (l: Lote) => void, alternar: (l: Lote) => void): ColunaTabela<Lote>[] => [
  { chave: "lote", titulo: "Lote", larguraMinima: 200, principal: true, celula: (l) => <strong className="break-words">{l.nome}</strong> },
  { chave: "sitio", titulo: "Sítio", larguraMinima: 160, celula: (l) => <span className="break-words">{l.propriedade.nome}</span> },
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
  const [aba, setAba] = useState<Aba>("lotes");
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
  const [filtroSitioHistorico, setFiltroSitioHistorico] = useState("");
  const [filtroLoteHistorico, setFiltroLoteHistorico] = useState("");
  const [dataDeHistorico, setDataDeHistorico] = useState("");
  const [dataAteHistorico, setDataAteHistorico] = useState("");
  const [mostrarDesfeitas, setMostrarDesfeitas] = useState(true);
  /* bump manual: um desfazer feito de dentro de DetalheMovimentacao não passa pelo próprio
   * HistoricoMovimentacoes, então precisa forçar o recarregamento por fora */
  const [historicoRefresh, setHistoricoRefresh] = useState(0);
  const [movimentacaoAbertaId, setMovimentacaoAbertaId] = useState<string | null>(null);

  const carregarHistorico = useCallback((pagina: number) => listarMovimentacoes({
    loteId: filtroLoteHistorico || undefined,
    propriedadeId: filtroSitioHistorico ? Number(filtroSitioHistorico) : undefined,
    dataDe: dataDeHistorico || undefined,
    dataAte: dataAteHistorico || undefined,
    incluirDesfeitas: mostrarDesfeitas,
    page: pagina,
    pageSize: 20,
  }), [filtroLoteHistorico, filtroSitioHistorico, dataDeHistorico, dataAteHistorico, mostrarDesfeitas]);

  const recarregarTokenHistorico = `${filtroSitioHistorico}|${filtroLoteHistorico}|${dataDeHistorico}|${dataAteHistorico}|${mostrarDesfeitas}|${historicoRefresh}`;

  const lotesDoSitioHistorico = useMemo(
    () => (catalogos?.lotes ?? []).filter((lote) => !filtroSitioHistorico || String(lote.propriedadeId) === filtroSitioHistorico),
    [catalogos, filtroSitioHistorico],
  );

  const carregarLotes = useCallback(() => listarLotes({ incluirInativos: mostrarInativos }).then(setLotes).catch((e) => setErro(e.message)), [mostrarInativos]);

  useEffect(() => { void carregarLotes(); }, [carregarLotes]);

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
    <PageHeader eyebrow="Pecuária" titulo="Lotes" descricao="Grupos de animais por sítio, usados na movimentação e nos filtros do rebanho." acao={podeLancar && aba === "lotes" ? <div className="flex flex-wrap gap-2">
      <Button secondary onClick={() => setSelecionandoAnimais(true)}><ArrowRightLeft size={16} /> Movimentar animais</Button>
      <Button onClick={abrirNovo}><Plus size={16} /> Novo lote</Button>
    </div> : undefined} />
    <NavRebanho ativa="lotes" />
    <ErrorBox erro={erro} />
    <SubAbas abas={[{ valor: "lotes", rotulo: "Lotes" }, { valor: "historico", rotulo: "Histórico" }]} ativa={aba} onSelecionar={setAba} />

    {aba === "lotes" && <fieldset disabled={processando || !podeLancar} aria-busy={processando} className="min-w-0">
      {lotes === null
        ? <div className="mt-5"><Loader label="Carregando lotes" /></div>
        : <Panel className="mt-5 overflow-hidden">
          <BarraFiltros>
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />Mostrar inativos</label>
            <label className="flex items-center gap-2 text-sm font-medium">Sítio
              <select aria-label="Filtrar por sítio" value={filtroSitio} onChange={(e) => setFiltroSitio(e.target.value)} className="rounded-lg border border-border bg-white p-2 text-sm font-normal">
                <option value="">Todos</option>
                {sitiosAtivos.map((s) => <option key={s.id} value={s.id}>{s.apelido || s.nome}</option>)}
              </select>
            </label>
          </BarraFiltros>
          <TabelaFinanceira rotulo="Lotes" itens={lotesFiltrados} colunas={colunasLotes(editar, alternar)} chaveDe={(l) => l.id} onAbrir={(l) => onAbrirLote(l.id)} classeLinha={(l) => !l.ativo ? "opacity-55" : ""} />
        </Panel>}
    </fieldset>}

    {aba === "historico" && <Panel className="mt-5 overflow-hidden">
      <BarraFiltros>
        <label className="flex items-center gap-2 text-sm font-medium">Sítio
          <select aria-label="Filtrar histórico por sítio" value={filtroSitioHistorico} onChange={(e) => { setFiltroSitioHistorico(e.target.value); setFiltroLoteHistorico(""); }} className="rounded-lg border border-border bg-white p-2 text-sm font-normal">
            <option value="">Todos</option>
            {sitiosAtivos.map((s) => <option key={s.id} value={s.id}>{s.apelido || s.nome}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">Lote
          <select aria-label="Filtrar histórico por lote" value={filtroLoteHistorico} onChange={(e) => setFiltroLoteHistorico(e.target.value)} className="rounded-lg border border-border bg-white p-2 text-sm font-normal">
            <option value="">Todos</option>
            {lotesDoSitioHistorico.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">De
          <input aria-label="Data inicial do histórico" type="date" value={dataDeHistorico} onChange={(e) => setDataDeHistorico(e.target.value)} className="rounded-lg border border-border bg-white p-2 text-sm font-normal" />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">Até
          <input aria-label="Data final do histórico" type="date" value={dataAteHistorico} onChange={(e) => setDataAteHistorico(e.target.value)} className="rounded-lg border border-border bg-white p-2 text-sm font-normal" />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={mostrarDesfeitas} onChange={(e) => setMostrarDesfeitas(e.target.checked)} />Mostrar desfeitas</label>
      </BarraFiltros>
      <HistoricoMovimentacoes
        carregar={carregarHistorico}
        mostrarDirecao={Boolean(filtroLoteHistorico)}
        podeLancar={podeLancar}
        recarregarToken={recarregarTokenHistorico}
        onAbrir={(mov) => setMovimentacaoAbertaId(mov.id)}
        onMudou={() => setHistoricoRefresh((t) => t + 1)}
      />
    </Panel>}

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
      animalIds={movimentando.map((a) => a.id)}
      propriedades={catalogos.propriedades}
      lotes={catalogos.lotes}
      onFechar={() => setMovimentando(null)}
      onSalvo={async () => { setMovimentando(null); await carregarLotes(); }}
    />}

    {movimentacaoAbertaId && <DetalheMovimentacao
      id={movimentacaoAbertaId}
      podeLancar={podeLancar}
      onFechar={() => setMovimentacaoAbertaId(null)}
      onMudou={() => setHistoricoRefresh((t) => t + 1)}
    />}
  </PaginaFinanceira>;
}
