import { FuncionariosTab } from "./components/FuncionariosTab";
import { PontoTab } from "./components/PontoTab";
import { FolhaTab } from "./components/FolhaTab";
import { DashboardView } from "./components/DashboardView";

export type EqpSub = "dashboard" | "funcionarios" | "ponto" | "folha";

/* Roteia as 4 sub-abas do módulo Equipe & Ponto (espelha CultivoContent).
 * onNavEqp permite navegar entre as abas (usado pelo painel). */
export function EquipeContent({ aba, onNavEqp }: { aba: EqpSub; onNavEqp?: (aba: EqpSub) => void }) {
  return (
    <div className="rb">
      {aba === "dashboard"
        ? <DashboardView onNavEqp={onNavEqp ?? (() => {})} />
        : aba === "ponto"
          ? <PontoTab />
          : aba === "folha"
            ? <FolhaTab />
            : <FuncionariosTab />}
    </div>
  );
}
