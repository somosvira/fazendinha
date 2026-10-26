import type { Tab } from "./components/Shell";
import { ABAS } from "./data/acessos";
import type { UsuarioSessao } from "./lib/auth";
import { areaDaTab, temAcessoArea, temAcessoEstoque } from "./lib/areas";
import { pathToTab, tabToPath, normalizarRotaPecuaria } from "./router";

export type RotaAuth = { kind: "signin"; returnTo: string | null };

const PUBLIC_PATHS = new Set(["/signin"]);

export function interpretarRotaAuth(pathname: string, search = ""): RotaAuth | null {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (path !== "/signin") return null;
  return { kind: "signin", returnTo: new URLSearchParams(search).get("returnTo") };
}

/** Aceita somente um caminho da própria aplicação e nunca uma URL absoluta/protocol-relative. */
export function returnToInterna(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  try {
    const base = "https://terrano.internal";
    const url = new URL(raw, base);
    const decodedPath = decodeURIComponent(url.pathname);
    if (url.origin !== base || decodedPath.startsWith("//") || decodedPath.includes("\\") || PUBLIC_PATHS.has(url.pathname) || interpretarRotaAuth(url.pathname, url.search)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function podeAcessarTab(usuario: UsuarioSessao, tab: Tab): boolean {
  const dono = !!usuario.dono;
  // Sítios é estrutura da fazenda (raramente muda): mesmo público de Acessos.
  if (tab === "acessos" || tab === "sitios") return dono || usuario.flags.includes("gerenciarAcessos");
  if (tab === "config") return true;
  if (tab === "gerencial") return temAcessoArea(usuario.areas,"pecuaria",dono) || (temAcessoArea(usuario.areas,"financeiro",dono) && (dono || usuario.abas.includes("dashboard")));
  if (tab === "estoque") return temAcessoEstoque(usuario.areas, dono);

  const area = areaDaTab(tab);
  if (area && !temAcessoArea(usuario.areas, area, dono)) return false;
  if (area === "financeiro") {
    const abasFinanceiras = new Set(ABAS.map((aba) => aba.id));
    if (tab === "caixinha" && usuario.abas.includes("cadastros")) return true;
    return abasFinanceiras.has(tab) && usuario.abas.includes(tab);
  }
  return area !== null;
}

export function podeAcessarCaminho(usuario: UsuarioSessao, caminho: string): boolean {
  const url = new URL(normalizarRotaPecuaria(caminho), "https://terrano.internal");
  const tab = pathToTab(url.pathname);
  return !!tab && podeAcessarTab(usuario, tab)
    && (!url.pathname.startsWith("/configuracoes/pecuaria") || podeAcessarTab(usuario, "pec-rebanho"));
}

export function paginaInicialAutorizada(usuario: UsuarioSessao): string {
  for (const aba of ABAS) {
    const tab = aba.id as Tab;
    if (podeAcessarTab(usuario, tab)) return tabToPath(tab);
  }
  if (temAcessoArea(usuario.areas, "pecuaria", !!usuario.dono)) return tabToPath("pec-rebanho");
  return tabToPath("config");
}

export function destinoDepoisDoLogin(rawReturnTo: string | null | undefined, usuario: UsuarioSessao): string {
  const interno = returnToInterna(rawReturnTo);
  if (!interno) return paginaInicialAutorizada(usuario);
  const pathname = new URL(interno, "https://terrano.internal").pathname;
  const tab = pathToTab(pathname);
  return tab && podeAcessarCaminho(usuario, interno) ? normalizarRotaPecuaria(interno) : paginaInicialAutorizada(usuario);
}

export function urlSigninPara(pathname: string, search = ""): string {
  const returnTo = returnToInterna(`${pathname}${search}`);
  return returnTo ? `/signin?returnTo=${encodeURIComponent(returnTo)}` : "/signin";
}
