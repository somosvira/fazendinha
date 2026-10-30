import { VacaIcon } from "../../../components/icons/VacaIcon";
import { CartaoAnimal } from "../components/CartaoAnimal";
import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from "@/components/VisualizacaoConsulta";
import { OrdenarConsulta } from "@/financeiro/OrdenarConsulta";
import { Settings2 } from "lucide-react";
import { filtrosDasColunas, type CampoConsulta } from "@/financeiro/FiltroColunaConsulta";
import { DatePicker } from "@/components/DatePicker";
import { BarraConsulta } from "@/financeiro/BarraConsulta";
import { CampoFiltro, GrupoCamposFiltro, PainelFiltros } from "@/financeiro/PainelFiltros";
import { MultiSelect } from "../../../components/MultiSelect";
import { DialogFinanceiro } from "../../../financeiro/DialogFinanceiro";
// Lista de animais — BarraFiltros + TabelaFinanceira + Paginacao (servidor),
// no padrão de OperacoesFinanceiras.tsx. Seleção múltipla habilita
// "Movimentar N animais"; ações de linha são Editar e Movimentar.
//
// Filtros: os campos ficam sincronizados com a query string da URL (leitura na
// montagem e `history.replaceState` ao aplicar o painel ou alterar a busca) para que cards/barras da
// Visão geral e outras telas possam linkar direto para um recorte da lista
// (ex.: `?categoriaId=…`, `?situacao=BAIXADO&baixaDe=…`). O pathname continua
// intacto — só a query muda — então o roteamento por aba (router.ts) não é
// afetado.

