// Seleção de animais em lote, no modelo de trabalho do IDEAGRI: filtros de rebanho,
// reprodução e produção calculados no servidor, lista de brincos digitada ou colada e
// uma lista lateral com o que já foi escolhido. A seleção fica num Map por id, então
// sobrevive à troca de página, de filtros e de modo; só é entregue ao confirmar.

import { useEffect, useMemo, useState } from "react";
import { ListChecks, Search, SlidersHorizontal, X } from "lucide-react";
import { SelectCampo } from "@/financeiro/SelectCampo";
import { MultiSelect } from "@/components/MultiSelect";
import { listarAnimais, listarCategorias, obterCatalogos } from "../api";
import type { Aptidao, AnimalResumo, Catalogos, CategoriaRef, ListarFiltros, SituacaoProdutivaFiltro, SituacaoReprodutivaFiltro } from "../types";
import { BarraFiltros, CategoriaPill, Paginacao } from "../ui";
import { ROTULO_APTIDAO } from "../lib/rotulos";
import { Button, type ColunaTabela, Empty, ErrorBox, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { PainelCadastro, classeInput } from "../../../financeiro/PainelCadastro";
import { Loader } from "../../../components/Loading";

const ITENS_POR_PAGINA = 20;
/** Lote máximo por requisição da API de animais. */
const LOTE_API = 200;
/** "Selecionar todos os encontrados" carrega no máximo este número de animais. */
export const LIMITE_SELECAO_TOTAL = 1000;
const LIMITE_BRINCOS = 500;

export const ROTULO_SITUACAO_REPRODUTIVA: Record<SituacaoReprodutivaFiltro, string> = {
  VAZIA: "Vazia", GESTANTE: "Gestante", AGUARDANDO_DIAGNOSTICO: "Aguardando diagnóstico", APTA: "Apta", DESCONHECIDA: "Desconhecida",
};
export const ROTULO_SITUACAO_PRODUTIVA: Record<SituacaoProdutivaFiltro, string> = {
  LACTANTE: "Lactante", SECA: "Seca", SEM_LACTACAO: "Sem lactação registrada", NAO_INFORMADA: "Não informada",
};
const opcoes = <T extends string>(rotulos: Record<T, string>) => (Object.keys(rotulos) as T[]).map(value => ({ value, label: rotulos[value] }));

/** Separa uma lista digitada/colada em brincos únicos (espaço, vírgula, ponto e vírgula ou linha). */
export function separarBrincos(texto: string): string[] {
  const vistos = new Set<string>();
  return texto.split(/[\s,;]+/).map(b => b.trim()).filter(b => {
    const chave = b.toLowerCase();
    if (!b || vistos.has(chave)) return false;
    vistos.add(chave); return true;
  });
}

type Filtros = {
  propriedadeId: string; loteId: string; categoriaIds: string[]; sexo: "" | "F" | "M"; racaIds: string[]; aptidoes: Aptidao[];
  situacoesReprodutivas: SituacaoReprodutivaFiltro[]; situacoesProdutivas: SituacaoProdutivaFiltro[]; idadeMin: string; idadeMax: string;
};
const FILTROS_VAZIOS: Filtros = { propriedadeId: "", loteId: "", categoriaIds: [], sexo: "", racaIds: [], aptidoes: [], situacoesReprodutivas: [], situacoesProdutivas: [], idadeMin: "", idadeMax: "" };
const quantosAvancados = (f: Filtros) => [f.categoriaIds.length, f.sexo, f.racaIds.length, f.aptidoes.length, f.situacoesReprodutivas.length, f.situacoesProdutivas.length, f.idadeMin, f.idadeMax].filter(Boolean).length;
const mesesOuUndefined = (v: string) => v.trim() === "" || !Number.isFinite(Number(v)) ? undefined : Math.max(0, Math.trunc(Number(v)));

export function SelecaoAnimais({ excluirLoteId, sexo: sexoFixo, titulo = "Selecionar animais", rotuloConfirmar = "Continuar", inicial, onConfirmar, onCancelar }: {
  /** oculta este lote do filtro de origem e exclui da lista os animais que estão nele hoje */
  excluirLoteId?: string;
  /** restringe a seleção a um sexo (o filtro de sexo deixa de ser oferecido) */
  sexo?: "F" | "M";
  titulo?: string;
  rotuloConfirmar?: string;
  /** animais já escolhidos ao abrir */
  inicial?: AnimalResumo[];
  onConfirmar: (animais: AnimalResumo[]) => void;
  onCancelar: () => void;
}) {
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [categorias, setCategorias] = useState<CategoriaRef[]>([]);
  const [modo, setModo] = useState<"filtrar" | "brincos">("filtrar");
  const [itens, setItens] = useState<AnimalResumo[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [textoBusca, setTextoBusca] = useState("");
  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [maisFiltros, setMaisFiltros] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [selecionados, setSelecionados] = useState<Map<string, AnimalResumo>>(() => new Map((inicial ?? []).map(a => [a.id, a])));
  const [carregandoTodos, setCarregandoTodos] = useState(false);
  const [textoBrincos, setTextoBrincos] = useState("");
  const [resolvendoBrincos, setResolvendoBrincos] = useState(false);
  const [retornoBrincos, setRetornoBrincos] = useState<{ adicionados: number; naoEncontrados: string[] } | null>(null);

  useEffect(() => { obterCatalogos().then(setCatalogos).catch((e) => setErro(e instanceof Error ? e.message : String(e))); }, []);
  // categorias só enriquecem o filtro; se falharem, o restante da seleção continua utilizável
  useEffect(() => { listarCategorias().then(r => setCategorias(r.itens.map(c => ({ id: c.id, nome: c.nome })))).catch(() => setCategorias([])); }, []);

  const consulta = useMemo<ListarFiltros>(() => ({
    busca: busca.trim() || undefined,
    propriedadeId: filtros.propriedadeId ? Number(filtros.propriedadeId) : undefined,
    loteId: filtros.loteId || undefined,
    excluirLoteId,
    categoriaIds: filtros.categoriaIds.length ? filtros.categoriaIds : undefined,
    sexo: sexoFixo ?? (filtros.sexo || undefined),
    racaIds: filtros.racaIds.length ? filtros.racaIds : undefined,
    aptidoes: filtros.aptidoes.length ? filtros.aptidoes : undefined,
    situacoesReprodutivas: filtros.situacoesReprodutivas.length ? filtros.situacoesReprodutivas : undefined,
    situacoesProdutivas: filtros.situacoesProdutivas.length ? filtros.situacoesProdutivas : undefined,
    idadeMinMeses: mesesOuUndefined(filtros.idadeMin),
    idadeMaxMeses: mesesOuUndefined(filtros.idadeMax),
    situacao: "ATIVO",
  }), [busca, filtros, excluirLoteId, sexoFixo]);

  useEffect(() => {
    let vigente = true;
    setCarregando(true); setErro(null);
    listarAnimais({ ...consulta, comContexto: true, page: pagina, pageSize: ITENS_POR_PAGINA })
      .then((resultado) => { if (vigente) { setItens(resultado.itens); setTotal(resultado.total); } })
      .catch((e) => { if (vigente) setErro(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (vigente) setCarregando(false); });
    return () => { vigente = false; };
  }, [consulta, pagina]);

  // busca só dispara depois de 300 ms sem digitar
  useEffect(() => {
    const t = setTimeout(() => { if (textoBusca !== busca) { setBusca(textoBusca); setPagina(1); } }, 300);
    return () => clearTimeout(t);
  }, [textoBusca, busca]);

  const totalPaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA));
  const lotesDoSitio = useMemo(
    () => (catalogos?.lotes ?? []).filter((lote) => (!filtros.propriedadeId || String(lote.propriedadeId) === filtros.propriedadeId) && lote.id !== excluirLoteId),
    [catalogos, filtros.propriedadeId, excluirLoteId],
  );
  const editar = <K extends keyof Filtros>(chave: K, valor: Filtros[K]) => { setFiltros(f => ({ ...f, [chave]: valor, ...(chave === "propriedadeId" ? { loteId: "" } : {}) })); setPagina(1); };
  const limparFiltros = () => { setFiltros(FILTROS_VAZIOS); setTextoBusca(""); setBusca(""); setPagina(1); };
  const avancados = quantosAvancados(filtros);
  const algumFiltro = avancados > 0 || !!filtros.propriedadeId || !!filtros.loteId || !!busca.trim();

  const adicionar = (animais: AnimalResumo[]) => setSelecionados(atual => { const novo = new Map(atual); animais.forEach(a => novo.set(a.id, a)); return novo; });
  const remover = (ids: string[]) => setSelecionados(atual => { const novo = new Map(atual); ids.forEach(id => novo.delete(id)); return novo; });
  const alternar = (animal: AnimalResumo) => selecionados.has(animal.id) ? remover([animal.id]) : adicionar([animal]);
  const todosDaPaginaSelecionados = itens.length > 0 && itens.every((a) => selecionados.has(a.id));
  const alternarTodosDaPagina = () => todosDaPaginaSelecionados ? remover(itens.map(a => a.id)) : adicionar(itens);

  async function carregarTodasAsPaginas(filtro: ListarFiltros, limite: number): Promise<AnimalResumo[]> {
    const todos: AnimalResumo[] = [];
    for (let p = 1; ; p++) {
      const r = await listarAnimais({ ...filtro, page: p, pageSize: LOTE_API });
      todos.push(...r.itens);
      if (!r.itens.length || todos.length >= Math.min(r.total, limite)) return todos.slice(0, limite);
    }
  }
  async function selecionarTodosEncontrados() {
    setCarregandoTodos(true); setErro(null);
    try { adicionar(await carregarTodasAsPaginas(consulta, LIMITE_SELECAO_TOTAL)); }
    catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
    finally { setCarregandoTodos(false); }
  }
  async function adicionarBrincos() {
    const brincos = separarBrincos(textoBrincos);
    if (!brincos.length) return;
    if (brincos.length > LIMITE_BRINCOS) { setErro(`Informe no máximo ${LIMITE_BRINCOS} brincos por vez.`); return; }
    setResolvendoBrincos(true); setErro(null); setRetornoBrincos(null);
    try {
      const achados = await carregarTodasAsPaginas({ brincos, excluirLoteId, sexo: sexoFixo, situacao: "ATIVO" }, LIMITE_BRINCOS);
      const encontrados = new Set(achados.map(a => a.brinco.toLowerCase()));
      const naoEncontrados = brincos.filter(b => !encontrados.has(b.toLowerCase()));
      adicionar(achados);
      setRetornoBrincos({ adicionados: achados.length, naoEncontrados });
      setTextoBrincos(naoEncontrados.join("\n"));
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
    finally { setResolvendoBrincos(false); }
  }

  const COLUNAS: ColunaTabela<AnimalResumo>[] = [
    { chave: "selecionar", titulo: "", larguraMinima: 44, acoes: true, celula: (item) => <label className="flex items-center" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Selecionar ${item.brinco}`} checked={selecionados.has(item.id)} onChange={() => alternar(item)} /></label> },
    { chave: "brinco", titulo: "Brinco", larguraMinima: 130, principal: true, celula: (item) => <><strong className="break-words">{item.brinco}</strong>{item.nome && <div className="mt-1 text-sm text-ink-3">{item.nome}</div>}</> },
    { chave: "categoria", titulo: "Categoria", larguraMinima: 110, celula: (item) => <CategoriaPill categoria={item.categoria} categoriaOrigem={item.categoriaOrigem} categoriaCalculada={item.categoriaCalculada} /> },
    { chave: "lote", titulo: "Sítio e lote", larguraMinima: 140, celula: (item) => <>{item.propriedade?.nome ?? "—"}{item.lote && <div className="mt-1 text-sm text-ink-3">{item.lote.nome}</div>}</> },
    { chave: "reproducao", titulo: "Reprodução", larguraMinima: 120, celula: (item) => { const s = item.contextoCartao?.situacaoReprodutiva; return s ? ROTULO_SITUACAO_REPRODUTIVA[s as SituacaoReprodutivaFiltro] ?? s : "—"; } },
    { chave: "producao", titulo: "Produção", larguraMinima: 110, celula: (item) => { const p = item.contextoCartao?.produtivo; if (!p) return "—"; return <>{ROTULO_SITUACAO_PRODUTIVA[p.situacaoProdutiva]}{p.situacaoProdutiva === "LACTANTE" && p.del != null && <div className="mt-1 text-sm text-ink-3">DEL {p.del}</div>}</>; } },
  ];

  const quantidade = selecionados.size;
  const brincosDigitados = separarBrincos(textoBrincos).length;
  const listaSelecionados = [...selecionados.values()];
  const campo = "h-[var(--campo-altura,42px)] w-full min-w-0 rounded-lg border border-border bg-card px-3 text-sm";
  const abaModo = (valor: typeof modo, rotulo: string, Icone: typeof Search) => <button type="button" aria-pressed={modo === valor} onClick={() => setModo(valor)}
    className={`inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm ${modo === valor ? "border-primary font-semibold text-primary" : "border-transparent text-ink-3"}`}><Icone size={15} aria-hidden />{rotulo}</button>;

  return <PainelCadastro aberto titulo={titulo} largura="sm:max-w-6xl" onFechar={onCancelar}
    rodape={<><Button secondary onClick={onCancelar}>Cancelar</Button><Button disabled={quantidade === 0} onClick={() => onConfirmar(listaSelecionados)}>{rotuloConfirmar} ({quantidade})</Button></>}>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="grid min-w-0 content-start gap-3">
        <ErrorBox erro={erro} />
        <nav aria-label="Forma de seleção" className="flex gap-1 border-b border-border">{abaModo("filtrar", "Filtrar o rebanho", SlidersHorizontal)}{abaModo("brincos", "Digitar brincos", ListChecks)}</nav>

        {modo === "brincos" ? <section className="grid gap-3" aria-label="Digitar brincos">
          <label className="grid gap-1.5 text-sm"><span className="font-medium">Brincos</span>
            <textarea aria-label="Lista de brincos" rows={8} value={textoBrincos} onChange={e => setTextoBrincos(e.target.value)} placeholder={"Digite ou cole os brincos, um por linha ou separados por espaço ou vírgula.\nEx.: 0012 0035 0101"} className={`${classeInput} font-mono`} />
          </label>
          <p className="text-sm text-ink-3">Só entram animais ativos{sexoFixo ? ` (${sexoFixo === "F" ? "fêmeas" : "machos"})` : ""}{excluirLoteId ? " fora deste lote" : ""}. O brinco precisa estar completo; maiúsculas e minúsculas não importam.</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={resolvendoBrincos || !brincosDigitados} onClick={() => void adicionarBrincos()}>{resolvendoBrincos ? "Buscando…" : brincosDigitados ? `Adicionar ${brincosDigitados} à seleção` : "Adicionar à seleção"}</Button>
          </div>
          {retornoBrincos && <div role="status" className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
            <p><strong>{retornoBrincos.adicionados}</strong> {retornoBrincos.adicionados === 1 ? "animal adicionado" : "animais adicionados"}.</p>
            {retornoBrincos.naoEncontrados.length > 0 && <p className="mt-1 text-ink-2">Não encontrados ({retornoBrincos.naoEncontrados.length}): {retornoBrincos.naoEncontrados.join(", ")}. Eles ficaram no campo para você corrigir.</p>}
          </div>}
        </section> : <div className="overflow-hidden rounded-xl border border-border">
          <BarraFiltros>
            <label className="relative w-full min-w-0 flex-[1_1_200px]"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" /><input aria-label="Buscar por brinco ou nome" value={textoBusca} onChange={(e) => setTextoBusca(e.target.value)} placeholder="Buscar por brinco ou nome" className={`${campo} pl-9`} /></label>
            <SelectCampo aria-label="Filtrar por sítio" value={filtros.propriedadeId} onValueChange={(v) => editar("propriedadeId", v)} className={`${campo} flex-[1_1_150px]`}><option value="">Todos os sítios</option>{catalogos?.propriedades.map((prop) => <option key={prop.id} value={prop.id}>{prop.nome}</option>)}</SelectCampo>
            <SelectCampo aria-label="Filtrar por lote de origem" value={filtros.loteId} onValueChange={(v) => editar("loteId", v)} className={`${campo} flex-[1_1_150px]`}><option value="">Todos os lotes</option>{lotesDoSitio.map((lote) => <option key={lote.id} value={lote.id}>{lote.nome}</option>)}</SelectCampo>
            <Button secondary aria-expanded={maisFiltros} onClick={() => setMaisFiltros(v => !v)}><SlidersHorizontal size={15} aria-hidden />Mais filtros{avancados ? ` (${avancados})` : ""}</Button>
          </BarraFiltros>
          {maisFiltros && <div className="grid gap-3 border-b border-border bg-surface-2 p-4 sm:grid-cols-2 xl:grid-cols-3">
            <MultiSelect compacto label="Categoria" placeholder="Todas" contentClassName="z-[1200]" options={categorias.map(c => ({ value: c.id, label: c.nome }))} value={filtros.categoriaIds} onValueChange={v => editar("categoriaIds", v)} />
            <MultiSelect compacto label="Situação reprodutiva" placeholder="Todas" contentClassName="z-[1200]" options={opcoes(ROTULO_SITUACAO_REPRODUTIVA)} value={filtros.situacoesReprodutivas} onValueChange={v => editar("situacoesReprodutivas", v)} />
            <MultiSelect compacto label="Situação produtiva" placeholder="Todas" contentClassName="z-[1200]" options={opcoes(ROTULO_SITUACAO_PRODUTIVA)} value={filtros.situacoesProdutivas} onValueChange={v => editar("situacoesProdutivas", v)} />
            <MultiSelect compacto label="Raça" placeholder="Todas" contentClassName="z-[1200]" options={(catalogos?.racas ?? []).map(r => ({ value: r.id, label: r.nome }))} value={filtros.racaIds} onValueChange={v => editar("racaIds", v)} />
            <MultiSelect compacto label="Aptidão" placeholder="Todas" contentClassName="z-[1200]" options={opcoes(ROTULO_APTIDAO)} value={filtros.aptidoes} onValueChange={v => editar("aptidoes", v)} />
            {!sexoFixo && <label className="grid gap-2"><span className="text-sm font-medium leading-5">Sexo</span><SelectCampo aria-label="Sexo" value={filtros.sexo} onValueChange={v => editar("sexo", v as Filtros["sexo"])} className={campo}><option value="">Todos</option><option value="F">Fêmeas</option><option value="M">Machos</option></SelectCampo></label>}
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-2"><span className="text-sm font-medium leading-5">Idade de (meses)</span><input type="number" min={0} inputMode="numeric" value={filtros.idadeMin} onChange={e => editar("idadeMin", e.target.value)} className={campo} /></label>
              <label className="grid gap-2"><span className="text-sm font-medium leading-5">até (meses)</span><input type="number" min={0} inputMode="numeric" value={filtros.idadeMax} onChange={e => editar("idadeMax", e.target.value)} className={campo} /></label>
            </div>
            {(filtros.situacoesReprodutivas.length > 0 || filtros.situacoesProdutivas.length > 0) && <p className="text-sm text-ink-3 sm:col-span-2 xl:col-span-3">Situações reprodutiva e produtiva consideram somente fêmeas ativas, calculadas na data de hoje.</p>}
          </div>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-surface-2 px-4 py-2.5 text-sm">
            {itens.length > 0 && <label className="flex items-center gap-2 font-medium"><input type="checkbox" aria-label="Selecionar todos da página" checked={todosDaPaginaSelecionados} onChange={alternarTodosDaPagina} /> Selecionar todos da página</label>}
            {total > ITENS_POR_PAGINA && <button type="button" disabled={carregandoTodos || total > LIMITE_SELECAO_TOTAL} onClick={() => void selecionarTodosEncontrados()} className="font-medium text-primary underline-offset-2 hover:underline disabled:text-ink-3 disabled:no-underline"
              title={total > LIMITE_SELECAO_TOTAL ? `Refine os filtros: até ${LIMITE_SELECAO_TOTAL} animais por vez` : undefined}>{carregandoTodos ? "Selecionando…" : `Selecionar os ${total} encontrados`}</button>}
            {algumFiltro && <button type="button" onClick={limparFiltros} className="text-ink-3 underline-offset-2 hover:underline">Limpar filtros</button>}
            {quantidade > 0 && <span className="text-ink-3 lg:hidden">{quantidade} {quantidade === 1 ? "animal selecionado" : "animais selecionados"} no total</span>}
          </div>
          {carregando && !itens.length ? <div className="p-6"><Loader label="Carregando animais" /></div>
            // total > 0 mantém a paginação visível mesmo que esta página específica venha vazia
            : total > 0 ? <>
              {itens.length > 0
                ? <TabelaFinanceira rotulo="Animais" itens={itens} colunas={COLUNAS} chaveDe={(item) => item.id} onAbrir={(item) => alternar(item)} classeLinha={(item) => selecionados.has(item.id) ? "bg-[#eef1e9]" : ""} />
                : <Empty>Nenhum animal nesta página.</Empty>}
              <Paginacao paginaAtual={pagina} totalPaginas={totalPaginas} totalItens={total} itensPorPagina={ITENS_POR_PAGINA} onPaginaChange={setPagina} rotulo="animais" idSelect="pagina-seletor-animais" />
            </> : <Empty>Nenhum animal ativo encontrado com os filtros selecionados.</Empty>}
        </div>}
      </div>

      <aside aria-label="Animais selecionados" className="grid content-start gap-2 rounded-xl border border-border bg-surface-2 p-3 lg:sticky lg:top-0 lg:max-h-[70dvh] lg:overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Selecionados <span className="font-normal text-ink-3">({quantidade})</span></h3>
          {quantidade > 0 && <button type="button" onClick={() => setSelecionados(new Map())} className="text-sm text-ink-3 underline-offset-2 hover:text-destructive hover:underline">Limpar</button>}
        </div>
        {quantidade === 0 ? <p className="text-sm text-ink-3">Marque animais na lista ou digite os brincos.</p>
          : <ul className="grid max-h-60 gap-1 overflow-y-auto lg:max-h-[calc(70dvh-4rem)]">{listaSelecionados.map(a => <li key={a.id} className="flex items-center justify-between gap-2 rounded-md bg-card px-2 py-1.5 text-sm">
            <span className="min-w-0 truncate"><strong>{a.brinco}</strong>{a.nome ? <span className="text-ink-3"> · {a.nome}</span> : null}</span>
            <button type="button" aria-label={`Remover ${a.brinco} da seleção`} onClick={() => remover([a.id])} className="grid size-7 shrink-0 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-destructive"><X size={14} aria-hidden /></button>
          </li>)}</ul>}
      </aside>
    </div>
  </PainelCadastro>;
}
