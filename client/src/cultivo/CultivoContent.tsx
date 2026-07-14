import { SafrasTab } from "./components/SafrasTab";
import { CustosTab } from "./components/CustosTab";
import { ProducaoTab } from "./components/ProducaoTab";
import { SilosTab } from "./components/SilosTab";
import { CustoTab } from "./components/CustoTab";
import { DashboardView } from "./components/DashboardView";

export type MilSub = "dashboard" | "safras" | "custos" | "producao" | "silos" | "custo";

/* Espelho do PlantioContent/PlantelContent: roteia entre as sub-abas do
 * módulo Cultivo (milho). Sem cockpit/drawer global aqui — cada tab cuida do
 * próprio cadastro/detalhe inline (a unidade de navegação é a SafraCultivo,
 * selecionada dentro da SafrasTab, não um deep-link central como talhão/lote). */
export function CultivoContent({ aba, onNavMil }: { aba: MilSub; onNavMil: (s: MilSub) => void }) {
  return (
    <div className="rb">
      {aba === "dashboard" ? (
        <DashboardView onNavMil={onNavMil} />
      ) : aba === "safras" ? (
        <SafrasTab onNavMil={onNavMil} />
      ) : aba === "custos" ? (
        <CustosTab />
      ) : aba === "producao" ? (
        <ProducaoTab />
      ) : aba === "silos" ? (
        <SilosTab />
      ) : (
        <CustoTab />
      )}
    </div>
  );
}
