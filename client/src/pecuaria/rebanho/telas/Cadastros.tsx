import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import "./cadastros-operacionais.css";
import { AjudaCampo } from "@/components/Dica";
import { TabelaConsultaLocal } from "@/financeiro/TabelaConsultaLocal";
import { useRascunhoConsulta } from "@/financeiro/useRascunhoConsulta";
import type { CampoConsulta } from "@/financeiro/FiltroColunaConsulta";
// Cadastros do Rebanho — sub-abas locais Categorias · Raças · Motivos de baixa, no padrão
// visual de ConfiguracoesFinanceiras.tsx (tabela + AcoesLinha + ConfirmDialog + PainelCadastro
// para o form). Cada aba carrega sua própria lista (services/pecuaria/rebanho/*). Lotes têm tela
// própria (ListaLotes.tsx).
//
// Categorias tem um fluxo à parte: toda mutação (criar/editar/ativar/desativar/reordenar/
// restaurar padrões) primeiro SIMULA o impacto (POST /categorias/simular) contra a lista
// completa de regras como ficaria; se algum animal muda de categoria (ou o total sem categoria
// muda), mostra um ConfirmDialog com a lista de mudanças antes de aplicar de verdade — sem
// mudança, aplica direto. O painel do formulário fica aberto atrás do ConfirmDialog até a
// operação terminar (sucesso fecha os dois; erro fecha só o diálogo, o painel continua para
// o usuário corrigir).

