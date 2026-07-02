import { FuncionariosTab } from "./components/FuncionariosTab";
import { PontoTab } from "./components/PontoTab";
import { FolhaTab } from "./components/FolhaTab";

export type EqpSub = "funcionarios" | "ponto" | "folha";

/* Roteia as 3 sub-abas do módulo Equipe & Ponto (espelha PlantioContent).
 * onNavEqp permite navegar entre as abas (reservado para links internos). */
export function EquipeContent({ aba }: { aba: EqpSub; onNavEqp?: (aba: EqpSub) => void }) {
  return (
    <div className="rb">
      {aba === "ponto"
        ? <PontoTab />
        : aba === "folha"
          ? <FolhaTab />
          : <FuncionariosTab />}
    </div>
  );
}
