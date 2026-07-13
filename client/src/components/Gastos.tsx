/* Rio Novo — Gastos (contas a pagar / vencidas / pagas).
 * Vira uma página-hub com sub-abas: "Contas" (contas a pagar + vigilância de IA)
 * e "Caixinha" (caixa físico, dobrado aqui em vez de item solto na sidebar). */

import R from "../data/rionovo";
import { ReportHeader } from "./Shell";
import type { Tab } from "./Shell";
import type { User } from "../data/acessos";
import { AnomaliasStrip } from "./Vigilancia";
import { anomalias } from "./../data/anomalias";
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

export function Gastos({ onNav, user, sub = "contas", podeCaixinha = true }: {
  onNav: (t: Tab) => void;
  user?: User;
  sub?: GastosSub;
  podeCaixinha?: boolean;
}) {
  const tabs: SubTab<GastosSub>[] = [
    { id: "contas", label: "Contas" },
    ...(podeCaixinha ? [{ id: "caixinha" as const, label: "Caixinha" }] : []),
  ];
  const atual: GastosSub = sub === "caixinha" && podeCaixinha ? "caixinha" : "contas";

  return (
    <div className={"shell-wide " + (user && !user.flags.includes("verValores") ? "mask-values" : "")}>
      <ReportHeader
        eyebrow={atual === "caixinha" ? "Financeiro · Caixa físico" : "Financeiro · Contas a pagar"}
        subtitle="Gastos"
        updatedAt={R.UPDATED_AT}
      />

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
        <>
          <ContasAVencer />
          <AnomaliasStrip R={{ anomalias }} onNav={onNav} />
        </>
      )}
    </div>
  );
}
