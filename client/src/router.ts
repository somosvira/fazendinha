/* Rio Novo — roteamento por URL sem react-router.
 *
 * A navegação continua sendo um `useState<Tab>` em App.tsx (convenção do projeto).
 * Este módulo só faz a ponte bidirecional Tab <-> pathname:
 *  - tabToPath: para refletir a aba ativa na barra de endereço.
 *  - pathToTab: para abrir o app já na aba certa (deep-link / reload / back-forward).
 *
 * Os módulos operacionais têm sub-abas com
 * prefixo (pec-, pla-, mil-, eqp-) e viram caminhos aninhados
 * slug fixo no mapa abaixo.
 */

import type { Tab } from "./components/Shell";
import { ASSISTENTE_ATIVO } from "./featureFlags";

// Fonte única dos caminhos canônicos; Record<Tab, string> obriga toda aba nova
// a declarar sua URL e permite validar subrotas sem listas paralelas.
const PATH_BY_TAB: Record<Tab, string> = {
  gerencial: "/gerencial",
  dashboard: "/financeiro",
  gastos: "/financeiro/compromissos",
  lancar: "/financeiro/operacoes",
  caixinha: "/financeiro/contas",
  plano: "/financeiro/configuracoes/categorias",
  ia: "/ia",
  relatorio: "/financeiro/relatorios",
  acessos: "/acessos",
  config: "/configuracoes",
  sitios: "/configuracoes/sitios",
  cadastros: "/financeiro/configuracoes",
  "pec-rebanho": "/pecuaria/rebanho",
  "pec-sanidade": "/pecuaria/sanidade",
  "pec-nutricao": "/pecuaria/nutricao",
  "pec-leite": "/pecuaria/leite",
  "pec-reproducao": "/pecuaria/reproducao",
  "pec-visitas": "/pecuaria/visitas",
  "pec-relatorios": "/pecuaria/relatorios",
  estoque: "/estoque",
};

const TAB_BY_PATH: Record<string, Tab> = Object.fromEntries(
  Object.entries(PATH_BY_TAB).map(([tab, path]) => [path, tab as Tab]),
) as Record<string, Tab>;

const DEFAULT_TAB_BY_PATH: Record<string, Tab> = {
  "/pecuaria": "pec-rebanho",
};

const TAB_BY_PATH_LEGADO: Record<string, Tab> = {
  "/relatorio": "relatorio",
  "/relatorios": "relatorio",
  "/dashboard": "dashboard",
  "/gastos": "gastos",
  "/lancar": "lancar",
  "/caixinha": "caixinha",
  // O estoque da pecuária legada virou o Estoque único (antes da regex abaixo,
  // que mandaria para o Rebanho).
  "/pecuaria/estoque": "estoque",
  "/rebanho/estoque": "estoque",
};

export const DEFAULT_TAB: Tab = "dashboard";

