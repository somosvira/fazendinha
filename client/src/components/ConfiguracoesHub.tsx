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

import { cn } from "@/lib/utils";
import type { Tab } from "./Shell";
import { SubTabs, type SubTab } from "./SubTabs";
import { EmptyState } from "./EmptyState";
import { PlanoContas } from "./PlanoContas";
import { Acessos } from "./Acessos";
import { Sitios } from "./configuracoes/Sitios";

type ConfSub = "categorias" | "sitios" | "acessos";

// mapeamento bidirecional sub-aba <-> Tab
const TAB_BY_SUB: Record<ConfSub, Tab> = {
  categorias: "plano",
  sitios: "sitios",
  acessos: "acessos",
};
const SUB_BY_TAB: Partial<Record<Tab, ConfSub>> = {
  plano: "categorias",
  sitios: "sitios",
  acessos: "acessos",
};

export function ConfiguracoesHub({ tab, onNav, isAdmin, podeCategorias = true }: {
  tab: Tab;
  onNav: (t: Tab) => void;
  isAdmin: boolean;
  // Categorias (plano de contas) segue o gate de permissão financeira do perfil.
  podeCategorias?: boolean;
}) {
  const tabs: SubTab<ConfSub>[] = [
    ...(podeCategorias ? [{ id: "categorias" as const, label: "Categorias" }] : []),
    ...(isAdmin ? [{ id: "sitios" as const, label: "Sítios" }, { id: "acessos" as const, label: "Acessos" }] : []),
  ];
  // sub pedida pela rota (/configuracoes cai na primeira disponível); se o perfil
  // não pode a pedida (acessos sem admin, categorias sem permissão), usa a primeira
  // que ele pode. Sem nenhuma, mostra o estado vazio.
  const pedida = SUB_BY_TAB[tab];
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
      <div className={cn("pt-7", "px-[var(--gutter)]")}>
        <SubTabs tabs={tabs} active={atual} onSelect={(id) => onNav(TAB_BY_SUB[id])} />
      </div>
      {atual === "categorias" && <PlanoContas onNav={onNav} />}
      {atual === "sitios" && isAdmin && <Sitios />}
      {atual === "acessos" && isAdmin && <Acessos />}
    </>
  );
}
