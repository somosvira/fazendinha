/* Rio Novo — roteamento por URL sem react-router.
 *
 * A navegação continua sendo um `useState<Tab>` em App.tsx (convenção do projeto).
 * Este módulo só faz a ponte bidirecional Tab <-> pathname:
 *  - tabToPath: para refletir a aba ativa na barra de endereço.
 *  - pathToTab: para abrir o app já na aba certa (deep-link / reload / back-forward).
 *
 * Os módulos operacionais (rebanho/plantio/corte) têm sub-abas com prefixo
 * (reb-, pla-, cor-) e viram caminhos aninhados /rebanho/<sub>, /plantio/<sub>,
 * /corte/<sub>. As abas financeiras/administração têm slug fixo no mapa abaixo.
 */

import type { Tab } from "./components/Shell";

// Abas de slug fixo (financeiro + administração). Slug = parte visível na URL.
const PATH_BY_TAB: Partial<Record<Tab, string>> = {
  dashboard: "/dashboard",
  gastos: "/gastos",
  lancar: "/lancar",
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

// Prefixo da aba (reb-/pla-/cor-) <-> base do caminho aninhado.
const MODULO_BASE: Array<{ prefix: string; base: string }> = [
  { prefix: "reb-", base: "/rebanho" },
  { prefix: "pla-", base: "/plantio" },
  { prefix: "cor-", base: "/corte" },
];

export const DEFAULT_TAB: Tab = "dashboard";

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

  for (const { prefix, base } of MODULO_BASE) {
    if (path === base) return `${prefix}dashboard` as Tab;
    if (path.startsWith(`${base}/`)) {
      const sub = path.slice(base.length + 1);
      if (sub) return `${prefix}${sub}` as Tab;
    }
  }
  return null;
}
