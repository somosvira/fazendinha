/* Rio Novo — Configurações (hub).
 *
 * Dobra as telas raras de setup/admin numa página só, com sub-abas:
 *   Categorias (plano de contas) · Sítios (admin) · Acessos (admin). A antiga
 *   sub-aba "Geral" (modo de produção e parâmetros do rebanho legado) saiu com o
 *   módulo legado.
 * Reaproveita as views existentes inteiras — cada uma traz seu próprio cabeçalho;
 * a barra de sub-abas por cima é a navegação. As rotas /configuracoes,
 * /configuracoes/sitios, /categorias e /acessos continuam válidas: o App roteia
 * todas para cá e o hub abre a sub-aba correspondente (deep-link e ⌘K preservados). */

import { useEffect, useState } from "react";
import { navegarPara } from "../router";
import { ConfiguracoesPecuaria } from "./ConfiguracoesPecuaria";
import { cn } from "@/lib/utils";
import type { Tab } from "./Shell";
import { SubTabs, type SubTab } from "./SubTabs";
import { EmptyState } from "./EmptyState";
import { PlanoContas } from "./PlanoContas";
import { Acessos } from "./Acessos";
import { PageHeader } from "../financeiro/financeiro-ui";
import { Sitios } from "./configuracoes/Sitios";

type ConfSub = "categorias" | "sitios" | "acessos" | "pecuaria";

// mapeamento bidirecional sub-aba <-> Tab
const TAB_BY_SUB: Record<ConfSub, Tab> = {
  categorias: "plano",
  sitios: "sitios",
  acessos: "acessos",
  pecuaria: "config",
};
const SUB_BY_TAB: Partial<Record<Tab, ConfSub>> = {
  plano: "categorias",
  sitios: "sitios",
  acessos: "acessos",
};

export function ConfiguracoesHub({ tab, onNav, isAdmin, podeCategorias = true, podePecuaria = false, podeLancarPecuaria = false }: {
  tab: Tab;
  onNav: (t: Tab) => void;
  isAdmin: boolean;
  // Categorias (plano de contas) segue o gate de permissão financeira do perfil.
  podeCategorias?: boolean;
  podePecuaria?: boolean;
  podeLancarPecuaria?: boolean;
}) {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => { const sync = () => setPath(window.location.pathname); window.addEventListener("popstate", sync); return () => window.removeEventListener("popstate", sync); }, []);
  const tabs: SubTab<ConfSub>[] = [
    ...(podeCategorias ? [{ id: "categorias" as const, label: "Categorias" }] : []),
    ...(podePecuaria ? [{ id: "pecuaria" as const, label: "Pecuária" }] : []),
    ...(isAdmin ? [{ id: "sitios" as const, label: "Sítios" }, { id: "acessos" as const, label: "Acessos" }] : []),
  ];
  // sub pedida pela rota (/configuracoes cai na primeira disponível); se o perfil
  // não pode a pedida (acessos sem admin, categorias sem permissão), usa a primeira
  // que ele pode. Sem nenhuma, mostra o estado vazio.
  const pedida = path.startsWith("/configuracoes/pecuaria") ? "pecuaria" : SUB_BY_TAB[tab];
  const atual: ConfSub | null = tabs.some((t) => t.id === pedida) ? pedida! : tabs[0]?.id ?? null;

  if (!atual) {
    return (
      <div className="px-[var(--gutter)] pt-7">
        <EmptyState titulo="Nada para configurar" descricao="Seu perfil não tem configurações disponíveis." />
      </div>
    );
  }

  // As views trazem a própria casca (shell-wide). Alinhamos a barra de sub-abas a ela.
  return (
    <>
      <div className={cn("configuracoes-navegacao pt-7", "px-[var(--gutter)]")}>

        <SubTabs tabs={tabs} active={atual} ariaLabel="Áreas de configurações" variant="financeiro" onSelect={(id) => id === "pecuaria" ? navegarPara("/configuracoes/pecuaria") : onNav(TAB_BY_SUB[id])} />
      </div>
      {atual === "pecuaria" && <div className="shell-wide pagina-financeira financeiro-colorido">{path.split("/").filter(Boolean).length < 4 && <PageHeader titulo="Configurações da Pecuária" descricao="Mantenha os cadastros e as regras de rebanho, sanidade e reprodução." />}<ConfiguracoesPecuaria podeLancar={podeLancarPecuaria} /></div>}
      {atual === "categorias" && <PlanoContas onNav={onNav} />}
      {atual === "sitios" && isAdmin && <Sitios />}
      {atual === "acessos" && isAdmin && <Acessos />}
    </>
  );
}
