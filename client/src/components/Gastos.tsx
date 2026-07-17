/* Rio Novo — Gastos (contas a pagar / vencidas / pagas).
 * Vira uma página-hub com sub-abas: "Contas" (contas a pagar + vigilância de IA)
 * e "Caixinha" (caixa físico, dobrado aqui em vez de item solto na sidebar). */

import type { Tab } from "./Shell";
import type { User } from "../data/acessos";
import { ContasAVencer } from "../financeiro/ContasAVencer";
import { Caixinha } from "../financeiro/Caixinha";
import { SubTabs, type SubTab } from "./SubTabs";

export function ActivityPill({ atv, mix }: { atv?: string; mix?: boolean }) {
  if (mix) {
    return (
      <span className="act-pill mix">
        <span className="dot"></span>Misto
      </span>
    );
  }
  const map: Record<string, string> = { leite: "Leite", cafe: "Café", outros: "Outros" };
  return (
    <span className={"act-pill " + (atv ?? "outros")}>
      <span className="dot"></span>
      {map[atv ?? "outros"] ?? "Outros"}
    </span>
  );
}

export type GastosSub = "contas" | "caixinha";

export function Gastos({
  onNav,
  user,
  sub = "contas",
  podeCaixinha = true,
  filtrosIniciais,
}: {
  onNav: (t: Tab) => void;
  user?: User;
  sub?: GastosSub;
  podeCaixinha?: boolean;
  filtrosIniciais?: Record<string, string>;
}) {
  const tabs: SubTab<GastosSub>[] = [
    { id: "contas", label: "Contas" },
    ...(podeCaixinha ? [{ id: "caixinha" as const, label: "Caixinha" }] : []),
  ];
  const atual: GastosSub = sub === "caixinha" && podeCaixinha ? "caixinha" : "contas";

  return (
    <div className={"shell-wide " + (user && !user.flags.includes("verValores") ? "mask-values" : "")}>
      {tabs.length > 1 && (
        <SubTabs
          tabs={tabs}
          active={atual}
          onSelect={(id) => onNav(id === "caixinha" ? "caixinha" : "gastos")}
        />
      )}

      {atual === "caixinha" ? (
        <Caixinha embedded />
      ) : (
        <ContasAVencer filtrosIniciais={filtrosIniciais} />
      )}
    </div>
  );
}