/** Alias da navegação V3: mantém parâmetros, fragmento e uma única entrada de histórico. */
export function normalizarRotaPecuaria(caminho: string): string {
  const url = new URL(caminho, "https://terrano.internal");
  const path = url.pathname.replace(/\/$/, "").toLowerCase();
  if (path === "/pecuaria/reproducao" && url.searchParams.get("rotina") === "configuracao") {
    url.pathname = "/configuracoes/pecuaria/reproducao/politica";
    url.searchParams.delete("rotina");
  }
  if (path === "/pecuaria/pesagem-manejo") url.pathname = "/pecuaria/rebanho/animais";
  if (path === "/pecuaria/rebanho/sanidade") url.pathname = "/pecuaria/sanidade";
  if (path === "/pecuaria/rebanho/nutricao") url.pathname = "/pecuaria/nutricao";
  if (path === "/pecuaria/rebanho/cadastros") {
    const rebanho: Record<string, string> = { categorias: "rebanho/categorias", motivos: "rebanho/motivos", racas: "genetica/racas", genitores: "genetica/genitores", "material-genetico": "genetica/material-genetico" };
    const sanidade: Record<string, string> = { protocolos: "protocolos", doenca: "doencas", aplicacao: "tipos-aplicacao", exame: "tipos-exame" };
    const aba = url.searchParams.has("material") ? "material-genetico" : url.searchParams.get("aba") ?? "categorias";
    const destino = aba === "sanidade" ? "sanidade/" + (sanidade[url.searchParams.get("cadastroSanitario") ?? "protocolos"] ?? "protocolos") : rebanho[aba] ?? "rebanho/categorias";
    url.pathname = "/configuracoes/pecuaria/" + destino;
    url.searchParams.delete("aba"); url.searchParams.delete("cadastroSanitario");
  }
  return url.pathname + url.search + url.hash;
}
export function normalizarLocalizacaoPecuaria(): void {
  const atual = window.location.pathname + window.location.search + window.location.hash;
  const destino = normalizarRotaPecuaria(atual);
  if (destino !== atual) window.history.replaceState(window.history.state, "", destino);
}
export function isSubrotaPecuaria(tab: Tab, pathname: string): boolean {
  return ["pec-sanidade", "pec-nutricao", "pec-reproducao", "pec-visitas", "pec-relatorios", "pec-leite"].includes(tab) && pathToTab(pathname) === tab
    || tab === "config" && pathname.startsWith("/configuracoes/pecuaria");
}

export type ModoVisita = "agenda" | "livre";
export type EtapaVisita = "entrada" | "planejamento" | "selecao" | "revisao" | "atividade" | "atendimento";
export type RotaVisita =
  | { tipo: "nova" }
  | { tipo: "lista" }
  | { tipo: "visita"; id: string; modo?: ModoVisita; etapa: EtapaVisita | null; grupo: string | null; atividade: string | null };

/** Interpreta as rotas atuais e antigas do fluxo de visitas veterinárias. */
export function parseRotaVisita(pathname: string, search = ""): RotaVisita | null {
  const path = pathname.replace(/\/$/, "");
  if (path === "/pecuaria/visitas/nova") return { tipo: "nova" };
  if (path === "/pecuaria/visitas") return { tipo: "lista" };
  const match = /^\/pecuaria\/visitas\/([^/]+)$/.exec(path);
  if (!match || match[1] === "nova") return null;
  const params = new URLSearchParams(search);
  const etapaParam = params.get("etapa");
  const etapa = ["entrada", "planejamento", "selecao", "revisao", "atividade", "atendimento"].includes(etapaParam ?? "") ? etapaParam as EtapaVisita : null;
  const modo = params.get("modo");
  return { tipo: "visita", id: match[1], ...(modo === "agenda" || modo === "livre" ? { modo } : {}), etapa, grupo: params.get("grupo"), atividade: params.get("atividade") };
}

export function urlEtapaVisita(id: string, etapa: EtapaVisita, opcoes: { grupo?: string; atividade?: string; modo?: ModoVisita } = {}, buscaAtual = ""): string {
  const params = new URLSearchParams(buscaAtual);
  params.delete("etapa"); params.delete("grupo"); params.delete("atividade"); params.delete("modo");
  params.set("etapa", etapa);
  if (opcoes.modo && etapa !== "entrada" && etapa !== "atendimento") params.set("modo", opcoes.modo);
  if (opcoes.grupo) params.set("grupo", opcoes.grupo);
  if (opcoes.atividade) params.set("atividade", opcoes.atividade);
  return `/pecuaria/visitas/${encodeURIComponent(id)}?${params}`;
}


