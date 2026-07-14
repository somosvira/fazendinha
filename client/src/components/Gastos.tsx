/* Rio Novo — Gastos (contas a pagar / vencidas / pagas) */

import R from "../data/rionovo";
import { ReportHeader } from "./Shell";
import type { Tab } from "./Shell";
import type { User } from "../data/acessos";
import { AnomaliasStrip } from "./Vigilancia";
import { anomalias } from "./../data/anomalias";
import { ContasAVencer } from "../financeiro/ContasAVencer";

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

export function Gastos({
  onNav,
  user,
  filtrosIniciais,
}: {
  onNav: (t: Tab) => void;
  user?: User;
  filtrosIniciais?: Record<string, string>;
}) {
  return (
    <div className={"shell-wide " + (user && !user.flags.includes("verValores") ? "mask-values" : "")}>
      <ReportHeader subtitle="Gastos — contas a pagar" updatedAt={R.UPDATED_AT} />

      <ContasAVencer filtrosIniciais={filtrosIniciais} />

      <AnomaliasStrip R={{ anomalias }} onNav={onNav} />
    </div>
  );
}
