/* Rio Novo — roteamento por URL sem react-router.
 *
 * A navegação continua sendo um `useState<Tab>` em App.tsx (convenção do projeto).
 * Este módulo só faz a ponte bidirecional Tab <-> pathname:
 *  - tabToPath: para refletir a aba ativa na barra de endereço.
 *  - pathToTab: para abrir o app já na aba certa (deep-link / reload / back-forward).
 *
 * Os módulos operacionais têm sub-abas com
 * prefixo (reb-, pla-, cor-, mil-, eqp-) e viram caminhos aninhados
 * /pecuaria/<sub>, /plantio/<sub>, etc. As abas financeiras/administração têm
 * slug fixo no mapa abaixo.
 */

import type { Tab } from "./components/Shell";
import { ASSISTENTE_ATIVO } from "./featureFlags";
import { entityIdSchema, type EntityId } from "@fazendinha/shared";

// Fonte única dos caminhos canônicos; Record<Tab, string> obriga toda aba nova
// a declarar sua URL e permite validar subrotas sem listas paralelas.
const PATH_BY_TAB: Record<Tab, string> = {
  dashboard: "/financeiro",
  gastos: "/financeiro/compromissos",
  lancar: "/financeiro/operacoes",
  caixinha: "/financeiro/contas",
  plano: "/financeiro/configuracoes/categorias",
  ia: "/ia",
  relatorio: "/financeiro/relatorios",
  acessos: "/acessos",
  config: "/configuracoes",
  cadastros: "/financeiro/configuracoes",
  "reb-dashboard": "/pecuaria/dashboard",
  "reb-animal": "/pecuaria/animal",
  "reb-reproducao": "/pecuaria/reproducao",
  "reb-acasalamento": "/pecuaria/acasalamento",
  "reb-fiv": "/pecuaria/fiv",
  "reb-relatorios": "/pecuaria/relatorios",
  "reb-sanidade": "/pecuaria/sanidade",
  "reb-nutricao": "/pecuaria/nutricao",
  "reb-producao": "/pecuaria/producao",
  "reb-estoque": "/pecuaria/estoque",
  "reb-custo": "/pecuaria/custo",
  "reb-carteira": "/pecuaria/carteira",
  "reb-sugestoes": "/pecuaria/sugestoes",
  "pla-dashboard": "/plantio/dashboard",
  "pla-talhao": "/plantio/talhao",
  "pla-fenologia": "/plantio/fenologia",
  "pla-fitossanidade": "/plantio/fitossanidade",
  "pla-nutricao": "/plantio/nutricao",
  "pla-colheita": "/plantio/colheita",
  "pla-planejamento": "/plantio/planejamento",
  "pla-estoque": "/plantio/estoque",
  "pla-custo": "/plantio/custo",
  "cor-dashboard": "/pecuaria/lotes/resumo",
  "cor-lote": "/pecuaria/lotes",
  "cor-pesagem": "/pecuaria/lotes/pesagens",
  "cor-pasto": "/pecuaria/lotes/pasto",
  "cor-sanidade": "/pecuaria/lotes/sanidade",
  "cor-nutricao": "/pecuaria/lotes/nutricao",
  "cor-comercial": "/pecuaria/lotes/comercializacao",
  "cor-custo": "/pecuaria/lotes/custos",
  "eqp-dashboard": "/equipe/dashboard",
  "eqp-funcionarios": "/equipe/funcionarios",
  "eqp-ponto": "/equipe/ponto",
  "eqp-folha": "/equipe/folha",
  "mil-dashboard": "/milho/dashboard",
  "mil-safras": "/milho/safras",
  "mil-custos": "/milho/custos",
  "mil-producao": "/milho/producao",
  "mil-silos": "/milho/silos",
  "mil-custo": "/milho/custo",
};

const TAB_BY_PATH: Record<string, Tab> = Object.fromEntries(
  Object.entries(PATH_BY_TAB).map(([tab, path]) => [path, tab as Tab]),
) as Record<string, Tab>;

