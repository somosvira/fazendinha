import { useState } from "react";
import { LoteCockpit } from "./components/LoteCockpit";
import { LoteTab } from "./components/LoteTab";
import { PesagemTab } from "./components/PesagemTab";
import { PastoTab } from "./components/PastoTab";
import { SanidadeTab } from "./components/SanidadeTab";
import { NutricaoTab } from "./components/NutricaoTab";
import { ComercialTab } from "./components/ComercialTab";
import { CustoTab } from "./components/CustoTab";
import { IaView } from "./components/IaView";
import { DashboardView } from "./components/DashboardView";

export type CorSub = "dashboard" | "lote" | "pesagem" | "pasto" | "sanidade" | "nutricao" | "comercial" | "custo" | "ia";

/* Espelho do RebanhoContent/PlantioContent. Roteia entre as 9 sub-abas
 * do módulo Corte. Modais de novo lote / registro de manejo ficam como
 * stubs (alert) por enquanto — protótipo. */
export function PlantelContent({ aba, onNavCor }: { aba: CorSub; onNavCor?: (aba: CorSub) => void }) {
  const [loteId, setLoteId] = useState<string | null>(null);

  // Modais de criação não estão implementados; usamos alerta para sinalizar
  // claramente que o botão "Salvar" não persiste. Quando o backend for
  // plugado, trocar para abrir um drawer com formulário real.
  const stub = (acao: string) => () =>
    alert(`Próxima entrega: ${acao} via /api/corte/* (Prisma). Por enquanto, este é um protótipo de leitura.`);

  return (
    <div className="rb">
      {loteId
        ? <LoteCockpit loteId={loteId} onVoltar={() => setLoteId(null)} />
        : aba === "lote"
          ? <LoteTab onAbrirLote={setLoteId} onNovo={stub("criar lote")} />
          : aba === "pesagem"
            ? <PesagemTab onAbrirLote={setLoteId} />
            : aba === "pasto"
              ? <PastoTab />
              : aba === "sanidade"
                ? <SanidadeTab onRegistrarManejo={stub("registrar manejo sanitário")} />
                : aba === "nutricao"
                  ? <NutricaoTab onRegistrarManejo={stub("registrar suplementação")} />
                  : aba === "comercial"
                    ? <ComercialTab onAbrirLote={setLoteId} />
                    : aba === "custo"
                      ? <CustoTab />
                      : aba === "dashboard"
                        ? <DashboardView onNav={(t) => onNavCor?.(t as CorSub)} />
                        : <IaView />}
    </div>
  );
}