/** Atualiza a URL e notifica o roteador leve da aplicação. */
export function navegarPara(pathname: string): void {
  window.history.pushState(null, "", normalizarRotaPecuaria(pathname));
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function parseContaFinanceiraId(pathname: string): string | null {
  const match = /^\/financeiro\/contas\/([^/]+)\/?$/.exec(pathname);
  return match ? match[1] : null;
}

export function parseProdutoEstoqueId(pathname: string): string | null {
  const match = /^\/estoque\/produtos\/([^/]+)\/?$/i.exec(pathname);
  return match ? match[1] : null;
}

export function parseOperacaoFinanceiraId(pathname: string): string | null {
  const match = /^\/financeiro\/operacoes\/([^/]+)\/?$/.exec(pathname);
  return match && !isNovaOperacaoFinanceira(pathname) ? match[1] : null;
}

export function isNovaOperacaoFinanceira(pathname: string): boolean {
  return /^\/financeiro\/operacoes\/nova\/?$/i.test(pathname);
}

export function isNovoRelatorioFinanceiro(pathname: string): boolean {
  return /^\/financeiro\/relatorios\/novo\/?$/i.test(pathname);
}

export function parseRelatorioFinanceiroId(pathname: string): string | null {
  const match = /^\/financeiro\/relatorios\/([^/]+)\/?$/.exec(pathname);
  return match && !isNovoRelatorioFinanceiro(pathname) ? match[1] : null;
}

/** Subpáginas (detalhe, formulário) que a aba precisa manter na barra de endereço. */
export function isSubrotaFinanceira(tab: Tab, pathname: string): boolean {
  if (tab === "lancar") return parseOperacaoFinanceiraId(pathname) != null || isNovaOperacaoFinanceira(pathname);
  if (tab === "caixinha") return parseContaFinanceiraId(pathname) != null;
  if (tab === "relatorio") return parseRelatorioFinanceiroId(pathname) != null || isNovoRelatorioFinanceiro(pathname);
  return false;
}

// ---------- Pecuária · Rebanho ----------
// A aba "pec-rebanho" é única (não há uma aba por seção como no financeiro),
// então as subpáginas abaixo vivem todas sob o mesmo path canônico
// /pecuaria/rebanho — RebanhoContent decide a tela a partir do pathname.

export function isListaAnimaisRebanho(pathname: string): boolean {
  return /^\/pecuaria\/rebanho\/animais\/?$/i.test(pathname);
}

export function isNovoAnimalRebanho(pathname: string): boolean {
  return /^\/pecuaria\/rebanho\/animais\/novo\/?$/i.test(pathname);
}

export function isCadastrosRebanho(pathname: string): boolean {
  return /^\/pecuaria\/rebanho\/cadastros\/?$/i.test(pathname);
}

export function isListaLotesRebanho(pathname: string): boolean {
  return /^\/pecuaria\/rebanho\/lotes\/?$/i.test(pathname);
}

/** Extrai o id (uuid) de `/pecuaria/rebanho/animais/:id` — null para a lista, "novo" ou qualquer outra subrota. */
export function parseAnimalId(pathname: string): string | null {
  const match = /^\/pecuaria\/rebanho\/animais\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i.exec(pathname);
  return match ? match[1] : null;
}

/** Extrai o id (uuid) de `/pecuaria/rebanho/lotes/:id` — null para a lista ou qualquer outra subrota. */
export function parseLoteId(pathname: string): string | null {
  const match = /^\/pecuaria\/rebanho\/lotes\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i.exec(pathname);
  return match ? match[1] : null;
}

/** Subpáginas do Rebanho que a aba "pec-rebanho" precisa manter na barra de endereço. */
export function isSubrotaRebanho(tab: Tab, pathname: string): boolean {
  if (tab !== "pec-rebanho") return false;
  return isListaAnimaisRebanho(pathname) || isNovoAnimalRebanho(pathname) || isCadastrosRebanho(pathname)
    || isListaLotesRebanho(pathname) || parseAnimalId(pathname) != null || parseLoteId(pathname) != null
    || pathname === "/pecuaria/rebanho/sanidade" || pathname === "/pecuaria/rebanho/nutricao";
}

export const URL_NOVA_OPERACAO = "/financeiro/operacoes/nova";
const ESTADO_NOVA_OPERACAO = { novaOperacao: true } as const;

/** Leva ao formulário de nova operação a partir de qualquer tela. Chame ANTES de
 *  trocar para a aba `lancar`: com a URL já publicada, o efeito de App.tsx que
 *  sincroniza aba -> URL preserva a sub-rota e OperacoesFinanceiras monta com o
 *  formulário aberto. O popstate sintético avisa a tela de operações quando ela
 *  já está montada (lista, detalhe ou correção), porque pushState não dispara o
 *  evento. A marca no estado distingue essa entrada da correção de operação,
 *  que usa a mesma URL. */
export function abrirRotaNovaOperacao(destino?: "PAGAR" | "RECEBER" | { compromisso?: "PAGAR" | "RECEBER"; ajusteEstoqueProdutoId?: string; /** abre o ajuste de estoque sem produto pré-selecionado */ ajusteEstoque?: boolean }) {
  const opcoes = typeof destino === "string" ? { compromisso: destino } : destino ?? {};
  const params = new URLSearchParams();
  if (opcoes.compromisso) params.set("compromisso", opcoes.compromisso);
  // Atalho da tela de Estoque: abre a operação "Ajuste de estoque" já com o produto escolhido.
  if (opcoes.ajusteEstoqueProdutoId || opcoes.ajusteEstoque) {
    params.set("tipo", "AJUSTE_ESTOQUE");
    if (opcoes.ajusteEstoqueProdutoId) params.set("produto", opcoes.ajusteEstoqueProdutoId);
  }
  const consulta = params.toString();
  const alvo = consulta ? `${URL_NOVA_OPERACAO}?${consulta}` : URL_NOVA_OPERACAO;
  if (window.location.pathname + window.location.search !== alvo) window.history.pushState(ESTADO_NOVA_OPERACAO, "", alvo);
  window.dispatchEvent(new PopStateEvent("popstate", { state: ESTADO_NOVA_OPERACAO }));
}

/** A entrada do histórico foi criada por `abrirRotaNovaOperacao`. */
export function entradaDeNovaOperacao(estado: unknown): boolean {
  return !!estado && typeof estado === "object" && (estado as { novaOperacao?: unknown }).novaOperacao === true;
}

/** Aba ativa -> pathname canônico para a barra de endereço. */
export function tabToPath(tab: Tab): string {
  return PATH_BY_TAB[tab];
}

/** pathname -> aba (ou null se não casar com nenhuma rota conhecida). */
export function pathToTab(pathname: string): Tab | null {
  // normaliza: minúsculas e sem barra final (exceto raiz)
  let path = pathname.toLowerCase();
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

  if (path === "/" || path === "") return DEFAULT_TAB;
  if (path === "/ia" && !ASSISTENTE_ATIVO) return DEFAULT_TAB;
  if (path === "/pecuaria/rebanho/sanidade") return "pec-sanidade";
  if (path === "/pecuaria/rebanho/nutricao") return "pec-nutricao";
  if (path === "/pecuaria/rebanho/cadastros" || path.startsWith("/configuracoes/pecuaria")) return "config";
  if (path.startsWith("/pecuaria/reproducao/")) return "pec-reproducao";
  if (path.startsWith("/pecuaria/visitas/")) return "pec-visitas";
  if (path.startsWith("/pecuaria/leite/")) return "pec-leite";
  if (parseProdutoEstoqueId(path) != null) return "estoque";
  if (parseContaFinanceiraId(path) != null) return "caixinha";
  if (parseOperacaoFinanceiraId(path) != null) return "lancar";
  if (isNovaOperacaoFinanceira(path)) return "lancar";
  if (isNovoRelatorioFinanceiro(path) || parseRelatorioFinanceiroId(path) != null) return "relatorio";

  const tab = DEFAULT_TAB_BY_PATH[path] ?? TAB_BY_PATH[path] ?? TAB_BY_PATH_LEGADO[path];
  if (tab) return tab;
  // Pecuária legada (rebanho/corte removidos): /rebanho/*, /corte/* e as antigas
  // subrotas /pecuaria/* (inclusive /pecuaria/lotes/*) caem no Rebanho v1.
  if (/^\/(rebanho|corte|pecuaria)(\/|$)/.test(path)) return "pec-rebanho";
  return null;
}