import { useCallback, useEffect, useRef, useState } from "react";
import { Dna, FlaskConical, History, LogOut, Pencil, Plus, Tags, Users } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Loader } from "@/components/Loading";
import { AcoesLinha, Button, type ColunaTabela, Empty, ErrorBox, PageHeader, PaginaFinanceira, Panel, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { SubAbas } from "../ui";
import { NavRebanho } from "./NavRebanho";
import { AlteracoesCadastro } from "../components/AlteracoesCadastro";
import {
  criarCategoria, editarCategoria, editarGenitor, editarMotivoBaixa, editarRaca, listarCategorias, listarGenitores,
  listarMaterialGenetico, listarMotivosBaixa, listarRacas, obterCatalogos, reordenarCategorias, restaurarPadroesCategorias, simularCategorias, RebanhoApiError,
} from "../api";
import type { CatalogoRaca, CategoriaDTO, ClasseMotivoBaixa, GenitorDTO, ListarCategoriasResultado, MaterialGeneticoDTO, MotivoBaixa, Raca, RegraCategoriaProposta, ResultadoSimulacaoCategorias } from "../types";
import { rotuloClasseMotivo, rotuloSexo } from "../lib/rotulos";
import { FormMotivoBaixa } from "../cadastros/FormMotivoBaixa";
import { FormRaca } from "../cadastros/FormRaca";
import { FormGenitor } from "../cadastros/FormGenitor";
import { FormMaterialGenetico } from "../cadastros/FormMaterialGenetico";
import { FormCategoria, type DadosFormCategoria } from "../cadastros/FormCategoria";
import { CadastrosSanitarios } from "../sanidade/CadastrosSanitarios";

export type AbaCadastroRebanho = "categorias" | "racas" | "motivos" | "genitores" | "material-genetico" | "sanidade";
type EntidadePainel = "raca" | "motivo" | "genitor" | "material";
type Painel = { entidade: EntidadePainel; modo: "novo" } | { entidade: EntidadePainel; modo: "editar"; id: string | number } | null;
type PainelCategoria = { modo: "novo" } | { modo: "editar"; categoria: CategoriaDTO } | null;
type Confirmacao =
  | { tipo: "raca"; item: Raca }
  | { tipo: "motivo"; item: MotivoBaixa }
  | { tipo: "genitor"; item: GenitorDTO }
  | null;
/** confirmação de impacto de uma mudança nas categorias — `aplicar` já vem fechada sobre a ação */
type ConfirmacaoCategoria = { resultado: ResultadoSimulacaoCategorias; aplicar: () => Promise<unknown> } | null;

function mensagemErro(e: unknown): string {
  return e instanceof RebanhoApiError ? e.message : e instanceof Error ? e.message : String(e);
}

function paraProposta(c: CategoriaDTO): RegraCategoriaProposta {
  return { id: c.id, nome: c.nome, sexo: c.sexo, automatica: c.automatica, ativo: c.ativo, ordem: c.ordem, idadeMinMeses: c.idadeMinMeses, idadeMaxMeses: c.idadeMaxMeses, partos: c.partos };
}

const colunasCategorias = (
  exibidas: CategoriaDTO[],
  editar: (c: CategoriaDTO) => void,
  alternar: (c: CategoriaDTO) => void,
  mover: (c: CategoriaDTO, direcao: -1 | 1) => void,
): ColunaTabela<CategoriaDTO>[] => [
  { chave: "nome", titulo: "Nome", larguraMinima: 180, principal: true, celula: (c) => <><strong className="break-words">{c.nome}</strong>{c.padrao && <div className="mt-1"><Pill tone="blue">Padrão</Pill></div>}</> },
  { chave: "regra", titulo: "Regra / sexo", larguraMinima: 220, larguraFlexivel: true, celula: (c) => <><span className="break-words">{c.regra}</span><div className="text-sm text-ink-3">{rotuloSexo(c.sexo)}</div></> },
  { chave: "animais", titulo: "Animais ativos", alinhamento: "centro", larguraMinima: 140, celula: (c) => <><strong>{c.animaisAtivos}</strong><div className="text-sm text-ink-3">{c.manuaisAbertas} manuais</div></> },
  { chave: "situacao", titulo: "Situação", alinhamento: "direita", larguraMinima: 100, celula: (c) => <Pill tone={c.ativo ? "green" : "neutral"}>{c.ativo ? "Ativa" : "Inativa"}</Pill> },
  { chave: "acoes", titulo: "Ações", alinhamento: "direita", larguraMinima: 150, acoes: true, celula: (c) => {
    const indice = exibidas.findIndex((x) => x.id === c.id);
    return <AcoesLinha nome={c.nome} ativo={c.ativo} onEditar={() => editar(c)} onAlternar={() => alternar(c)} onSubir={() => mover(c, -1)} onDescer={() => mover(c, 1)} podeSubir={indice > 0} podeDescer={indice >= 0 && indice < exibidas.length - 1} />;
  } },
];

const colunasRacas = (editar: (r: Raca) => void, alternar: (r: Raca) => void): ColunaTabela<Raca>[] => [
  { chave: "raca", titulo: "Raça", larguraMinima: 180, principal: true, celula: (r) => <strong className="break-words">{r.nome}</strong> },
  { chave: "sigla", titulo: "Sigla", alinhamento: "centro", larguraMinima: 90, celula: (r) => <span className="font-mono">{r.sigla}</span> },
  { chave: "tipo", titulo: "Tipo", alinhamento: "centro", larguraMinima: 110, celula: (r) => r.base ? "Base" : "Composta" },
  { chave: "animais", titulo: "Animais ativos", alinhamento: "centro", larguraMinima: 120, celula: (r) => r.animaisAtivos },
  { chave: "situacao", titulo: "Situação", alinhamento: "direita", larguraMinima: 100, celula: (r) => <Pill tone={r.ativo ? "green" : "neutral"}>{r.ativo ? "Ativa" : "Inativa"}</Pill> },
  { chave: "acoes", titulo: "Ações", alinhamento: "direita", larguraMinima: 110, acoes: true, celula: (r) => <AcoesLinha nome={r.nome} ativo={r.ativo} onEditar={() => editar(r)} onAlternar={() => alternar(r)} /> },
];

const colunasMotivos = (editar: (m: MotivoBaixa) => void, alternar: (m: MotivoBaixa) => void): ColunaTabela<MotivoBaixa>[] => [
  { chave: "motivo", titulo: "Motivo", larguraMinima: 210, principal: true, celula: (m) => <strong className="break-words">{m.nome}</strong> },
  { chave: "classe", titulo: "Classe", larguraMinima: 150, celula: (m) => rotuloClasseMotivo(m.classe) },
  { chave: "baixas", titulo: "Baixas", alinhamento: "centro", larguraMinima: 90, celula: (m) => m.baixasValendo },
  { chave: "situacao", titulo: "Situação", alinhamento: "direita", larguraMinima: 100, celula: (m) => <Pill tone={m.ativo ? "green" : "neutral"}>{m.ativo ? "Ativo" : "Inativo"}</Pill> },
  { chave: "acoes", titulo: "Ações", alinhamento: "direita", larguraMinima: 110, acoes: true, celula: (m) => <AcoesLinha nome={m.nome} ativo={m.ativo} onEditar={() => editar(m)} onAlternar={() => alternar(m)} /> },
];

/** ordem das classes na tabela de motivos: descarte voluntário, descarte involuntário, morte. */
const ORDEM_CLASSE: ClasseMotivoBaixa[] = ["DESCARTE_VOLUNTARIO", "DESCARTE_INVOLUNTARIO", "MORTE"];
function compararMotivos(a: MotivoBaixa, b: MotivoBaixa): number {
  const diferenca = ORDEM_CLASSE.indexOf(a.classe) - ORDEM_CLASSE.indexOf(b.classe);
  return diferenca !== 0 ? diferenca : a.nome.localeCompare(b.nome, "pt-BR");
}

const colunasGenitores = (editar: (g: GenitorDTO) => void, alternar: (g: GenitorDTO) => void): ColunaTabela<GenitorDTO>[] => [
  { chave: "nome", titulo: "Nome / identificação", larguraMinima: 200, principal: true, celula: (g) => <><strong className="break-words">{g.nome}</strong><div className="text-sm text-ink-3">{rotuloSexo(g.sexo)} · Código: {g.codigo ?? "—"}</div></> },
  { chave: "fornecedor", titulo: "Fornecedor", larguraMinima: 140, celula: (g) => g.fornecedor ?? "—" },
  { chave: "composicao", titulo: "Composição", larguraMinima: 150, celula: (g) => <span className="break-words text-ink-3">{g.composicaoRotulo || "—"}{g.composicao.length > 0 && <span className="block text-sm">Raças: {g.composicao.map(r => r.nome).join(", ")}</span>}</span> },
  { chave: "filhos", titulo: "Filhos", alinhamento: "centro", larguraMinima: 90, celula: (g) => g.filhos },
  { chave: "situacao", titulo: "Situação", alinhamento: "direita", larguraMinima: 100, celula: (g) => <Pill tone={g.ativo ? "green" : "neutral"}>{g.ativo ? "Ativo" : "Inativo"}</Pill> },
  { chave: "acoes", titulo: "Ações", alinhamento: "direita", larguraMinima: 110, acoes: true, celula: (g) => <AcoesLinha nome={g.nome} ativo={g.ativo} onEditar={() => editar(g)} onAlternar={() => alternar(g)} /> },
];

function nomeGenitorMaterial(g: MaterialGeneticoDTO["touro"] | MaterialGeneticoDTO["doadora"]): string {
  if (!g) return "—";
  return g.tipo === "ANIMAL" ? (g.nome ? `${g.brinco} ${g.nome}` : g.brinco) : g.nome;
}

const ROTULO_TIPO_MATERIAL: Record<MaterialGeneticoDTO["tipo"], string> = { SEMEN: "Sêmen", EMBRIAO: "Embrião" };
const ROTULO_TIPO_SEMEN: Record<string, string> = { CONVENCIONAL: "Convencional", SEXADO_FEMEA: "Sexado fêmea", SEXADO_MACHO: "Sexado macho" };

function rotuloSaldoMaterial(m: MaterialGeneticoDTO): string {
  if (m.saldo === null) return "Sem estoque";
  const unidade = m.tipo === "EMBRIAO" ? (m.saldo === 1 ? "embrião" : "embriões") : (m.saldo === 1 ? "dose" : "doses");
  return `${m.saldo} ${unidade}`;
}

const colunasMaterial = (editar: (m: MaterialGeneticoDTO) => void): ColunaTabela<MaterialGeneticoDTO>[] => [
  { chave: "produto", titulo: "Produto", larguraMinima: 200, principal: true, celula: (m) => <strong className="break-words">{m.produto.nome}</strong> },
  { chave: "tipo", titulo: "Tipo", larguraMinima: 140, celula: (m) => <>{ROTULO_TIPO_MATERIAL[m.tipo]}{m.tipoSemen && <div className="text-sm text-ink-3">{ROTULO_TIPO_SEMEN[m.tipoSemen] ?? m.tipoSemen}</div>}</> },
  { chave: "touro", titulo: "Touro", larguraMinima: 150, celula: (m) => nomeGenitorMaterial(m.touro) },
  { chave: "doadora", titulo: "Doadora", larguraMinima: 150, celula: (m) => m.tipo === "EMBRIAO" && !m.doadora ? "Não informada" : nomeGenitorMaterial(m.doadora) },
  { chave: "saldo", titulo: "Saldo", alinhamento: "direita", larguraMinima: 110, celula: (m) => rotuloSaldoMaterial(m) },
  { chave: "situacao", titulo: "Situação", alinhamento: "direita", larguraMinima: 100, celula: (m) => <Pill tone={m.produto.ativo ? "green" : "neutral"}>{m.produto.ativo ? "Ativo" : "Inativo"}</Pill> },
  { chave: "acoes", titulo: "Ações", alinhamento: "direita", larguraMinima: 90, acoes: true, celula: (m) => <div className="flex justify-end"><button type="button" onClick={(e) => { e.stopPropagation(); editar(m); }} title="Editar" aria-label={`Editar ${m.produto.nome}`} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 hover:text-ink"><Pencil size={16} /></button></div> },
];

function mensagemDesativar(confirmacao: NonNullable<Confirmacao>): string {
  if (confirmacao.tipo === "raca") return "A raça deixa de aparecer para novos cadastros e composições raciais. Composições já registradas continuam intactas.";
  if (confirmacao.tipo === "genitor") return "O genitor deixa de aparecer para novas filiações. Filiações já registradas continuam intactas.";
  return "O motivo deixa de aparecer para novas baixas. Baixas já registradas continuam intactas.";
}

export function Cadastros({ podeLancar = true, cadastro, embutido = false }: { podeLancar?: boolean; cadastro?: AbaCadastroRebanho; embutido?: boolean }) {
  const parametrosIniciais = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const [materialInicial, setMaterialInicial] = useState(() => parametrosIniciais.get("material"));
  const abaInicial = parametrosIniciais.get("aba");
  const [aba, setAba] = useState<AbaCadastroRebanho>(cadastro ?? (abaInicial === "material-genetico" || materialInicial ? "material-genetico" : abaInicial === "genitores" ? "genitores" : "categorias"));
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [mostrarInativos, setMostrarInativos] = useState(() => Boolean(materialInicial) || new URLSearchParams(window.location.search).has("busca"));
  const [racas, setRacas] = useState<Raca[] | null>(null);
  const [motivos, setMotivos] = useState<MotivoBaixa[] | null>(null);
  const [genitores, setGenitores] = useState<GenitorDTO[] | null>(null);
  const [materiais, setMateriais] = useState<MaterialGeneticoDTO[] | null>(null);
  const [racasCatalogo, setRacasCatalogo] = useState<CatalogoRaca[]>([]);
  const [painel, setPainel] = useState<Painel>(null);
  const [confirmando, setConfirmando] = useState<Confirmacao>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const emCurso = useRef(false);
  const deepLinkConsumido = useRef(false);

  useEffect(() => {
    const restaurar = () => { deepLinkConsumido.current = false; setPainel(null); setMaterialInicial(new URLSearchParams(window.location.search).get("material")); if (new URLSearchParams(window.location.search).has("busca") || new URLSearchParams(window.location.search).has("material")) setMostrarInativos(true); };
    window.addEventListener("popstate", restaurar);
    return () => window.removeEventListener("popstate", restaurar);
  }, []);

  const fecharMaterial = () => {
    setPainel(null);
    setMaterialInicial(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("material");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  };

  // ---------- categorias ----------
  const [categorias, setCategorias] = useState<CategoriaDTO[] | null>(null);
  const [semCategoriaAtual, setSemCategoriaAtual] = useState(0);
  const [sobrepostas, setSobrepostas] = useState<NonNullable<ListarCategoriasResultado["sobrepostas"]>>([]);
  const [painelCategoria, setPainelCategoria] = useState<PainelCategoria>(null);
  const [confirmacaoCategoria, setConfirmacaoCategoria] = useState<ConfirmacaoCategoria>(null);
  const [simulando, setSimulando] = useState(false);
  const [aplicando, setAplicando] = useState(false);

  const carregarRacas = useCallback(() => listarRacas({ incluirInativos: mostrarInativos }).then(setRacas).catch((e) => setErro(e.message)), [mostrarInativos]);
  const carregarMotivos = useCallback(() => listarMotivosBaixa({ incluirInativos: mostrarInativos }).then(setMotivos).catch((e) => setErro(e.message)), [mostrarInativos]);
  const carregarGenitores = useCallback(() => listarGenitores({ incluirInativos: mostrarInativos }).then(setGenitores).catch((e) => setErro(mensagemErro(e))), [mostrarInativos]);
  const carregarMateriais = useCallback(() => listarMaterialGenetico({ incluirInativos: mostrarInativos }).then(setMateriais).catch((e) => setErro(mensagemErro(e))), [mostrarInativos]);
  useEffect(() => { obterCatalogos().then((c) => setRacasCatalogo(c.racas)).catch(() => undefined); }, []);
  /** sempre traz ativas e inativas — a simulação precisa da lista completa; "Mostrar inativas" só filtra a tabela. */
  const carregarCategorias = useCallback(() => listarCategorias({ incluirInativos: true }).then((r) => { setCategorias(r.itens); setSemCategoriaAtual(r.semCategoria); setSobrepostas(r.sobrepostas ?? []); }).catch((e) => setErro(mensagemErro(e))), []);

  useEffect(() => {
    if (aba === "racas") carregarRacas();
    else if (aba === "motivos") carregarMotivos();
    else if (aba === "genitores") carregarGenitores();
    else if (aba === "material-genetico") carregarMateriais();
    else carregarCategorias();
  }, [aba, carregarRacas, carregarMotivos, carregarGenitores, carregarMateriais, carregarCategorias]);

  useEffect(() => {
    if (deepLinkConsumido.current || !materialInicial || materiais === null || !podeLancar) return;
    deepLinkConsumido.current = true;
    if (materiais.some((material) => material.id === materialInicial)) setPainel({ entidade: "material", modo: "editar", id: materialInicial });
    else setErro("Material genético não encontrado.");
  }, [materialInicial, materiais, podeLancar]);

  /* sobe a cada escrita — o "Histórico de alterações" da sub-aba recarrega junto com a tabela */
  const [alteracoesToken, setAlteracoesToken] = useState(0);
  const recarregarAtual = useCallback(async () => {
    setAlteracoesToken((t) => t + 1);
    if (aba === "racas") await carregarRacas();
    else if (aba === "motivos") await carregarMotivos();
    else if (aba === "genitores") await carregarGenitores();
    else if (aba === "material-genetico") await carregarMateriais();
    else await carregarCategorias();
  }, [aba, carregarRacas, carregarMotivos, carregarGenitores, carregarMateriais, carregarCategorias]);

  const executar = async (acao: () => Promise<unknown>) => {
    if (emCurso.current) return;
    emCurso.current = true; setProcessando(true); setErro(null);
    try { await acao(); await recarregarAtual(); }
    catch (e) { setConfirmando(null); setErro(mensagemErro(e)); }
    finally { emCurso.current = false; setProcessando(false); }
  };

  const trocarAba = (nova: AbaCadastroRebanho) => { setHistoricoAberto(false); setAba(nova); setMostrarInativos(false); setPainel(null); setConfirmando(null); setPainelCategoria(null); setConfirmacaoCategoria(null); setErro(null); };
  const abrirNovo = (entidade: EntidadePainel) => { if (!emCurso.current) setPainel({ entidade, modo: "novo" }); };
  const editar = (entidade: EntidadePainel, item: { id: string | number }) => { if (!emCurso.current) setPainel({ entidade, modo: "editar", id: item.id }); };

  const alternarRaca = (r: Raca) => { if (emCurso.current) return; if (r.ativo) { setConfirmando({ tipo: "raca", item: r }); return; } void executar(() => editarRaca(r.id, { ativo: true })); };
  const alternarMotivo = (m: MotivoBaixa) => { if (emCurso.current) return; if (m.ativo) { setConfirmando({ tipo: "motivo", item: m }); return; } void executar(() => editarMotivoBaixa(m.id, { ativo: true })); };
  const alternarGenitor = (g: GenitorDTO) => { if (emCurso.current) return; if (g.ativo) { setConfirmando({ tipo: "genitor", item: g }); return; } void executar(() => editarGenitor(g.id, { ativo: true })); };

  const confirmarDesativacao = () => {
    if (!confirmando) return;
    void executar(async () => {
      if (confirmando.tipo === "raca") await editarRaca(confirmando.item.id, { ativo: false });
      else if (confirmando.tipo === "genitor") await editarGenitor(confirmando.item.id, { ativo: false });
      else await editarMotivoBaixa(confirmando.item.id, { ativo: false });
      setConfirmando(null);
    });
  };

  const aoSalvar = async () => { setPainel(null); await recarregarAtual(); };

  // ---------- categorias: simular → confirmar (se houver mudança) → aplicar ----------

  /** `simular` monta o pedido de simulação (lista completa de regras, ou a chamada dedicada de
   *  restaurar padrões); `aplicar` só roda depois de confirmado (ou direto, se nada muda). */
  const comSimulacao = async (simular: () => Promise<ResultadoSimulacaoCategorias>, aplicar: () => Promise<unknown>) => {
    if (simulando || aplicando) return;
    setSimulando(true); setErro(null);
    try {
      const resultado = await simular();
      if (resultado.afetados > 0 || resultado.semCategoria !== semCategoriaAtual) {
        setConfirmacaoCategoria({ resultado, aplicar });
      } else {
        await aplicar();
        setPainelCategoria(null);
        setAlteracoesToken((t) => t + 1);
        await carregarCategorias();
      }
    } catch (e) { setErro(mensagemErro(e)); }
    finally { setSimulando(false); }
  };

  const confirmarAplicacaoCategoria = async () => {
    if (!confirmacaoCategoria) return;
    setAplicando(true); setErro(null);
    try {
      await confirmacaoCategoria.aplicar();
      setConfirmacaoCategoria(null);
      setPainelCategoria(null);
      setAlteracoesToken((t) => t + 1);
      await carregarCategorias();
    } catch (e) {
      setConfirmacaoCategoria(null);
      setErro(mensagemErro(e));
    } finally { setAplicando(false); }
  };

  const categoriasExibidas = (categorias ?? []).filter((c) => mostrarInativos || c.ativo);

  const salvarCategoria = (dados: DadosFormCategoria) => {
    if (!categorias) return;
    const alvo = painelCategoria?.modo === "editar" ? painelCategoria.categoria : null;
    const propostas: RegraCategoriaProposta[] = alvo
      ? categorias.map((c) => (c.id === alvo.id ? { ...paraProposta(c), ...dados } : paraProposta(c)))
      : [...categorias.map(paraProposta), { ...dados, ativo: true, ordem: Math.max(0, ...categorias.map((c) => c.ordem)) + 10 }];
    const aplicar = alvo ? () => editarCategoria(alvo.id, dados) : () => criarCategoria(dados);
    void comSimulacao(() => simularCategorias(propostas), aplicar);
  };

  const alternarCategoria = (c: CategoriaDTO) => {
    if (!categorias || emCurso.current) return;
    const novoAtivo = !c.ativo;
    const propostas = categorias.map((x) => (x.id === c.id ? { ...paraProposta(x), ativo: novoAtivo } : paraProposta(x)));
    void comSimulacao(() => simularCategorias(propostas), () => editarCategoria(c.id, { ativo: novoAtivo }));
  };

  const moverCategoria = (categoria: CategoriaDTO, direcao: -1 | 1) => {
    if (!categorias) return;
    const atual = categoriasExibidas.findIndex((c) => c.id === categoria.id);
    const destino = atual + direcao;
    if (atual < 0 || destino < 0 || destino >= categoriasExibidas.length) return;
    const reordenadas = [...categoriasExibidas];
    [reordenadas[atual], reordenadas[destino]] = [reordenadas[destino], reordenadas[atual]];
    const idsVisiveisNovaOrdem = reordenadas.map((c) => c.id);
    const idsRestantes = categorias.filter((c) => !idsVisiveisNovaOrdem.includes(c.id)).map((c) => c.id);
    const idsFinal = [...idsVisiveisNovaOrdem, ...idsRestantes];
    const propostas = idsFinal.map((id, i) => ({ ...paraProposta(categorias.find((c) => c.id === id)!), ordem: (i + 1) * 10 }));
    void comSimulacao(() => simularCategorias(propostas), () => reordenarCategorias(idsVisiveisNovaOrdem));
  };

  const restaurarPadroes = () => {
    void comSimulacao(() => restaurarPadroesCategorias({ simular: true }), () => restaurarPadroesCategorias({ simular: false }));
  };

  const categoriaSelecionada = painelCategoria?.modo === "editar" ? painelCategoria.categoria : null;

  const racaSelecionada = painel?.entidade === "raca" && painel.modo === "editar" ? (racas ?? []).find((r) => r.id === painel.id) ?? null : null;
  const motivoSelecionado = painel?.entidade === "motivo" && painel.modo === "editar" ? (motivos ?? []).find((m) => m.id === painel.id) ?? null : null;
  const genitorSelecionado = painel?.entidade === "genitor" && painel.modo === "editar" ? (genitores ?? []).find((g) => g.id === painel.id) ?? null : null;
  const materialSelecionado = painel?.entidade === "material" && painel.modo === "editar" ? (materiais ?? []).find((m) => m.id === painel.id) ?? null : null;
  /* key força remount do formulário a cada abertura, zerando o estado local */
  const chavePainel = painel ? `${painel.entidade}-${painel.modo === "editar" ? painel.id : "novo"}` : "fechado";
  const chavePainelCategoria = painelCategoria ? (painelCategoria.modo === "editar" ? `editar-${painelCategoria.categoria.id}` : "novo") : "fechado";

  const acao = !podeLancar ? undefined
    : aba === "sanidade" ? undefined
    : aba === "categorias" ? <div className="flex flex-wrap gap-2"><Button secondary onClick={restaurarPadroes}>Restaurar padrões</Button><Button onClick={() => setPainelCategoria({ modo: "novo" })}><Plus size={16} /> Nova categoria</Button></div>
    : aba === "racas" ? <Button onClick={() => abrirNovo("raca")}><Plus size={16} /> Nova raça</Button>
    : aba === "genitores" ? <Button onClick={() => abrirNovo("genitor")}><Plus size={16} /> Novo genitor externo</Button>
    : aba === "material-genetico" ? <Button onClick={() => abrirNovo("material")}><Plus size={16} /> Novo material genético</Button>
    : <Button onClick={() => abrirNovo("motivo")}><Plus size={16} /> Novo motivo de baixa</Button>;

  const carregando = (aba === "racas" && racas === null) || (aba === "motivos" && motivos === null) || (aba === "categorias" && categorias === null) || (aba === "genitores" && genitores === null) || (aba === "material-genetico" && materiais === null);
  const bloqueado = processando || simulando || aplicando;
  const edicaoSituacao = useRascunhoConsulta({inativos:mostrarInativos},{inativos:false},v=>setMostrarInativos(v.inativos));
  const camposSituacao: CampoConsulta[] = [{chave:"situacao",ativo:mostrarInativos,limpar:edicaoSituacao.limpar,conteudo:<label className="flex items-center gap-2"><input type="checkbox" checked={edicaoSituacao.rascunho.inativos} onChange={e=>edicaoSituacao.editar("inativos",e.target.checked)}/>Mostrar inativos</label>}];
  const motivosExibidos = [...(motivos ?? [])].sort(compararMotivos);
  const racasExibidas = racas ?? [];

  const Moldura = embutido ? "section" : PaginaFinanceira;
  const titulo = { categorias: "Categorias de animais", racas: "Raças", motivos: "Motivos de baixa", genitores: "Genitores externos", "material-genetico": "Materiais genéticos", sanidade: "Sanidade" }[aba];
  const IconeCadastro = { categorias: Tags, racas: Dna, motivos: LogOut, genitores: Users, "material-genetico": FlaskConical, sanidade: FlaskConical }[aba];
  return <Moldura>
    <PageHeader titulo={<span className="rotina-titulo"><span><IconeCadastro aria-hidden/></span>{embutido ? titulo : "Cadastros"}</span>} acao={aba !== "sanidade" ? <div className="cadastro-acoes-cabecalho"><Button secondary onClick={() => setHistoricoAberto(true)}><History size={17} aria-hidden/>Histórico de alterações</Button>{acao}</div> : undefined} />
    {!embutido && <NavRebanho ativa="cadastros" />}
    <ErrorBox erro={painelCategoria ? null : erro} />
    {!embutido && <SubAbas abas={[
      { valor: "categorias", rotulo: "Categorias", icon: Tags },
      { valor: "racas", rotulo: "Raças", icon: Dna },
      { valor: "motivos", rotulo: "Motivos de baixa", icon: LogOut },
      { valor: "genitores", rotulo: "Genitores externos", icon: Users },
      { valor: "material-genetico", rotulo: "Material genético", icon: FlaskConical },
      { valor: "sanidade", rotulo: "Sanidade", icon: FlaskConical },
    ]} ativa={aba} onSelecionar={trocarAba} />}

    {aba === "sanidade" && <CadastrosSanitarios podeLancar={podeLancar} />}
    {carregando
      ? <div className="mt-5"><Loader label={`Carregando ${aba === "categorias" ? "categorias" : aba === "racas" ? "raças" : aba === "genitores" ? "genitores externos" : aba === "material-genetico" ? "material genético" : "motivos de baixa"}`} /></div>
      // os filtros ("Mostrar inativas/os") ficam fora do fieldset de escrita — quem só pode ver
      // continua podendo filtrar (K7); só a tabela (edição/ativação) é desabilitada sem podeLancar.
      : <>
        {aba === "categorias" && <>
          <section className="cadastro-regras-contexto" aria-label="Regras de classificação"><div><h2>Regras de classificação<AjudaCampo rotulo="Sobre as regras de classificação" texto="A primeira regra compatível define a categoria; a escolha manual na ficha tem prioridade até ser desfeita. Evite sobrepor faixas de idade e parto do mesmo sexo. Reordenar pode reclassificar animais: confira a simulação antes de confirmar. “Padrão” identifica regras do IDEAGRI."/></h2><p>A ordem define qual regra se aplica primeiro. Mudanças passam pela simulação antes de reclassificar animais.</p></div><dl><div><dt>Automáticas ativas</dt><dd>{(categorias ?? []).filter(c=>c.ativo&&c.automatica).length}</dd></div><div><dt>Somente manuais ativas</dt><dd>{(categorias ?? []).filter(c=>c.ativo&&!c.automatica).length}</dd></div></dl></section>
          {sobrepostas.length > 0 && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            <strong>Regras sobrepostas:</strong> nesses casos só a primeira da ordem vale e a outra nunca é aplicada. Corrija a faixa de uma delas.
            <ul className="mt-1.5 list-disc pl-5">{sobrepostas.map((par) => <li key={`${par.a.id}-${par.b.id}`}>{par.mensagem}</li>)}</ul>
          </div>}
          {semCategoriaAtual > 0 && <div role="status" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{semCategoriaAtual} {semCategoriaAtual === 1 ? "animal ativo" : "animais ativos"} sem categoria — nenhuma regra casou.</div>}
          <Panel className="mt-4 overflow-hidden">
            <fieldset disabled={bloqueado} aria-busy={bloqueado} className="min-w-0">
              <TabelaConsultaLocal parametroBusca="busca" camposExternos={camposSituacao} edicaoExterna={edicaoSituacao} criteriosExternos={mostrarInativos?[{id:"inativos",rotulo:"Inclui inativos",limpar:()=>setMostrarInativos(false)}]:[]} buscarPor={c=>c.nome} definicoes={[{chave:"nome",rotulo:"Nome",tipo:"texto",obter:c=>c.nome},{chave:"regra",rotulo:"Regra / sexo",tipo:"texto",obter:c=>`${c.regra} ${rotuloSexo(c.sexo)}`} ]} rotulo="Categorias" itens={categoriasExibidas} colunas={colunasCategorias(categoriasExibidas, (c) => setPainelCategoria({ modo: "editar", categoria: c }), alternarCategoria, moverCategoria).filter(c=>podeLancar||!c.acoes)} chaveDe={(c) => c.id} onAbrir={podeLancar ? (c) => setPainelCategoria({ modo: "editar", categoria: c }) : undefined} classeLinha={(c) => !c.ativo ? "opacity-55" : ""} />
            </fieldset>
          </Panel>
        </>}

        {aba === "racas" && <>
          <Panel className="mt-5 overflow-hidden">
            <fieldset disabled={bloqueado} aria-busy={bloqueado} className="min-w-0">
              <TabelaConsultaLocal parametroBusca="busca" camposExternos={camposSituacao} edicaoExterna={edicaoSituacao} criteriosExternos={mostrarInativos?[{id:"inativos",rotulo:"Inclui inativos",limpar:()=>setMostrarInativos(false)}]:[]} buscarPor={r=>`${r.nome} ${r.sigla}`} definicoes={[{chave:"raca",rotulo:"Raça",tipo:"texto",obter:r=>r.nome},{chave:"sigla",naBarra:true,rotulo:"Sigla",tipo:"texto",obter:r=>r.sigla},{chave:"tipo",rotulo:"Tipo",tipo:"opcoes",obter:r=>r.base?"BASE":"COMPOSTA",opcoes:[{valor:"BASE",texto:"Base"},{valor:"COMPOSTA",texto:"Composta"}]}]} rotulo="Raças" itens={racasExibidas} colunas={colunasRacas((r) => editar("raca", r), alternarRaca).filter(c=>podeLancar||!c.acoes)} chaveDe={(r) => r.id} onAbrir={podeLancar ? (r) => editar("raca", r) : undefined} classeLinha={(r) => !r.ativo ? "opacity-55" : ""} />
            </fieldset>
          </Panel>
        </>}

        {aba === "motivos" && <>
          <Panel className="mt-5 overflow-hidden">
            <fieldset disabled={bloqueado} aria-busy={bloqueado} className="min-w-0">
              <TabelaConsultaLocal parametroBusca="busca" camposExternos={camposSituacao} edicaoExterna={edicaoSituacao} criteriosExternos={mostrarInativos?[{id:"inativos",rotulo:"Inclui inativos",limpar:()=>setMostrarInativos(false)}]:[]} buscarPor={m=>`${m.nome} ${rotuloClasseMotivo(m.classe)}`} definicoes={[{chave:"motivo",rotulo:"Motivo",tipo:"texto",obter:m=>m.nome},{chave:"classe",rotulo:"Classe",tipo:"opcoes",obter:m=>m.classe,opcoes:ORDEM_CLASSE.map(valor=>({valor,texto:rotuloClasseMotivo(valor)}))}]} rotulo="Motivos de baixa" itens={motivosExibidos} colunas={colunasMotivos((m) => editar("motivo", m), alternarMotivo).filter(c=>podeLancar||!c.acoes)} chaveDe={(m) => m.id} onAbrir={podeLancar ? (m) => editar("motivo", m) : undefined} classeLinha={(m) => !m.ativo ? "opacity-55" : ""} />
            </fieldset>
          </Panel>
        </>}

        {aba === "genitores" && <>
          <Panel className="mt-5 overflow-hidden">
            <fieldset disabled={bloqueado} aria-busy={bloqueado} className="min-w-0">
              <TabelaConsultaLocal parametroBusca="busca" camposExternos={camposSituacao} edicaoExterna={edicaoSituacao} criteriosExternos={mostrarInativos?[{id:"inativos",rotulo:"Inclui inativos",limpar:()=>setMostrarInativos(false)}]:[]} buscarPor={g=>`${g.nome} ${g.codigo??""} ${g.fornecedor??""}`} definicoes={[{chave:"nome",rotulo:"Nome / identificação",tipo:"texto",obter:g=>`${g.nome} ${g.codigo??""}`},{chave:"fornecedor",naBarra:true,rotulo:"Fornecedor",tipo:"texto",obter:g=>g.fornecedor},{chave:"composicao",rotulo:"Composição",tipo:"texto",obter:g=>g.composicaoRotulo}]} rotulo="Genitores externos" itens={genitores ?? []} colunas={colunasGenitores((g) => editar("genitor", g), alternarGenitor).filter(c=>podeLancar||!c.acoes)} chaveDe={(g) => g.id} onAbrir={podeLancar ? (g) => editar("genitor", g) : undefined} classeLinha={(g) => !g.ativo ? "opacity-55" : ""} />
            </fieldset>
          </Panel>
        </>}

        {aba === "material-genetico" && <>
          <Panel className="mt-5 overflow-hidden">
            <fieldset disabled={bloqueado} aria-busy={bloqueado} className="min-w-0">
              {(materiais ?? []).length === 0
                ? <Empty>Sêmen e embrião entram no estoque pela compra (Financeiro › Nova operação). Cadastre aqui de quem é o material.</Empty>
                : <TabelaConsultaLocal parametroBusca="busca" camposExternos={camposSituacao} edicaoExterna={edicaoSituacao} criteriosExternos={mostrarInativos?[{id:"inativos",rotulo:"Inclui inativos",limpar:()=>setMostrarInativos(false)}]:[]} buscarPor={m=>`${m.produto.nome} ${nomeGenitorMaterial(m.touro)} ${nomeGenitorMaterial(m.doadora)}`} definicoes={[{chave:"produto",rotulo:"Produto",tipo:"texto",obter:m=>m.produto.nome},{chave:"tipo",rotulo:"Tipo",tipo:"opcoes",obter:m=>m.tipo,opcoes:Object.entries(ROTULO_TIPO_MATERIAL).map(([valor,texto])=>({valor,texto}))},{chave:"touro",naBarra:true,rotulo:"Touro",tipo:"texto",obter:m=>nomeGenitorMaterial(m.touro)},{chave:"doadora",naBarra:true,rotulo:"Doadora",tipo:"texto",obter:m=>nomeGenitorMaterial(m.doadora)}]} rotulo="Material genético" itens={materiais ?? []} colunas={colunasMaterial((m) => editar("material", m)).filter(c=>podeLancar||!c.acoes)} chaveDe={(m) => m.id} onAbrir={podeLancar ? (m) => editar("material", m) : undefined} classeLinha={(m) => !m.produto.ativo ? "opacity-55" : ""} />}
            </fieldset>
          </Panel>
        </>}
      </>}

    {aba !== "sanidade" && <Dialog open={historicoAberto} onOpenChange={setHistoricoAberto}><DialogContent className="cadastro-historico-dialog" aria-describedby={undefined}><DialogHeader><DialogTitle>Histórico de alterações · {titulo}</DialogTitle></DialogHeader><AlteracoesCadastro key={aba} entidade={{categorias:"CategoriaAnimal",racas:"Raca",motivos:"MotivoBaixa",genitores:"GenitorExterno","material-genetico":"MaterialGenetico"}[aba] as "CategoriaAnimal" | "Raca" | "MotivoBaixa" | "GenitorExterno" | "MaterialGenetico"} recarregarToken={alteracoesToken}/></DialogContent></Dialog>}
    {painel?.entidade === "raca" && <FormRaca key={chavePainel} raca={racaSelecionada} onSalvo={aoSalvar} onFechar={() => setPainel(null)} />}
    {painel?.entidade === "motivo" && <FormMotivoBaixa key={chavePainel} motivo={motivoSelecionado} onSalvo={aoSalvar} onFechar={() => setPainel(null)} />}
    {painel?.entidade === "genitor" && <FormGenitor key={chavePainel} genitor={genitorSelecionado} racas={racasCatalogo} onSalvo={aoSalvar} onFechar={() => setPainel(null)} />}
    {painel?.entidade === "material" && <FormMaterialGenetico key={chavePainel} material={materialSelecionado} onSalvo={async () => { fecharMaterial(); await recarregarAtual(); }} onFechar={fecharMaterial} />}
    {painelCategoria && <FormCategoria key={chavePainelCategoria} categoria={categoriaSelecionada} salvando={simulando || aplicando} erro={erro} onSalvar={salvarCategoria} onFechar={() => { if (!simulando && !aplicando) setPainelCategoria(null); }} />}

    <ConfirmDialog
      open={confirmando !== null}
      title={confirmando ? `Desativar ${confirmando.item.nome}?` : ""}
      message={confirmando ? mensagemDesativar(confirmando) : ""}
      confirmLabel="Desativar"
      cancelLabel="Manter ativo"
      tone="danger"
      processando={processando}
      onConfirm={confirmarDesativacao}
      onCancel={() => setConfirmando(null)}
    />

    <ConfirmDialog
      open={confirmacaoCategoria !== null}
      title="Aplicar esta mudança?"
      message={confirmacaoCategoria && <div className="space-y-1.5">
        {confirmacaoCategoria.resultado.mudancas.map((m, i) => <p key={i}>{m.total} {m.total === 1 ? "animal" : "animais"}: {m.de?.nome ?? "Sem categoria"} → {m.para?.nome ?? "Sem categoria"}</p>)}
        {confirmacaoCategoria.resultado.semCategoria !== semCategoriaAtual && <p>{confirmacaoCategoria.resultado.semCategoria} {confirmacaoCategoria.resultado.semCategoria === 1 ? "animal fica" : "animais ficam"} sem categoria.</p>}
      </div>}
      confirmLabel="Aplicar mudança"
      cancelLabel="Cancelar"
      tone="neutral"
      processando={aplicando}
      onConfirm={() => { void confirmarAplicacaoCategoria(); }}
      onCancel={() => setConfirmacaoCategoria(null)}
    />
  </Moldura>;
}
