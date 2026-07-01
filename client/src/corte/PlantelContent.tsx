import { useEffect, useRef, useState } from "react";
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
export function PlantelContent({ aba, onNavCor, abrirId, onAbriuEntidade }: { aba: CorSub; onNavCor?: (aba: CorSub) => void; abrirId?: string; onAbriuEntidade?: () => void }) {
  const [loteId, setLoteId] = useState<string | null>(null);

  // Guarda o lote a abrir após uma troca de aba (deep-link ⌘K), para o efeito
  // [aba] abaixo não limpar o cockpit recém-aberto. Espelha o proximoAnimalRef.
  const proximoLoteRef = useRef<string | null>(null);

  // Trocar de sub-aba fecha qualquer cockpit de lote aberto — exceto quando há
  // um lote marcado para abrir (deep-link), aí abrimos ele.
  useEffect(() => {
    if (proximoLoteRef.current) {
      setLoteId(proximoLoteRef.current);
      proximoLoteRef.current = null;
    } else {
      setLoteId(null);
    }
  }, [aba]);

  // Deep-link do ⌘K: abre o cockpit do lote por id usando a ref.
  useEffect(() => {
    if (!abrirId) return;
    proximoLoteRef.current = abrirId;
    setLoteId(abrirId);
    onAbriuEntidade?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirId]);

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
