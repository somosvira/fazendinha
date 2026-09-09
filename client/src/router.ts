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

// Abas de slug fixo (financeiro + administração). Slug = parte visível na URL.
const PATH_BY_TAB: Partial<Record<Tab, string>> = {
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
  // Lotes agregados preexistentes vivem como uma subseção da Pecuária, não
  // como um módulo de corte independente.
  "cor-dashboard": "/pecuaria/lotes/resumo",
  "cor-lote": "/pecuaria/lotes",
  "cor-pesagem": "/pecuaria/lotes/pesagens",
  "cor-pasto": "/pecuaria/lotes/pasto",
  "cor-sanidade": "/pecuaria/lotes/sanidade",
  "cor-nutricao": "/pecuaria/lotes/nutricao",
  "cor-comercial": "/pecuaria/lotes/comercializacao",
  "cor-custo": "/pecuaria/lotes/custos",
};

const TAB_BY_PATH: Record<string, Tab> = Object.fromEntries(
  Object.entries(PATH_BY_TAB).map(([tab, path]) => [path, tab as Tab]),
) as Record<string, Tab>;

// Prefixo da aba (reb-/pla-/cor-/mil-/eqp-) <-> base do caminho aninhado.
// `defaultSub` = sub-aba aberta quando a URL é só a base (default "dashboard").
// TODOS os módulos operacionais abrem no painel (dashboard) — a URL base
// /pecuaria, /plantio, /milho, /equipe resolve para o painel.
const MODULO_BASE: Array<{ prefix: string; base: string; defaultSub?: string }> = [
  { prefix: "reb-", base: "/pecuaria" },
  { prefix: "pla-", base: "/plantio" },
  { prefix: "mil-", base: "/milho" },
  { prefix: "eqp-", base: "/equipe" },
];

// Compatibilidade de leitura: links/favoritos anteriores continuam abrindo,
// mas toda navegação nova publica apenas as URLs unificadas acima.
const MODULO_BASE_LEGADO: Array<{ prefix: string; base: string; defaultSub?: string }> = [
  { prefix: "reb-", base: "/rebanho" },
  { prefix: "cor-", base: "/corte" },
];

export const DEFAULT_TAB: Tab = "dashboard";

export function parseOperacaoFinanceiraId(pathname: string): number | null {
  const match = /^\/financeiro\/operacoes\/(\d+)\/?$/i.exec(pathname);
  return match ? Number(match[1]) : null;
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
  // Compatibilidade com links e favoritos anteriores à Central de Relatórios.
  if (path === "/relatorio") return "relatorio";
  if (path === "/relatorios") return "relatorio";
  if (path === "/dashboard") return "dashboard";
  if (path === "/gastos") return "gastos";
  if (path === "/lancar") return "lancar";
  if (path === "/caixinha") return "caixinha";
  if (parseOperacaoFinanceiraId(path) != null) return "lancar";
  if (isNovaOperacaoFinanceira(path)) return "lancar";

  const fixed = TAB_BY_PATH[path];
  if (fixed) return fixed;

  for (const { prefix, base, defaultSub } of MODULO_BASE) {
    if (path === base) return `${prefix}${defaultSub ?? "dashboard"}` as Tab;
    if (path.startsWith(`${base}/`)) {
      const sub = path.slice(base.length + 1);
      if (sub) return `${prefix}${sub}` as Tab;
    }
  }
  for (const { prefix, base, defaultSub } of MODULO_BASE_LEGADO) {
    if (path === base) return `${prefix}${defaultSub ?? "dashboard"}` as Tab;
    if (path.startsWith(`${base}/`)) {
      const sub = path.slice(base.length + 1);
      if (sub) return `${prefix}${sub}` as Tab;
    }
  }
  return null;
}
