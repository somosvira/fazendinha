/* Rio Novo — Configurações (hub).
 *
 * Dobra as telas raras de setup/admin numa página só, com sub-abas:
 *   Geral (config do sistema) · Categorias (plano de contas) · Acessos (admin).
 * Reaproveita as views existentes inteiras — cada uma traz seu próprio cabeçalho;
 * a barra de sub-abas por cima é a navegação. As rotas /configuracoes,
 * /categorias e /acessos continuam válidas: o App roteia todas para cá e o hub
 * abre a sub-aba correspondente (deep-link e ⌘K preservados). */

import { cn } from "@/lib/utils";
import type { Tab } from "./Shell";
import { SubTabs, type SubTab } from "./SubTabs";
import { ConfiguracoesView } from "../rebanho/components/ConfiguracoesView";
import { PlanoContas } from "./PlanoContas";
import { Acessos } from "./Acessos";

type ConfSub = "geral" | "categorias" | "acessos";

// mapeamento bidirecional sub-aba <-> Tab
const TAB_BY_SUB: Record<ConfSub, Tab> = {
  geral: "config",
  categorias: "plano",
  acessos: "acessos",
};
const SUB_BY_TAB: Partial<Record<Tab, ConfSub>> = {
  config: "geral",
  plano: "categorias",
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
    { id: "geral", label: "Geral" },
    ...(podeCategorias ? [{ id: "categorias" as const, label: "Categorias" }] : []),
    ...(isAdmin ? [{ id: "acessos" as const, label: "Acessos" }] : []),
  ];
  // sub pedida pela rota; se cair numa que o perfil não pode (acessos sem admin,
  // categorias sem permissão), volta pra "geral".
  const pedida = SUB_BY_TAB[tab] ?? "geral";
  const atual: ConfSub =
    (pedida === "acessos" && !isAdmin) || (pedida === "categorias" && !podeCategorias)
      ? "geral"
      : pedida;

  // As views trazem a própria casca (RebMain nas de rebanho; shell-wide nas
  // financeiras). Renderizamos a view "pelada" e alinhamos SÓ a barra de sub-abas
  // à casca da view ativa — senão a barra fica deslocada do conteúdo.
  const wide = atual === "categorias" || atual === "acessos";
  const barShell = wide
    ? "px-[var(--gutter)]" // = .shell-wide (PlanoContas / Acessos)
    : "mx-auto w-full max-w-[1520px] px-[clamp(24px,4vw,56px)] min-[1700px]:px-[clamp(40px,5vw,96px)]"; // = RebMain

  return (
    <>
      <div className={cn("pt-7", barShell)}>
        <SubTabs tabs={tabs} active={atual} onSelect={(id) => onNav(TAB_BY_SUB[id])} />
      </div>
      {atual === "geral" && <ConfiguracoesView />}
      {atual === "categorias" && <PlanoContas onNav={onNav} />}
      {atual === "acessos" && isAdmin && <Acessos />}
    </>
  );
}