const DEFAULT_TAB_BY_PATH: Record<string, Tab> = {
  "/pecuaria": "reb-dashboard",
  "/plantio": "pla-dashboard",
  "/milho": "mil-dashboard",
  "/equipe": "eqp-dashboard",
  "/rebanho": "reb-dashboard",
  "/corte": "cor-dashboard",
};

const TAB_BY_PATH_LEGADO: Record<string, Tab> = {
  "/relatorio": "relatorio",
  "/relatorios": "relatorio",
  "/dashboard": "dashboard",
  "/gastos": "gastos",
  "/lancar": "lancar",
  "/caixinha": "caixinha",
  ...Object.fromEntries(
    Object.keys(PATH_BY_TAB)
      .filter((tab) => tab.startsWith("reb-"))
      .map((tab) => [`/rebanho/${tab.slice(4)}`, tab as Tab]),
  ),
  ...Object.fromEntries(
    Object.keys(PATH_BY_TAB)
      .filter((tab) => tab.startsWith("cor-"))
      .map((tab) => [`/corte/${tab.slice(4)}`, tab as Tab]),
  ),
};

export const DEFAULT_TAB: Tab = "dashboard";

export function parseContaFinanceiraId(pathname: string): EntityId | null {
  const match = /^\/financeiro\/contas\/([^/]+)\/?$/i.exec(pathname);
  const parsed = entityIdSchema.safeParse(match?.[1]);
  return parsed.success ? parsed.data : null;
}

export function parseOperacaoFinanceiraId(pathname: string): EntityId | null {
  const match = /^\/financeiro\/operacoes\/([^/]+)\/?$/i.exec(pathname);
  const parsed = entityIdSchema.safeParse(match?.[1]);
  return parsed.success ? parsed.data : null;
}

export function isNovaOperacaoFinanceira(pathname: string): boolean {
  return /^\/financeiro\/operacoes\/nova\/?$/i.test(pathname);
}

export const REBANHO_WORKLISTS = {
  "secagem-atrasada": "reproducao",
  "vazia-pos-pev": "reproducao",
  "dg-pendente": "reproducao",
  "parto-proximo": "reproducao",
  "ccs-alta": "sanidade",
  "carencia": "sanidade",
  "producao-caindo": "producao",
  "vacina-pendente": "sanidade",
  "precisa-de-exame": "reproducao",
} as const;

export type RebanhoWorklistChave = keyof typeof REBANHO_WORKLISTS;
export type RebanhoWorklistTab = (typeof REBANHO_WORKLISTS)[RebanhoWorklistChave];

export interface RotaWorklistRebanho {
  chave: RebanhoWorklistChave;
  tab: RebanhoWorklistTab;
}

export function isRebanhoWorklistChave(chave: string): chave is RebanhoWorklistChave {
  return Object.prototype.hasOwnProperty.call(REBANHO_WORKLISTS, chave);
}

/** Lê somente combinações canônicas de aba + chave; parâmetros extras são ignorados. */
export function parseRotaWorklistRebanho(pathname: string, search = ""): RotaWorklistRebanho | null {
  const tab = pathToTab(pathname);
  if (tab !== "reb-reproducao" && tab !== "reb-sanidade" && tab !== "reb-producao") return null;
  const chave = new URLSearchParams(search).get("worklist");
  if (!chave || !isRebanhoWorklistChave(chave)) return null;
  const worklistTab = REBANHO_WORKLISTS[chave];
  return tab === `reb-${worklistTab}` ? { chave, tab: worklistTab } : null;
}

/** Monta a URL canônica e impede que uma chave seja publicada na aba errada. */
export function buildRotaWorklistRebanho(chave: RebanhoWorklistChave, tab: RebanhoWorklistTab = REBANHO_WORKLISTS[chave]): string | null {
  if (REBANHO_WORKLISTS[chave] !== tab) return null;
  return `/pecuaria/${tab}?worklist=${encodeURIComponent(chave)}`;
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
  if (parseContaFinanceiraId(path) != null) return "caixinha";
  if (parseOperacaoFinanceiraId(path) != null) return "lancar";
  if (isNovaOperacaoFinanceira(path)) return "lancar";

  return DEFAULT_TAB_BY_PATH[path] ?? TAB_BY_PATH[path] ?? TAB_BY_PATH_LEGADO[path] ?? null;
}
