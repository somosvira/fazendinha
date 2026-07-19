/* Rio Novo — roteamento por URL sem react-router.
 *
 * A navegação continua sendo um `useState<Tab>` em App.tsx (convenção do projeto).
 * Este módulo só faz a ponte bidirecional Tab <-> pathname:
 *  - tabToPath: para refletir a aba ativa na barra de endereço.
 *  - pathToTab: para abrir o app já na aba certa (deep-link / reload / back-forward).
 *
 * Os módulos operacionais (rebanho/plantio/corte/milho/equipe) têm sub-abas com
 * prefixo (reb-, pla-, cor-, mil-, eqp-) e viram caminhos aninhados
 * /rebanho/<sub>, /plantio/<sub>, etc. As abas financeiras/administração têm
 * slug fixo no mapa abaixo.
 */

import type { Tab } from "./components/Shell";

// Abas de slug fixo (financeiro + administração). Slug = parte visível na URL.
const PATH_BY_TAB: Partial<Record<Tab, string>> = {
  dashboard: "/dashboard",
  gastos: "/gastos",
  lancar: "/lancar",
  caixinha: "/caixinha",
  plano: "/categorias",
  ia: "/ia",
  relatorio: "/relatorio",
  acessos: "/acessos",
  config: "/configuracoes",
  cadastros: "/cadastros",
};

const TAB_BY_PATH: Record<string, Tab> = Object.fromEntries(
  Object.entries(PATH_BY_TAB).map(([tab, path]) => [path, tab as Tab]),
) as Record<string, Tab>;

// Prefixo da aba (reb-/pla-/cor-/mil-/eqp-) <-> base do caminho aninhado.
// `defaultSub` = sub-aba aberta quando a URL é só a base (default "dashboard").
// TODOS os módulos operacionais abrem no painel (dashboard) — a URL base
// /rebanho, /plantio, /corte, /milho, /equipe resolve para o painel.
const MODULO_BASE: Array<{ prefix: string; base: string; defaultSub?: string }> = [
  { prefix: "reb-", base: "/rebanho" },
  { prefix: "pla-", base: "/plantio" },
  { prefix: "cor-", base: "/corte" },
  { prefix: "mil-", base: "/milho" },
  { prefix: "eqp-", base: "/equipe" },
];

export const DEFAULT_TAB: Tab = "dashboard";

export const REBANHO_WORKLISTS = {
  "secagem-atrasada": "reproducao",
  "vazia-pos-pev": "reproducao",
  "dg-pendente": "reproducao",
  "parto-proximo": "reproducao",
  "ccs-alta": "sanidade",
  "carencia": "sanidade",
  "producao-caindo": "producao",
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
  return `/rebanho/${tab}?worklist=${encodeURIComponent(chave)}`;
}

/** Aba ativa -> pathname canônico para a barra de endereço. */
export function tabToPath(tab: Tab): string {
  const fixed = PATH_BY_TAB[tab];
  if (fixed) return fixed;
  for (const { prefix, base } of MODULO_BASE) {
    if (tab.startsWith(prefix)) return `${base}/${tab.slice(prefix.length)}`;
  }
  return PATH_BY_TAB[DEFAULT_TAB]!;
}

/** pathname -> aba (ou null se não casar com nenhuma rota conhecida). */
export function pathToTab(pathname: string): Tab | null {
  // normaliza: minúsculas e sem barra final (exceto raiz)
  let path = pathname.toLowerCase();
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

  if (path === "/" || path === "") return DEFAULT_TAB;

  const fixed = TAB_BY_PATH[path];
  if (fixed) return fixed;

  for (const { prefix, base, defaultSub } of MODULO_BASE) {
    if (path === base) return `${prefix}${defaultSub ?? "dashboard"}` as Tab;
    if (path.startsWith(`${base}/`)) {
      const sub = path.slice(base.length + 1);
      if (sub) return `${prefix}${sub}` as Tab;
    }
  }
  return null;
}