import { useEffect, useMemo, useRef, useState } from "react";
import { FormColetivoSanitario } from "../sanidade/FormColetivoSanitario";
import { FormAplicacaoServico } from "../sanidade/FormAplicacaoServico";
import { PesagemColetiva } from "../manejo/ManejoAnimal";
import { ArrowRightLeft, Pencil, Plus, Search, SlidersHorizontal } from "lucide-react";
import { listarAnimais, buscarFichaAnimal, listarCategorias, obterCatalogos, RebanhoApiError } from "../api";
import type { AnimalFicha, AnimalResumo, Aptidao, CategoriaDTO, Catalogos, ListarFiltros, Origem, PapelReprodutivo, Sexo, Situacao, TipoBaixa } from "../types";
import { formatarDataBR, formatarIdade, rotuloAptidao, rotuloOpcaoCategoria, rotuloPapelReprodutivo, rotuloSituacao, rotuloTipoBaixa } from "../lib/rotulos";
import { formatarGmd } from "../lib/peso";
import { BarraFiltros, CategoriaPill, Paginacao, useAoMovimentarComToast } from "../ui";
import { FormDadosAnimal } from "../forms/FormDadosAnimal";
import { FormMovimentar } from "../forms/FormMovimentar";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { navegarPara } from "../../../router";
import { Button, type ColunaTabela, Empty, ErrorBox, PageHeader, PaginaFinanceira, Panel, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { NavRebanho } from "./NavRebanho";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import "./lista-animais.css";
import "./rotinas-aprovadas.css";

const ITENS_POR_PAGINA = 20;

/** valores sentinela da opção "categoria" — não colidem com uuid de categoria real */
const CATEGORIA_SEM = "__sem_categoria__";
const CATEGORIA_FORCADA = "__so_forcadas__";

/** tipos de baixa oferecidos no filtro — CADASTRO_INDEVIDO é interno do "excluir cadastro" e não aparece aqui */
const TIPOS_BAIXA_FILTRO: TipoBaixa[] = ["VENDA", "ABATE", "MORTE", "DOACAO", "EXTRAVIO", "NAO_DETERMINADO"];

type OpcaoOrdenacao = { valor: string; ordenar: "brinco" | "nascimento" | "entrada" | "ultimoPeso" | "gmd"; direcao: "asc" | "desc"; rotulo: string };
const OPCOES_ORDENACAO: OpcaoOrdenacao[] = [
  { valor: "brinco", ordenar: "brinco", direcao: "asc", rotulo: "Brinco" },
  { valor: "nascimento-desc", ordenar: "nascimento", direcao: "desc", rotulo: "Nascimento — mais novos" },
  { valor: "nascimento-asc", ordenar: "nascimento", direcao: "asc", rotulo: "Nascimento — mais velhos" },
  { valor: "entrada-desc", ordenar: "entrada", direcao: "desc", rotulo: "Entrada — recentes" },
  { valor: "entrada-asc", ordenar: "entrada", direcao: "asc", rotulo: "Entrada — antigas" },
];
OPCOES_ORDENACAO.push(
  { valor: "brinco-desc", ordenar: "brinco", direcao: "desc", rotulo: "Brinco — Z–A" },
  { valor: "ultimoPeso-asc", ordenar: "ultimoPeso", direcao: "asc", rotulo: "Último peso — menor primeiro" },
  { valor: "ultimoPeso-desc", ordenar: "ultimoPeso", direcao: "desc", rotulo: "Último peso — maior primeiro" },
  { valor: "gmd-asc", ordenar: "gmd", direcao: "asc", rotulo: "GMD — menor primeiro" },
  { valor: "gmd-desc", ordenar: "gmd", direcao: "desc", rotulo: "GMD — maior primeiro" },
);
const ORDENACAO_PADRAO = OPCOES_ORDENACAO[0].valor;

function acharOrdenacao(ordenar: string | null, direcao: string | null): string {
  const achada = OPCOES_ORDENACAO.find((o) => o.ordenar === ordenar && o.direcao === direcao);
  return achada ? achada.valor : ORDENACAO_PADRAO;
}

/** Lê os filtros iniciais da query string (deep-link vindo da Visão geral, de Cadastros etc.). */
function lerFiltrosDaUrl() {
  const params = new URLSearchParams(window.location.search);
  const semCategoria = params.get("semCategoria") === "true";
  const categoriaOrigemManual = params.get("categoriaOrigem") === "MANUAL";
  return {
    busca: params.get("busca") ?? "",
    propriedadeId: params.get("propriedadeId") ?? "",
    loteId: params.get("loteId") ?? "",
    categoriaId: semCategoria ? CATEGORIA_SEM : categoriaOrigemManual ? CATEGORIA_FORCADA : (params.get("categoriaId") ?? ""),
    aptidao: (params.get("aptidao") ?? "") as Aptidao | "",
    papelReprodutivo: (params.get("papelReprodutivo") ?? "") as PapelReprodutivo | "",
    situacao: (params.has("situacoes") ? "TODOS" : params.get("situacao") ?? "ATIVO") as Situacao | "TODOS",
    sexo: (params.get("sexo") ?? "") as Sexo | "",
    origem: (params.get("origem") ?? "") as Origem | "",
    racaId: params.get("racaId") ?? "",
    idadeMinMeses: params.get("idadeMinMeses") ?? "",
    idadeMaxMeses: params.get("idadeMaxMeses") ?? "",
    tipoBaixa: (params.get("tipoBaixa") ?? "") as TipoBaixa | "",
    baixaDe: params.get("baixaDe") ?? "",
    baixaAte: params.get("baixaAte") ?? "",
    ordenacao: acharOrdenacao(params.get("ordenar"), params.get("direcao")),
  };
}

const FAMILIAS = { propriedadeIds: "propriedadeId", loteIds: "loteId", categoriaIds: "categoriaId", aptidoes: "aptidao", papeisReprodutivos: "papelReprodutivo", situacoes: "situacao", sexos: "sexo", origens: "origem", racaIds: "racaId" } as const;
type Familia = keyof typeof FAMILIAS;
type RascunhoFiltros = Omit<ReturnType<typeof lerFiltrosDaUrl>, "busca"> & { multiplos: Record<Familia, string[]>; mostrarColunasAdicionais: boolean };
function lerMultiplos() {
  const p = new URLSearchParams(window.location.search);
  return Object.fromEntries(Object.keys(FAMILIAS).map(k => [k, k === "propriedadeIds" && getPropriedadeAtiva() != null ? [] : p.getAll(k)])) as Record<Familia, string[]>;
}
function pillSituacao(situacao: Situacao) {
  return <Pill tone={situacao === "ATIVO" ? "green" : "neutral"}>{rotuloSituacao(situacao)}</Pill>;
}

export function ListaAnimais({ onAbrirAnimal, onNovoAnimal, podeLancar = true, variante = "rebanho" }: { onAbrirAnimal: (id: string) => void; onNovoAnimal: () => void; podeLancar?: boolean; variante?: "rebanho" | "pesagem" }) {
  const visual = useVisualizacaoConsulta("visualAnimais");
  const pesagem = variante === "pesagem";
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [mostrarColunasAdicionais, setMostrarColunasAdicionais] = useState(false);
  const sitioGlobal = useMemo(() => getPropriedadeAtiva(), []);
  const filtrosUrl = useMemo(() => lerFiltrosDaUrl(), []);
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [categorias, setCategorias] = useState<CategoriaDTO[]>([]);
  const [itens, setItens] = useState<AnimalResumo[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [revisao, setRevisao] = useState(0);

  const [textoBusca, setTextoBusca] = useState(filtrosUrl.busca);
  const [busca, setBusca] = useState(filtrosUrl.busca);
  const [propriedadeId, setPropriedadeId] = useState<string>(sitioGlobal != null ? String(sitioGlobal) : filtrosUrl.propriedadeId);
  const [loteId, setLoteId] = useState(filtrosUrl.loteId);
  const [categoriaId, setCategoriaId] = useState(filtrosUrl.categoriaId);
  const [aptidao, setAptidao] = useState<Aptidao | "">(filtrosUrl.aptidao);
  const [papelReprodutivo, setPapelReprodutivo] = useState<PapelReprodutivo | "">(filtrosUrl.papelReprodutivo);
  const [situacao, setSituacao] = useState<Situacao | "TODOS">(filtrosUrl.situacao);
  const [sexo, setSexo] = useState<Sexo | "">(filtrosUrl.sexo);
  const [origem, setOrigem] = useState<Origem | "">(filtrosUrl.origem);
  const [racaId, setRacaId] = useState(filtrosUrl.racaId);
  const [idadeMinMeses, setIdadeMinMeses] = useState(filtrosUrl.idadeMinMeses);
  const [idadeMaxMeses, setIdadeMaxMeses] = useState(filtrosUrl.idadeMaxMeses);
  const [tipoBaixa, setTipoBaixa] = useState<TipoBaixa | "">(filtrosUrl.tipoBaixa);
  const [baixaDe, setBaixaDe] = useState(filtrosUrl.baixaDe);
  const [baixaAte, setBaixaAte] = useState(filtrosUrl.baixaAte);
  const [ordenacao, setOrdenacao] = useState(filtrosUrl.ordenacao);
  const [pagina, setPagina] = useState(() => Math.max(1, Number(new URLSearchParams(window.location.search).get("page")) || 1));
  const [multiplos, setMultiplos] = useState(lerMultiplos);
  const [rascunho, setRascunho] = useState<RascunhoFiltros | null>(null);
  const iniciarFiltros = () => {
    setRascunho({ propriedadeId, loteId, categoriaId, aptidao, papelReprodutivo, situacao, sexo, origem, racaId, idadeMinMeses, idadeMaxMeses, tipoBaixa, baixaDe, baixaAte, ordenacao, multiplos, mostrarColunasAdicionais });
  };
  const abrirFiltros = () => { iniciarFiltros(); setFiltrosAbertos(true); };
  const editarFiltro = <K extends keyof RascunhoFiltros,>(campo: K, valor: RascunhoFiltros[K]) => setRascunho(r => r && ({ ...r, [campo]: valor }));
  const aplicarFiltros = () => {
    if (!rascunho) return;
    setPropriedadeId(rascunho.propriedadeId); setLoteId(rascunho.loteId); setCategoriaId(rascunho.categoriaId);
    setAptidao(rascunho.aptidao); setPapelReprodutivo(rascunho.papelReprodutivo); setSituacao(rascunho.situacao);
    setSexo(rascunho.sexo); setOrigem(rascunho.origem); setRacaId(rascunho.racaId);
    setIdadeMinMeses(rascunho.idadeMinMeses); setIdadeMaxMeses(rascunho.idadeMaxMeses);
    setTipoBaixa(rascunho.tipoBaixa); setBaixaDe(rascunho.baixaDe); setBaixaAte(rascunho.baixaAte);
    setOrdenacao(rascunho.ordenacao); setMultiplos(rascunho.multiplos); setMostrarColunasAdicionais(rascunho.mostrarColunasAdicionais);
    if (rascunho.propriedadeId !== propriedadeId || rascunho.multiplos.propriedadeIds !== multiplos.propriedadeIds) setSelecionados(new Map());
    setPagina(1); setFiltrosAbertos(false);
  };
  const limparRascunho = () => setRascunho(r => r && ({ ...r,
    propriedadeId: sitioGlobal != null ? String(sitioGlobal) : "", loteId: "", categoriaId: "", aptidao: "", papelReprodutivo: "", situacao: "ATIVO", sexo: "", origem: "", racaId: "",
    idadeMinMeses: "", idadeMaxMeses: "", tipoBaixa: "", baixaDe: "", baixaAte: "", ordenacao: ORDENACAO_PADRAO,
    multiplos: { propriedadeIds: [], loteIds: [], categoriaIds: [], aptidoes: [], papeisReprodutivos: [], situacoes: [], sexos: [], origens: [], racaIds: [] },
  }));

  const [selecionados, setSelecionados] = useState<Map<string, AnimalResumo>>(new Map());
  const [pesando, setPesando] = useState(false);
  const [coletivoSanitario, setColetivoSanitario] = useState<"exame" | "protocolo" | null>(null);
  const [aplicando, setAplicando] = useState(false);
  const [editando, setEditando] = useState<AnimalFicha | null>(null);
  const [carregandoEdicaoId, setCarregandoEdicaoId] = useState<string | null>(null);
  const [movimentando, setMovimentando] = useState<{ animais: AnimalResumo[]; propriedadeId?: number | null; loteId?: string | null } | null>(null);

  // Situação inclui baixados: libera os filtros de tipo e período da baixa.
  const mostrarBaixa = multiplos.situacoes.length ? multiplos.situacoes.includes("BAIXADO") : situacao === "BAIXADO" || situacao === "TODOS";
  const opcaoOrdenacao = OPCOES_ORDENACAO.find((o) => o.valor === ordenacao) ?? OPCOES_ORDENACAO[0];

  useEffect(() => { obterCatalogos().then(setCatalogos).catch((e) => setErro(e instanceof Error ? e.message : String(e))); }, []);
  useEffect(() => { listarCategorias().then((r) => setCategorias(r.itens)).catch(() => undefined); }, []);
  useEffect(() => {
    if (!catalogos || sitioGlobal == null) return;
    const validos = new Set(catalogos.lotes.filter(l => l.propriedadeId === sitioGlobal).map(l => l.id));
    if (loteId && !validos.has(loteId)) setLoteId("");
    setMultiplos(m => m.loteIds.some(id => !validos.has(id)) ? { ...m, loteIds: m.loteIds.filter(id => validos.has(id)) } : m);
  }, [catalogos, sitioGlobal, loteId]);


  useEffect(() => {
    let vigente = true;
    setCarregando(true); setErro(null);
    setItens([]);
    let recuperandoPagina = false;
    const listas: Pick<ListarFiltros, Familia> = {
      propriedadeIds: sitioGlobal == null && multiplos.propriedadeIds.length ? multiplos.propriedadeIds.map(Number) : undefined,
      loteIds: multiplos.loteIds.length ? multiplos.loteIds : undefined,
      categoriaIds: multiplos.categoriaIds.length ? multiplos.categoriaIds : undefined,
      aptidoes: multiplos.aptidoes.length ? multiplos.aptidoes as Aptidao[] : undefined,
      papeisReprodutivos: multiplos.papeisReprodutivos.length ? multiplos.papeisReprodutivos as PapelReprodutivo[] : undefined,
      situacoes: multiplos.situacoes.length ? multiplos.situacoes as Situacao[] : undefined,
      sexos: multiplos.sexos.length ? multiplos.sexos as Sexo[] : undefined,
      origens: multiplos.origens.length ? multiplos.origens as Origem[] : undefined,
      racaIds: multiplos.racaIds.length ? multiplos.racaIds : undefined,
    };
    listarAnimais({
      comContexto: !pesagem,
      ...listas,
      busca: busca.trim() || undefined,
      propriedadeId: listas.propriedadeIds ? undefined : propriedadeId ? Number(propriedadeId) : undefined,
      loteId: listas.loteIds ? undefined : loteId || undefined,
      categoriaId: !listas.categoriaIds && categoriaId && categoriaId !== CATEGORIA_SEM && categoriaId !== CATEGORIA_FORCADA ? categoriaId : undefined,
      semCategoria: categoriaId === CATEGORIA_SEM ? true : undefined,
      categoriaOrigem: categoriaId === CATEGORIA_FORCADA ? "MANUAL" : undefined,
      aptidao: listas.aptidoes ? undefined : aptidao || undefined,
      papelReprodutivo: listas.papeisReprodutivos ? undefined : papelReprodutivo || undefined,
      situacao: listas.situacoes ? undefined : situacao,
      sexo: listas.sexos ? undefined : sexo || undefined,
      origem: listas.origens ? undefined : origem || undefined,
      racaId: listas.racaIds ? undefined : racaId || undefined,
      idadeMinMeses: idadeMinMeses !== "" && !Number.isNaN(Number(idadeMinMeses)) ? Number(idadeMinMeses) : undefined,
      idadeMaxMeses: idadeMaxMeses !== "" && !Number.isNaN(Number(idadeMaxMeses)) ? Number(idadeMaxMeses) : undefined,
      tipoBaixa: mostrarBaixa && tipoBaixa ? tipoBaixa : undefined,
      baixaDe: mostrarBaixa && baixaDe ? baixaDe : undefined,
      baixaAte: mostrarBaixa && baixaAte ? baixaAte : undefined,
      ordenar: opcaoOrdenacao.ordenar,
      direcao: opcaoOrdenacao.direcao,
      page: pagina,
      pageSize: ITENS_POR_PAGINA,
    })
      .then((resultado) => {
        if (!vigente) return;
        const ultimaPagina = Math.max(1, Math.ceil(resultado.total / ITENS_POR_PAGINA));
        if (pagina > ultimaPagina) {
          recuperandoPagina = true;
          setPagina(ultimaPagina);
          return;
        }
        setItens(resultado.itens); setTotal(resultado.total);
      })
      .catch((e) => { if (vigente) setErro(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (vigente && !recuperandoPagina) setCarregando(false); });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, propriedadeId, loteId, categoriaId, aptidao, papelReprodutivo, situacao, sexo, origem, racaId, idadeMinMeses, idadeMaxMeses, mostrarBaixa, tipoBaixa, baixaDe, baixaAte, opcaoOrdenacao, pagina, revisao, multiplos, sitioGlobal]);

  useEffect(() => {
    const restaurar = () => { const f = lerFiltrosDaUrl(); setMultiplos(lerMultiplos()); setTextoBusca(f.busca); setBusca(f.busca); setPropriedadeId(sitioGlobal != null ? String(sitioGlobal) : f.propriedadeId); setLoteId(f.loteId); setCategoriaId(f.categoriaId); setAptidao(f.aptidao); setPapelReprodutivo(f.papelReprodutivo); setSituacao(f.situacao); setSexo(f.sexo); setOrigem(f.origem); setRacaId(f.racaId); setIdadeMinMeses(f.idadeMinMeses); setIdadeMaxMeses(f.idadeMaxMeses); setTipoBaixa(f.tipoBaixa); setBaixaDe(f.baixaDe); setBaixaAte(f.baixaAte); setOrdenacao(f.ordenacao); setPagina(Math.max(1, Number(new URLSearchParams(window.location.search).get("page")) || 1)); setSelecionados(new Map()); };
    window.addEventListener("popstate", restaurar); return () => window.removeEventListener("popstate", restaurar);
  }, [sitioGlobal]);
  // busca só dispara depois de 300 ms sem digitar
  useEffect(() => {
    const t = setTimeout(() => { if (textoBusca !== busca) { setBusca(textoBusca); setPagina(1); } }, 300);
    return () => clearTimeout(t);
  }, [textoBusca, busca]);

  // mantém a query string em sincronia com os filtros ativos, sem tocar no pathname
  // (o roteamento por aba olha só `window.location.pathname` — ver router.ts)
  useEffect(() => {
    const params = new URLSearchParams();
    const preferenciaVisual = new URLSearchParams(window.location.search).get("visualAnimais");
    if (preferenciaVisual === "visual" || preferenciaVisual === "tabela") params.set("visualAnimais", preferenciaVisual);
    if (busca) params.set("busca", busca);
    if (sitioGlobal == null && propriedadeId) params.set("propriedadeId", propriedadeId);
    if (loteId) params.set("loteId", loteId);
    if (categoriaId === CATEGORIA_SEM) params.set("semCategoria", "true");
    else if (categoriaId === CATEGORIA_FORCADA) params.set("categoriaOrigem", "MANUAL");
    else if (categoriaId) params.set("categoriaId", categoriaId);
    if (aptidao) params.set("aptidao", aptidao);
    if (papelReprodutivo) params.set("papelReprodutivo", papelReprodutivo);
    if (situacao !== "ATIVO") params.set("situacao", situacao);
    if (sexo) params.set("sexo", sexo);
    if (origem) params.set("origem", origem);
    if (racaId) params.set("racaId", racaId);
    if (idadeMinMeses) params.set("idadeMinMeses", idadeMinMeses);
    if (idadeMaxMeses) params.set("idadeMaxMeses", idadeMaxMeses);
    if (mostrarBaixa && tipoBaixa) params.set("tipoBaixa", tipoBaixa);
    if (mostrarBaixa && baixaDe) params.set("baixaDe", baixaDe);
    if (mostrarBaixa && baixaAte) params.set("baixaAte", baixaAte);
    if (ordenacao !== ORDENACAO_PADRAO) { params.set("ordenar", opcaoOrdenacao.ordenar); params.set("direcao", opcaoOrdenacao.direcao); }
    for (const plural of Object.keys(FAMILIAS) as Familia[]) {
      if (plural === "propriedadeIds" && sitioGlobal != null) continue;
      if (multiplos[plural].length) { params.delete(FAMILIAS[plural]); multiplos[plural].forEach(v => params.append(plural, v)); }
    }
    if (pagina > 1) params.set("page", String(pagina));
    const query = params.toString();
    const novaUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    if (novaUrl !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(window.history.state, "", novaUrl);
  }, [busca, propriedadeId, loteId, categoriaId, aptidao, papelReprodutivo, situacao, sexo, origem, racaId, idadeMinMeses, idadeMaxMeses, mostrarBaixa, tipoBaixa, baixaDe, baixaAte, ordenacao, opcaoOrdenacao, sitioGlobal, multiplos, pagina]);

  /** Troca um filtro e volta para a página 1 no mesmo render — uma única busca.
   * A seleção coletiva é independente da busca: o produtor pode refinar a lista sem
   * perder animais que já marcou em outra página ou filtro. */
  const filtrar = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPagina(1); };

  const totalPaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA));
  const lotesDoSitio = catalogos?.lotes.filter(lote => rascunho?.multiplos.propriedadeIds.length && sitioGlobal == null
    ? rascunho.multiplos.propriedadeIds.includes(String(lote.propriedadeId))
    : !rascunho?.propriedadeId || String(lote.propriedadeId) === rascunho.propriedadeId) ?? [];
  const mostrarBaixaRascunho = rascunho && (rascunho.multiplos.situacoes.length
    ? rascunho.multiplos.situacoes.includes("BAIXADO") : rascunho.situacao === "BAIXADO" || rascunho.situacao === "TODOS");

  // baixados não entram na seleção em massa (K3) — ela é sempre uma movimentação, e baixado não se movimenta
  const itensSelecionaveis = useMemo(() => itens.filter((item) => item.situacao === "ATIVO"), [itens]);
  const alternarSelecao = (animal: AnimalResumo) => { if (animal.situacao !== "ATIVO") return; setSelecionados((atual) => { const novo = new Map(atual); if (novo.has(animal.id)) novo.delete(animal.id); else novo.set(animal.id, animal); return novo; }); };
  const todosDaPaginaSelecionados = itensSelecionaveis.length > 0 && itensSelecionaveis.every((item) => selecionados.has(item.id));
  const alternarSelecaoTodos = () => setSelecionados((atual) => {
    const novo = new Map(atual);
    if (todosDaPaginaSelecionados) itensSelecionaveis.forEach((item) => novo.delete(item.id));
    else itensSelecionaveis.forEach((item) => novo.set(item.id, item));
    return novo;
  });

  // guarda o id do último clique: uma resposta de um clique anterior que chega depois é ignorada (U3)
  const edicaoSolicitadaRef = useRef<string | null>(null);
  const editar = async (id: string) => {
    edicaoSolicitadaRef.current = id;
    setCarregandoEdicaoId(id); setErro(null);
    try {
      const ficha = await buscarFichaAnimal(id);
      if (edicaoSolicitadaRef.current === id) setEditando(ficha);
    } catch (e) {
      if (edicaoSolicitadaRef.current === id) setErro(e instanceof RebanhoApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      if (edicaoSolicitadaRef.current === id) setCarregandoEdicaoId(null);
    }
  };
  const recarregar = async () => { setRevisao((v) => v + 1); };
  const aoMovimentar = useAoMovimentarComToast(recarregar);

  const filtrosAtivos = [
    ...(!multiplos.propriedadeIds.length && propriedadeId && sitioGlobal == null ? [{ rotulo: `Sítio: ${catalogos?.propriedades.find(p => String(p.id) === propriedadeId)?.nome ?? "Selecionado"}`, limpar: () => { filtrar(setPropriedadeId)(""); setLoteId(""); } }] : []),
    ...(!multiplos.loteIds.length && loteId ? [{ rotulo: `Lote: ${catalogos?.lotes.find(l => l.id === loteId)?.nome ?? "Selecionado"}`, limpar: () => filtrar(setLoteId)("") }] : []),
    ...(!multiplos.categoriaIds.length && categoriaId ? [{ rotulo: `Categoria: ${categoriaId === CATEGORIA_SEM ? "Sem categoria" : categoriaId === CATEGORIA_FORCADA ? "Só forçadas" : categorias.find(c => c.id === categoriaId)?.nome ?? "Selecionada"}`, limpar: () => filtrar(setCategoriaId)("") }] : []),
    ...(!multiplos.situacoes.length && situacao !== "TODOS" ? [{ rotulo: `Situação: ${situacao === "ATIVO" ? "Ativos" : "Baixados"}`, limpar: () => filtrar(setSituacao)("TODOS") }] : []),
    ...(!multiplos.sexos.length && sexo ? [{ rotulo: `Sexo: ${sexo === "F" ? "Fêmeas" : "Machos"}`, limpar: () => filtrar(setSexo)("") }] : []),
    ...(!multiplos.origens.length && origem ? [{ rotulo: `Origem: ${origem === "NASCIDO" ? "Nascido" : "Comprado"}`, limpar: () => filtrar(setOrigem)("") }] : []),
    ...(!multiplos.racaIds.length && racaId ? [{ rotulo: `Raça: ${catalogos?.racas.find(r => r.id === racaId)?.nome ?? "Selecionada"}`, limpar: () => filtrar(setRacaId)("") }] : []),
    ...(idadeMinMeses ? [{ rotulo: `Idade mínima: ${idadeMinMeses} meses`, limpar: () => filtrar(setIdadeMinMeses)("") }] : []),
    ...(idadeMaxMeses ? [{ rotulo: `Idade máxima: ${idadeMaxMeses} meses`, limpar: () => filtrar(setIdadeMaxMeses)("") }] : []),
    ...(!multiplos.aptidoes.length && aptidao ? [{ rotulo: `Finalidade: ${rotuloAptidao(aptidao)}`, limpar: () => filtrar(setAptidao)("") }] : []),
    ...(!multiplos.papeisReprodutivos.length && papelReprodutivo ? [{ rotulo: `Papel: ${rotuloPapelReprodutivo(papelReprodutivo)}`, limpar: () => filtrar(setPapelReprodutivo)("") }] : []),
    ...(mostrarBaixa && tipoBaixa ? [{ rotulo: `Baixa: ${rotuloTipoBaixa(tipoBaixa)}`, limpar: () => filtrar(setTipoBaixa)("") }] : []),
    ...(mostrarBaixa && baixaDe ? [{ rotulo: `Baixa de: ${formatarDataBR(baixaDe)}`, limpar: () => filtrar(setBaixaDe)("") }] : []),
    ...(mostrarBaixa && baixaAte ? [{ rotulo: `Baixa até: ${formatarDataBR(baixaAte)}`, limpar: () => filtrar(setBaixaAte)("") }] : []),
  ];
  const campoMultiplo = (familia: Familia, label: string, options: { value: string; label: string }[]) => {
    if (!rascunho) return null;
    const legado = rascunho[FAMILIAS[familia]];
    const valor = rascunho.multiplos[familia].length ? rascunho.multiplos[familia] : legado && options.some(o => o.value === legado) ? [legado] : [];
    return <MultiSelect compacto label={label} placeholder={familia === "situacoes" ? "Ativos e baixados" : "Todas as opções"} contentClassName="z-[1300]" options={options} value={valor} onValueChange={valores => {
      setRascunho(r => r && ({ ...r, [FAMILIAS[familia]]: familia === "situacoes" ? "TODOS" : "",
        ...(familia === "propriedadeIds" ? { loteId: "" } : {}),
        multiplos: { ...r.multiplos, [familia]: valores, ...(familia === "propriedadeIds" ? { loteIds: [] } : {}) },
      }));
    }}/>;
  };
  const campoColuna = (chave: string, familia: Familia, rotulo: string, opcoes: {value:string;label:string}[]): CampoConsulta => ({chave,ativo:!!multiplos[familia].length||!!({propriedadeIds:propriedadeId,loteIds:loteId,categoriaIds:categoriaId,aptidoes:aptidao,papeisReprodutivos:papelReprodutivo,situacoes:situacao!=="TODOS"?situacao:"",sexos:sexo,origens:origem,racaIds:racaId}[familia]),conteudo:campoMultiplo(familia,rotulo,opcoes),limpar:()=>setRascunho(r=>r&&({...r,[FAMILIAS[familia]]:familia==="situacoes"?"TODOS":"",multiplos:{...r.multiplos,[familia]:[]}}))});
  const camposColunas: CampoConsulta[] = [
    campoColuna("categoria","categoriaIds","Categoria",categorias.map(c=>({value:c.id,label:rotuloOpcaoCategoria(categorias,c)}))),
    campoColuna("lote","loteIds","Lote",lotesDoSitio.map(l=>({value:l.id,label:l.nome}))),
    ...(sitioGlobal==null?[campoColuna("sitio","propriedadeIds","Sítio",catalogos?.propriedades.map(p=>({value:String(p.id),label:p.nome}))??[])]:[]),
    campoColuna("aptidao","aptidoes","Finalidade",[{value:"LEITE",label:"Leite"},{value:"CORTE",label:"Corte"},{value:"REPRODUCAO",label:"Reprodução"}]),
    campoColuna("papel","papeisReprodutivos","Papel reprodutivo",[{value:"NENHUM",label:"Nenhum"},{value:"RECEPTORA",label:"Receptora"},{value:"DOADORA",label:"Doadora"}]),
    campoColuna("situacao","situacoes","Situação",[{value:"ATIVO",label:"Ativos"},{value:"BAIXADO",label:"Baixados"}]),
    {chave:"idade",ativo:!!idadeMinMeses||!!idadeMaxMeses,limpar:()=>{editarFiltro("idadeMinMeses","");editarFiltro("idadeMaxMeses","");},conteudo:rascunho&&<GrupoCamposFiltro titulo="Idade em meses"><CampoFiltro rotulo="Mínima"><input aria-label="Idade mínima (meses)" type="number" min={0} placeholder="Mínima" value={rascunho.idadeMinMeses} onChange={e=>editarFiltro("idadeMinMeses",e.target.value)}/></CampoFiltro><CampoFiltro rotulo="Máxima"><input aria-label="Idade máxima (meses)" type="number" min={0} placeholder="Máxima" value={rascunho.idadeMaxMeses} onChange={e=>editarFiltro("idadeMaxMeses",e.target.value)}/></CampoFiltro></GrupoCamposFiltro>},
  ];
  const filtrosColunas = filtrosDasColunas(camposColunas,{iniciar:iniciarFiltros,aplicar:aplicarFiltros,limpar:limparRascunho});
  const COLUNAS_TODAS: ColunaTabela<AnimalResumo>[] = [
    { chave: "selecionar", titulo: "", larguraMinima: 44, acoes: true, celula: (item) => item.situacao === "ATIVO" ? <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center" onClick={(e) => e.stopPropagation()}><input className="animal-checkbox" type="checkbox" aria-label={`Selecionar ${item.brinco}`} checked={selecionados.has(item.id)} onChange={() => alternarSelecao(item)} /></label> : null },
    { chave: "brinco", titulo: "Brinco / nome", larguraMinima: 180, principal: true, celula: (item) => <><strong className="break-words">{item.brinco}</strong>{item.nome && <div className="mt-1 text-sm text-ink-3">{item.nome}</div>}</> },
    { chave: "categoria", titulo: "Categoria", larguraMinima: 110, celula: (item) => <CategoriaPill categoria={item.categoria} categoriaOrigem={item.categoriaOrigem} categoriaCalculada={item.categoriaCalculada} /> },
    { chave: "idade", titulo: "Idade", larguraMinima: 90, celula: (item) => formatarIdade(item.idadeMeses) },
    { chave: "sitio", titulo: "Sítio", larguraMinima: 140, celula: (item) => item.propriedade?.nome ?? "—" },
    { chave: "lote", titulo: "Lote", larguraMinima: 120, larguraFlexivel: true, celula: (item) => item.lote
      ? <a href={`/pecuaria/rebanho/lotes/${item.lote.id}`} onClick={(e) => { e.stopPropagation(); if(!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();navegarPara(`/pecuaria/rebanho/lotes/${item.lote!.id}`);} }} className="break-words font-semibold text-mast hover:underline">{item.lote.nome}</a>
      : "—" },
    { chave: "aptidao", titulo: "Finalidade", larguraMinima: 100, celula: (item) => item.aptidao ? <Pill tone="brown">{rotuloAptidao(item.aptidao)}</Pill> : "—" },
    { chave: "papel", titulo: "Papel", larguraMinima: 110, celula: (item) => item.papelReprodutivoEstado === "CONFLITO" ? <Pill tone="amber">Papel em revisão</Pill> : item.papelReprodutivo && item.papelReprodutivo !== "NENHUM" ? <Pill tone="amber">{rotuloPapelReprodutivo(item.papelReprodutivo)}</Pill> : "—" },
    { chave: "peso", titulo: "Último peso", larguraMinima: 130, celula: (item) => item.ultimoPeso ? <>{item.ultimoPeso.kg.toLocaleString("pt-BR")} kg<div className="text-sm text-ink-3">{formatarDataBR(item.ultimoPeso.data)}</div></> : "—" },
    { chave: "gmd", titulo: "GMD", larguraMinima: 110, celula: (item) => formatarGmd(item.gmdRecente) },
    ...(!pesagem ? [
      { chave: "reproducao", titulo: "Reprodução", larguraMinima: 175, celula: (item: AnimalResumo) => {
        if (item.sexo === "M") return <span title="Não se aplica">—</span>;
        const situacaoReprodutiva = item.contextoCartao?.situacaoReprodutiva;
        const rotulos: Record<string, string> = { GESTANTE: "Gestante", VAZIA: "Vazia", APTA: "Apta", AGUARDANDO_DIAGNOSTICO: "Aguardando diagnóstico", DESCONHECIDA: "Sem informação" };
        return <Pill tone={situacaoReprodutiva === "GESTANTE" ? "green" : situacaoReprodutiva === "AGUARDANDO_DIAGNOSTICO" ? "amber" : "neutral"}>{rotulos[situacaoReprodutiva ?? ""] ?? "Sem informação"}</Pill>;
      } },
      { chave: "del", titulo: "DEL", larguraMinima: 90, celula: (item: AnimalResumo) => {
        const produtivo = item.contextoCartao?.produtivo;
        return item.sexo === "F" && produtivo?.situacaoProdutiva === "LACTANTE" && produtivo.del != null
          ? <span title="Dias em lactação">{produtivo.del.toLocaleString("pt-BR")} dias</span>
          : <span title={item.sexo === "M" ? "Não se aplica" : produtivo?.situacaoProdutiva === "SECA" ? "Sem lactação vigente" : "Sem informação de lactação vigente"}>—</span>;
      } },
    ] : []),
    { chave: "situacao", titulo: "Situação", larguraMinima: 110, celula: (item) => pillSituacao(item.situacao) },
    { chave: "acoes", titulo: "Ações", alinhamento: "direita", larguraMinima: 96, acoes: true, celula: (item) => item.situacao !== "ATIVO" ? null : <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-50" aria-label={`Editar ${item.brinco}`} title="Editar dados" disabled={carregandoEdicaoId === item.id} onClick={() => { void editar(item.id); }}><Pencil size={16} /></button>
      <button type="button" className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label={`Movimentar ${item.brinco}`} title="Movimentar" onClick={() => setMovimentando({ animais: [item], propriedadeId: item.propriedade?.id, loteId: item.lote?.id })}><ArrowRightLeft size={16} /></button>
    </div> },
  ];
  // sem permissão de lançar: sem seleção em massa e sem ações de linha
  const principais = pesagem ? ["selecionar", "brinco", "lote", "categoria", "situacao"] : ["selecionar", "brinco", "categoria", "lote", "reproducao", "del", "situacao", "acoes"];
  const colunasVisiveis = mostrarColunasAdicionais ? COLUNAS_TODAS : principais.flatMap((chave) => COLUNAS_TODAS.filter((c) => c.chave === chave));
  const exibirSituacao = mostrarColunasAdicionais || situacao !== "ATIVO" || multiplos.situacoes.some(s => s !== "ATIVO") || itens.some(item => item.situacao !== "ATIVO");
  const colunasContexto = colunasVisiveis.filter(c => c.chave !== "situacao" || exibirSituacao);
  const COLUNAS = podeLancar ? colunasContexto : colunasContexto.filter((c) => c.chave !== "selecionar" && c.chave !== "acoes");


  return <PaginaFinanceira><div className={pesagem ? undefined : "animais-pagina-refinada"}>
    <PageHeader titulo={pesagem ? "Pesagem e manejo" : <span className="rotina-titulo"><span><VacaIcon/></span>Animais</span>} acao={!pesagem && podeLancar ? <Button onClick={onNovoAnimal}><Plus size={16} /> Novo animal</Button> : undefined} />
    {!pesagem && <NavRebanho ativa="animais" comIcones />}
    <ErrorBox erro={erro} />


    <Panel className="rebanho-lista mt-4 overflow-clip">
      <div className="rebanho-filtros-principais"><BarraConsulta>
        <label className="relative w-full min-w-0 flex-[1_1_240px] sm:w-auto"><Search size={16} className="absolute left-3 top-3 text-ink-3" /><input aria-label="Buscar por brinco ou nome" value={textoBusca} onChange={(e) => setTextoBusca(e.target.value)} placeholder="Buscar por brinco ou nome" className="h-[42px] w-full rounded-lg border border-border bg-white py-2.5 pl-9 pr-3 text-sm" /></label>
        <Button secondary className="consulta-mais-filtros" onClick={abrirFiltros}><Settings2 size={16} /> Filtros</Button>
        <OrdenarConsulta controle={{ campo: opcaoOrdenacao.ordenar, direcao: opcaoOrdenacao.direcao, campos: [{ chave: "brinco", rotulo: "Brinco", tipo: "texto" }, { chave: "ultimoPeso", rotulo: "Último peso", tipo: "numero" }, { chave: "gmd", rotulo: "GMD", tipo: "numero" }, { chave: "nascimento", rotulo: "Nascimento", tipo: "data" }, { chave: "entrada", rotulo: "Data de entrada", tipo: "data" }], mudar: v => { setOrdenacao(acharOrdenacao(v.campo, v.direcao)); setPagina(1); setSelecionados(new Map()); }, restaurar: () => { setOrdenacao(ORDENACAO_PADRAO); setPagina(1); setSelecionados(new Map()); } }} />
      </BarraConsulta>
      <div className="flex flex-wrap gap-2 px-4 py-4" aria-label="Filtros selecionados">{(Object.keys(FAMILIAS) as Familia[]).flatMap(f => multiplos[f].map(v => {
        const nomes: Record<Familia,string> = { propriedadeIds:"Sítio",loteIds:"Lote",categoriaIds:"Categoria",aptidoes:"Finalidade",papeisReprodutivos:"Papel",situacoes:"Situação",sexos:"Sexo",origens:"Origem",racaIds:"Raça" };
        const nome = catalogos?.propriedades.find(p => String(p.id)===v)?.nome ?? catalogos?.lotes.find(l=>l.id===v)?.nome ?? categorias.find(c=>c.id===v)?.nome ?? catalogos?.racas.find(r=>r.id===v)?.nome ?? ({ATIVO:"Ativos",BAIXADO:"Baixados",F:"Fêmeas",M:"Machos",NASCIDO:"Nascido",COMPRADO:"Comprado",LEITE:"Leite",CORTE:"Corte",REPRODUCAO:"Reprodução",NENHUM:"Nenhum",DOADORA:"Doadora",RECEPTORA:"Receptora"} as Record<string,string>)[v] ?? "Selecionado";
        return <button key={f+v} type="button" className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm" aria-label={`Remover filtro: ${nomes[f]}: ${nome}`} onClick={()=>{if(f==="propriedadeIds"){setLoteId("");setSelecionados(new Map());}setMultiplos(m=>({...m,[f]:m[f].filter(x=>x!==v),...(f==="propriedadeIds"?{loteIds:[]}: {})}));setPagina(1);}}>{nomes[f]}: {nome} ×</button>;
      }))}{filtrosAtivos.map(f => <button key={f.rotulo} type="button" onClick={f.limpar} aria-label={`Remover filtro: ${f.rotulo}`} className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-ink-2">{f.rotulo} <span aria-hidden="true">×</span></button>)}</div>
      {!pesagem && podeLancar && itensSelecionaveis.length > 0 && <label className="animais-selecionar-todos"><input className="animal-checkbox" type="checkbox" aria-label="Selecionar todos os animais desta página" ref={el => { if (el) el.indeterminate = !todosDaPaginaSelecionados && itensSelecionaveis.some(item => selecionados.has(item.id)); }} checked={todosDaPaginaSelecionados} onChange={alternarSelecaoTodos} /> Selecionar todos</label>}</div>
      {podeLancar && itensSelecionaveis.length > 0 && (pesagem || selecionados.size > 0) && <div className="animais-acoes-coletivas flex flex-wrap items-center gap-3 border-b border-border bg-surface-2 px-4 py-2.5 text-sm">
        {selecionados.size > 0 && <><Button secondary={!pesagem} onClick={() => setPesando(true)}>Pesagem coletiva</Button>{!pesagem && <><Button secondary onClick={() => setAplicando(true)}>Aplicação sanitária coletiva</Button><Button secondary onClick={() => setColetivoSanitario("exame")}>Coleta coletiva</Button><Button secondary onClick={() => setColetivoSanitario("protocolo")}>Protocolos coletivos</Button></>}</>}
        {pesagem && <label className="flex items-center gap-2 font-medium"><input className="animal-checkbox" type="checkbox" aria-label="Selecionar todos os animais desta página" ref={el => { if (el) el.indeterminate = !todosDaPaginaSelecionados && itensSelecionaveis.some(item => selecionados.has(item.id)); }} checked={todosDaPaginaSelecionados} onChange={alternarSelecaoTodos} /> Selecionar todos</label>}
        {selecionados.size > 0 && <><span className="text-ink-3">{selecionados.size} selecionado{selecionados.size === 1 ? "" : "s"}</span><Button secondary onClick={() => setSelecionados(new Map())}>Limpar seleção</Button>{!pesagem && <Button onClick={() => setMovimentando({ animais: [...selecionados.values()] })}>Movimentar {selecionados.size} {selecionados.size === 1 ? "animal" : "animais"}</Button>}</>}
      </div>}
      {!pesagem && <div className="consulta-visual-barra"><span>{total} animais na consulta</span><AlternarVisualizacaoConsulta {...visual} rotulo="Visualização dos animais" /></div>}
      {carregando ? <p role="status" className="p-5 text-sm text-ink-3">Atualizando animais…</p> : erro && !itens.length ? <Empty>Não foi possível carregar os animais.</Empty> : itens.length ? <>
        {!pesagem && visual.modo === "visual" ? <div className="consulta-entidades animais-cartoes">{itens.map(item => <CartaoAnimal key={item.id} animal={item} onAbrir={() => onAbrirAnimal(item.id)} selecionado={selecionados.has(item.id)} selecao={podeLancar ? COLUNAS_TODAS.find(c => c.chave === "selecionar")?.celula(item) : undefined} acoes={podeLancar ? COLUNAS_TODAS.find(c => c.chave === "acoes")?.celula(item) : undefined}/>)}</div> : <TabelaFinanceira visualizacao={pesagem ? undefined : "tabela"} ordenacao={{ campo: opcaoOrdenacao.ordenar === "ultimoPeso" ? "peso" : opcaoOrdenacao.ordenar, direcao: opcaoOrdenacao.direcao }} filtrosColunas={filtrosColunas} rotulo="Animais" itens={itens} colunas={COLUNAS} chaveDe={(item) => item.id} onAbrir={(item) => onAbrirAnimal(item.id)} cartaoComLinks />}
        <Paginacao paginaAtual={pagina} totalPaginas={totalPaginas} totalItens={total} itensPorPagina={ITENS_POR_PAGINA} onPaginaChange={setPagina} rotulo="animais" idSelect="pagina-animais" />
      </> : <Empty>Nenhum animal encontrado com os filtros selecionados.</Empty>}
    </Panel>

    {filtrosAbertos && rascunho && <PainelFiltros amplo aberto onAbertoChange={setFiltrosAbertos} onAplicar={aplicarFiltros} onLimpar={limparRascunho} temFiltros>
      <div className="pec-filtros-animais filtros-modal-grade">
        {sitioGlobal == null && campoMultiplo("propriedadeIds", "Sítio", catalogos?.propriedades.map(p => ({ value: String(p.id), label: p.nome })) ?? [])}
        {campoMultiplo("loteIds", "Lote", lotesDoSitio.map(l => ({ value: l.id, label: l.nome })))}
        {campoMultiplo("categoriaIds", "Categoria", categorias.map(c => ({ value: c.id, label: rotuloOpcaoCategoria(categorias, c) })))}
        {campoMultiplo("situacoes", "Situação", [{value:"ATIVO",label:"Ativos"},{value:"BAIXADO",label:"Baixados"}])}
        {campoMultiplo("sexos", "Sexo", [{value:"F",label:"Fêmeas"},{value:"M",label:"Machos"}])}
        {campoMultiplo("origens", "Origem", [{value:"NASCIDO",label:"Nascido"},{value:"COMPRADO",label:"Comprado"}])}
        {campoMultiplo("racaIds", "Raça", catalogos?.racas.map(r => ({value:r.id,label:r.nome})) ?? [])}
        <label className="flex min-w-0 flex-col gap-1.5 text-sm">Critério especial de categoria<SelectCampo aria-label="Critério especial de categoria" value={[CATEGORIA_SEM,CATEGORIA_FORCADA].includes(rascunho.categoriaId) ? rascunho.categoriaId : ""} onValueChange={valorSelecionado => { setRascunho(r => r && ({ ...r, categoriaId: valorSelecionado, multiplos: { ...r.multiplos, categoriaIds: [] } })); }}><option value="">Sem critério especial</option><option value={CATEGORIA_SEM}>Sem categoria</option><option value={CATEGORIA_FORCADA}>Só forçadas</option></SelectCampo></label>
        <GrupoCamposFiltro titulo="Idade em meses">
          <CampoFiltro rotulo="Mínima"><input aria-label="Idade mínima (meses)" type="number" min={0} inputMode="numeric" placeholder="Mínima" value={rascunho.idadeMinMeses} onChange={e => editarFiltro("idadeMinMeses", e.target.value)} className="w-full rounded-lg border border-border bg-white px-3" /></CampoFiltro>
          <CampoFiltro rotulo="Máxima"><input aria-label="Idade máxima (meses)" type="number" min={0} inputMode="numeric" placeholder="Máxima" value={rascunho.idadeMaxMeses} onChange={e => editarFiltro("idadeMaxMeses", e.target.value)} className="w-full rounded-lg border border-border bg-white px-3" /></CampoFiltro>
        </GrupoCamposFiltro>
        {campoMultiplo("aptidoes", "Finalidade", [{value:"LEITE",label:"Leite"},{value:"CORTE",label:"Corte"},{value:"REPRODUCAO",label:"Reprodução"}])}
        {campoMultiplo("papeisReprodutivos", "Papel reprodutivo", [{value:"NENHUM",label:"Nenhum"},{value:"RECEPTORA",label:"Receptora"},{value:"DOADORA",label:"Doadora"}])}

        {mostrarBaixaRascunho && <>
          <label className="flex min-w-0 flex-col gap-1.5 text-sm">Tipo de baixa<SelectCampo aria-label="Filtrar por tipo de baixa" value={rascunho.tipoBaixa} onValueChange={(valor) => editarFiltro("tipoBaixa", valor as TipoBaixa | "")} className="h-[42px] w-full min-w-0 rounded-lg border border-border bg-white px-3 text-sm"><option value="">Todos os tipos de baixa</option>{TIPOS_BAIXA_FILTRO.map((t) => <option key={t} value={t}>{rotuloTipoBaixa(t)}</option>)}</SelectCampo></label>
          <GrupoCamposFiltro><CampoFiltro rotulo="Baixa de"><DatePicker aria-label="Baixa de" value={rascunho.baixaDe} onChange={valor => editarFiltro("baixaDe", valor)} /></CampoFiltro><CampoFiltro rotulo="Baixa até"><DatePicker aria-label="Baixa até" value={rascunho.baixaAte} onChange={valor => editarFiltro("baixaAte", valor)} /></CampoFiltro></GrupoCamposFiltro>
        </>}
        <label className="flex min-w-0 flex-col gap-1.5 text-sm text-ink-2">Ordenar por
          <SelectCampo aria-label="Ordenar por" value={rascunho.ordenacao} onValueChange={(valor) => editarFiltro("ordenacao", valor)} className="h-[42px] w-full min-w-0 rounded-lg border border-border bg-white px-3 text-sm">
            {OPCOES_ORDENACAO.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </SelectCampo>
        </label>
          <Button secondary onClick={() => navegarPara("/configuracoes/pecuaria/rebanho/categorias")}>Gerenciar categorias</Button>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rascunho.mostrarColunasAdicionais} onChange={(e) => editarFiltro("mostrarColunasAdicionais", e.target.checked)} /> Mostrar todas as colunas</label>
      </div>
    </PainelFiltros>}
    {editando && <FormDadosAnimal animal={editando} onFechar={() => setEditando(null)} onSalvo={async () => { setEditando(null); await recarregar(); }} />}
    {coletivoSanitario && <FormColetivoSanitario tipo={coletivoSanitario} animais={[...selecionados.values()]} onFechar={() => setColetivoSanitario(null)} onSalvo={() => { setColetivoSanitario(null); setSelecionados(new Map()); void recarregar(); }} />}
    {aplicando && [...selecionados.values()][0]?.propriedade?.id != null && <FormAplicacaoServico animalId={[...selecionados.values()][0].id} propriedadeId={[...selecionados.values()][0].propriedade!.id} animais={[...selecionados.values()].map((a) => ({ id: a.id, brinco: a.brinco, propriedadeId: a.propriedade?.id ?? null }))} onFechar={() => setAplicando(false)} onSalvo={() => { setAplicando(false); setSelecionados(new Map()); void recarregar(); }} />}
    {pesando && <PesagemColetiva animais={[...selecionados.values()]} onFechar={() => setPesando(false)} onSalvo={() => { setPesando(false); setSelecionados(new Map()); void recarregar(); }} />}
    {movimentando && catalogos && <FormMovimentar animais={movimentando.animais} propriedades={catalogos.propriedades} lotes={catalogos.lotes} propriedadeInicial={movimentando.propriedadeId} loteInicial={movimentando.loteId} onFechar={() => setMovimentando(null)} onSalvo={async (resultado) => { setMovimentando(null); setSelecionados(new Map()); await aoMovimentar(resultado); }} />}
  </div></PaginaFinanceira>;
}
