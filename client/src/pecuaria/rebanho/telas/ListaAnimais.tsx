// Lista de animais — BarraFiltros + TabelaFinanceira + Paginacao (servidor),
// no padrão de OperacoesFinanceiras.tsx. Seleção múltipla habilita
// "Movimentar N animais"; ações de linha são Editar e Movimentar.

import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Pencil, Plus, Search } from "lucide-react";
import { listarAnimais, buscarFichaAnimal, listarCategorias, obterCatalogos, RebanhoApiError } from "../api";
import type { AnimalFicha, AnimalResumo, Aptidao, CategoriaDTO, Catalogos, PapelReprodutivo, Situacao } from "../types";
import { formatarDataBR, formatarIdade, rotuloAptidao, rotuloOpcaoCategoria, rotuloPapelReprodutivo, rotuloSituacao } from "../lib/rotulos";
import { BarraFiltros, CategoriaPill, Paginacao } from "../ui";
import { FormDadosAnimal } from "../forms/FormDadosAnimal";
import { FormMovimentar } from "../forms/FormMovimentar";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { navegarPara } from "../../../router";
import { Button, type ColunaTabela, Empty, ErrorBox, PageHeader, PaginaCarregando, PaginaFinanceira, Panel, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { NavRebanho } from "./NavRebanho";

const ITENS_POR_PAGINA = 20;

function pillSituacao(situacao: Situacao) {
  return <Pill tone={situacao === "ATIVO" ? "green" : "neutral"}>{rotuloSituacao(situacao)}</Pill>;
}

export function ListaAnimais({ onAbrirAnimal, onNovoAnimal, podeLancar = true }: { onAbrirAnimal: (id: string) => void; onNovoAnimal: () => void; podeLancar?: boolean }) {
  const sitioGlobal = useMemo(() => getPropriedadeAtiva(), []);
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [categorias, setCategorias] = useState<CategoriaDTO[]>([]);
  const [itens, setItens] = useState<AnimalResumo[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [revisao, setRevisao] = useState(0);

  const [textoBusca, setTextoBusca] = useState("");
  const [busca, setBusca] = useState("");
  const [propriedadeId, setPropriedadeId] = useState<string>(sitioGlobal != null ? String(sitioGlobal) : "");
  const [loteId, setLoteId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [aptidao, setAptidao] = useState<Aptidao | "">("");
  const [papelReprodutivo, setPapelReprodutivo] = useState<PapelReprodutivo | "">("");
  const [situacao, setSituacao] = useState<Situacao | "TODOS">("ATIVO");
  const [pagina, setPagina] = useState(1);

  const [selecionados, setSelecionados] = useState<Map<string, AnimalResumo>>(new Map());
  const [editando, setEditando] = useState<AnimalFicha | null>(null);
  const [carregandoEdicaoId, setCarregandoEdicaoId] = useState<string | null>(null);
  const [movimentando, setMovimentando] = useState<{ animais: AnimalResumo[]; propriedadeId?: number | null; loteId?: string | null } | null>(null);

  useEffect(() => { obterCatalogos().then(setCatalogos).catch((e) => setErro(e instanceof Error ? e.message : String(e))); }, []);
  useEffect(() => { listarCategorias().then((r) => setCategorias(r.itens)).catch(() => undefined); }, []);

  useEffect(() => {
    let vigente = true;
    setCarregando(true); setErro(null);
    listarAnimais({
      busca: busca.trim() || undefined,
      propriedadeId: propriedadeId ? Number(propriedadeId) : undefined,
      loteId: loteId || undefined,
      categoriaId: categoriaId || undefined,
      aptidao: aptidao || undefined,
      papelReprodutivo: papelReprodutivo || undefined,
      situacao,
      page: pagina,
      pageSize: ITENS_POR_PAGINA,
    })
      .then((resultado) => { if (vigente) { setItens(resultado.itens); setTotal(resultado.total); } })
      .catch((e) => { if (vigente) setErro(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (vigente) setCarregando(false); });
    return () => { vigente = false; };
  }, [busca, propriedadeId, loteId, categoriaId, aptidao, papelReprodutivo, situacao, pagina, revisao]);

  // busca só dispara depois de 300 ms sem digitar
  useEffect(() => {
    const t = setTimeout(() => { if (textoBusca !== busca) { setBusca(textoBusca); setPagina(1); setSelecionados(new Map()); } }, 300);
    return () => clearTimeout(t);
  }, [textoBusca, busca]);

  /** Troca um filtro e volta para a página 1 no mesmo render — uma única busca. */
  const filtrar = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPagina(1); setSelecionados(new Map()); };

  const totalPaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA));
  const lotesDoSitio = useMemo(() => catalogos?.lotes.filter((lote) => !propriedadeId || String(lote.propriedadeId) === propriedadeId) ?? [], [catalogos, propriedadeId]);

  const alternarSelecao = (animal: AnimalResumo) => setSelecionados((atual) => { const novo = new Map(atual); if (novo.has(animal.id)) novo.delete(animal.id); else novo.set(animal.id, animal); return novo; });
  const todosDaPaginaSelecionados = itens.length > 0 && itens.every((item) => selecionados.has(item.id));
  const alternarSelecaoTodos = () => setSelecionados((atual) => {
    const novo = new Map(atual);
    if (todosDaPaginaSelecionados) itens.forEach((item) => novo.delete(item.id));
    else itens.forEach((item) => novo.set(item.id, item));
    return novo;
  });

  const editar = async (id: string) => {
    setCarregandoEdicaoId(id); setErro(null);
    try { setEditando(await buscarFichaAnimal(id)); }
    catch (e) { setErro(e instanceof RebanhoApiError ? e.message : e instanceof Error ? e.message : String(e)); }
    finally { setCarregandoEdicaoId(null); }
  };
  const recarregar = async () => { setRevisao((v) => v + 1); };

  const COLUNAS_TODAS: ColunaTabela<AnimalResumo>[] = [
    { chave: "selecionar", titulo: "", larguraMinima: 44, acoes: true, celula: (item) => <label className="flex items-center" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Selecionar ${item.brinco}`} checked={selecionados.has(item.id)} onChange={() => alternarSelecao(item)} /></label> },
    { chave: "brinco", titulo: "Brinco", larguraMinima: 140, principal: true, celula: (item) => <><strong className="break-words">{item.brinco}</strong>{item.nome && <div className="mt-1 text-xs text-ink-3">{item.nome}</div>}</> },
    { chave: "categoria", titulo: "Categoria", larguraMinima: 110, celula: (item) => <CategoriaPill categoria={item.categoria} categoriaOrigem={item.categoriaOrigem} categoriaCalculada={item.categoriaCalculada} /> },
    { chave: "idade", titulo: "Idade", larguraMinima: 90, celula: (item) => formatarIdade(item.idadeMeses) },
    { chave: "sitio", titulo: "Sítio", larguraMinima: 140, celula: (item) => item.propriedade?.nome ?? "—" },
    { chave: "lote", titulo: "Lote", larguraMinima: 120, celula: (item) => item.lote
      ? <button type="button" onClick={(e) => { e.stopPropagation(); navegarPara(`/pecuaria/rebanho/lotes/${item.lote!.id}`); }} className="break-words font-semibold text-mast hover:underline">{item.lote.nome}</button>
      : "—" },
    { chave: "aptidao", titulo: "Aptidão", larguraMinima: 100, celula: (item) => item.aptidao ? <Pill tone="brown">{rotuloAptidao(item.aptidao)}</Pill> : "—" },
    { chave: "papel", titulo: "Papel", larguraMinima: 110, celula: (item) => item.papelReprodutivo && item.papelReprodutivo !== "NENHUM" ? <Pill tone="amber">{rotuloPapelReprodutivo(item.papelReprodutivo)}</Pill> : "—" },
    { chave: "peso", titulo: "Último peso", larguraMinima: 130, celula: (item) => item.ultimoPeso ? <>{item.ultimoPeso.kg.toLocaleString("pt-BR")} kg<div className="text-xs text-ink-3">{formatarDataBR(item.ultimoPeso.data)}</div></> : "—" },
    { chave: "situacao", titulo: "Situação", larguraMinima: 110, celula: (item) => pillSituacao(item.situacao) },
    { chave: "acoes", titulo: "Ações", alinhamento: "direita", larguraMinima: 96, acoes: true, celula: (item) => <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-50" aria-label={`Editar ${item.brinco}`} title="Editar dados" disabled={carregandoEdicaoId === item.id} onClick={() => { void editar(item.id); }}><Pencil size={16} /></button>
      <button type="button" className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label={`Movimentar ${item.brinco}`} title="Movimentar" onClick={() => setMovimentando({ animais: [item], propriedadeId: item.propriedade?.id, loteId: item.lote?.id })}><ArrowRightLeft size={16} /></button>
    </div> },
  ];
  // sem permissão de lançar: sem seleção em massa e sem ações de linha
  const COLUNAS = podeLancar ? COLUNAS_TODAS : COLUNAS_TODAS.filter((c) => c.chave !== "selecionar" && c.chave !== "acoes");

  if (carregando && !itens.length && !erro) return <PaginaCarregando label="Carregando animais" />;

  return <PaginaFinanceira>
    <PageHeader eyebrow="Pecuária" titulo="Animais" descricao="Busca, filtros e movimentação em massa sobre o rebanho." acao={podeLancar ? <Button onClick={onNovoAnimal}><Plus size={16} /> Novo animal</Button> : undefined} />
    <NavRebanho ativa="animais" />
    <ErrorBox erro={erro} />
    <Panel className="mt-6 overflow-clip">
      <BarraFiltros>
        <label className="relative w-full min-w-0 flex-[1_1_240px] sm:w-auto"><Search size={16} className="absolute left-3 top-3 text-ink-3" /><input aria-label="Buscar por brinco ou nome" value={textoBusca} onChange={(e) => setTextoBusca(e.target.value)} placeholder="Buscar por brinco ou nome" className="h-[42px] w-full rounded-lg border border-border bg-white py-2.5 pl-9 pr-3 text-sm" /></label>
        {sitioGlobal == null && <select aria-label="Filtrar por sítio" value={propriedadeId} onChange={(e) => { filtrar(setPropriedadeId)(e.target.value); setLoteId(""); }} className="h-[42px] w-full min-w-0 flex-[1_1_160px] rounded-lg border border-border bg-white px-3 text-sm sm:w-auto"><option value="">Todos os sítios</option>{catalogos?.propriedades.map((prop) => <option key={prop.id} value={prop.id}>{prop.apelido ?? prop.nome}</option>)}</select>}
        <select aria-label="Filtrar por lote" value={loteId} onChange={(e) => filtrar(setLoteId)(e.target.value)} className="h-[42px] w-full min-w-0 flex-[1_1_150px] rounded-lg border border-border bg-white px-3 text-sm sm:w-auto"><option value="">Todos os lotes</option>{lotesDoSitio.map((lote) => <option key={lote.id} value={lote.id}>{lote.nome}</option>)}</select>
        <select aria-label="Filtrar por categoria" value={categoriaId} onChange={(e) => filtrar(setCategoriaId)(e.target.value)} className="h-[42px] w-full min-w-0 flex-[1_1_150px] rounded-lg border border-border bg-white px-3 text-sm sm:w-auto"><option value="">Todas as categorias</option>{categorias.map((c) => <option key={c.id} value={c.id}>{rotuloOpcaoCategoria(categorias, c)}</option>)}</select>
        <select aria-label="Filtrar por aptidão" value={aptidao} onChange={(e) => filtrar(setAptidao)(e.target.value as Aptidao | "")} className="h-[42px] w-full min-w-0 flex-[1_1_130px] rounded-lg border border-border bg-white px-3 text-sm sm:w-auto"><option value="">Todas as aptidões</option><option value="LEITE">Leite</option><option value="CORTE">Corte</option></select>
        <select aria-label="Filtrar por papel reprodutivo" value={papelReprodutivo} onChange={(e) => filtrar(setPapelReprodutivo)(e.target.value as PapelReprodutivo | "")} className="h-[42px] w-full min-w-0 flex-[1_1_150px] rounded-lg border border-border bg-white px-3 text-sm sm:w-auto"><option value="">Todos os papéis</option><option value="NENHUM">Nenhum</option><option value="RECEPTORA">Receptora</option><option value="DOADORA">Doadora</option></select>
        <select aria-label="Filtrar por situação" value={situacao} onChange={(e) => filtrar(setSituacao)(e.target.value as Situacao | "TODOS")} className="h-[42px] w-full min-w-0 flex-[1_1_130px] rounded-lg border border-border bg-white px-3 text-sm sm:w-auto"><option value="ATIVO">Ativos</option><option value="BAIXADO">Baixados</option><option value="TODOS">Todas as situações</option></select>
      </BarraFiltros>
      {podeLancar && itens.length > 0 && <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-2 px-4 py-2.5 text-sm">
        <label className="flex items-center gap-2 font-medium"><input type="checkbox" aria-label="Selecionar todos os animais desta página" checked={todosDaPaginaSelecionados} onChange={alternarSelecaoTodos} /> Selecionar todos</label>
        {selecionados.size > 0 && <><span className="text-ink-3">{selecionados.size} selecionado{selecionados.size === 1 ? "" : "s"}</span><Button secondary onClick={() => setSelecionados(new Map())}>Limpar seleção</Button><Button onClick={() => setMovimentando({ animais: [...selecionados.values()] })}>Movimentar {selecionados.size} {selecionados.size === 1 ? "animal" : "animais"}</Button></>}
      </div>}
      {erro && !itens.length ? <Empty>Não foi possível carregar os animais.</Empty> : itens.length ? <>
        <TabelaFinanceira rotulo="Animais" itens={itens} colunas={COLUNAS} chaveDe={(item) => item.id} onAbrir={(item) => onAbrirAnimal(item.id)} barraRolagemSuperior />
        <Paginacao paginaAtual={pagina} totalPaginas={totalPaginas} totalItens={total} itensPorPagina={ITENS_POR_PAGINA} onPaginaChange={setPagina} rotulo="animais" idSelect="pagina-animais" />
      </> : <Empty>Nenhum animal encontrado com os filtros selecionados.</Empty>}
    </Panel>

    {editando && <FormDadosAnimal animal={editando} onFechar={() => setEditando(null)} onSalvo={async () => { setEditando(null); await recarregar(); }} />}
    {movimentando && catalogos && <FormMovimentar animais={movimentando.animais} propriedades={catalogos.propriedades} lotes={catalogos.lotes} propriedadeInicial={movimentando.propriedadeId} loteInicial={movimentando.loteId} onFechar={() => setMovimentando(null)} onSalvo={async () => { setMovimentando(null); setSelecionados(new Map()); await recarregar(); }} />}
  </PaginaFinanceira>;
}
