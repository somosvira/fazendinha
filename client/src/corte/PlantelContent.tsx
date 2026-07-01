import { useEffect, useState } from "react";
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
import { LoteForm } from "./components/LoteForm";
import { PesagemForm } from "./components/PesagemForm";
import { ManejoForm } from "./components/ManejoForm";
import { SuplementacaoForm } from "./components/SuplementacaoForm";
import { OperacaoComercialForm } from "./components/OperacaoComercialForm";
import type { Lote } from "./types";

export type CorSub = "dashboard" | "lote" | "pesagem" | "pasto" | "sanidade" | "nutricao" | "comercial" | "custo" | "ia";

/* Espelho do PlantioContent: roteia entre as 9 sub-abas do módulo Corte e
 * gerencia os modais (novo lote, editar/baixa, registro de pesagem inline).
 * Núcleo (lote/pesagem/pasto/dashboard) já lê/escreve no backend real
 * (/api/corte/*); Sanidade/Nutrição/Comercial/Custo/IA seguem mock por ora. */
export function PlantelContent({ aba, onNavCor }: { aba: CorSub; onNavCor?: (aba: CorSub) => void }) {
  const [loteId, setLoteId] = useState<string | null>(null);
  const [form, setForm] = useState<{ modo: "novo" | "editar" | "baixa"; lote?: Lote } | null>(null);
  const [pesagemDe, setPesagemDe] = useState<Lote | null>(null);
  // Drawer de evento (sanidade/nutricao/comercial), com o dominio que o abriu.
  const [eventoDe, setEventoDe] = useState<{ tipo: "sanidade" | "nutricao" | "comercial"; lote: Lote } | null>(null);
  // Contador de recarga: bump força o remount (e o refetch) da tab/cockpit após salvar.
  const [recarga, setRecarga] = useState(0);

  // Trocar de sub-aba fecha qualquer cockpit/drawer de lote aberto (espelha PlantioContent).
  useEffect(() => { setLoteId(null); setEventoDe(null); setPesagemDe(null); }, [aba]);

  // Fechar drawer de evento e refetch (a timeline do cockpit e a tab re-buscam).
  const aoSalvarEvento = () => { setEventoDe(null); setRecarga((n) => n + 1); };

  return (
    <div className="rb">
      {loteId
        ? <LoteCockpit key={recarga} loteId={loteId} onVoltar={() => setLoteId(null)} />
        : aba === "lote"
          ? <LoteTab key={recarga} onAbrirLote={setLoteId} onNovo={() => setForm({ modo: "novo" })} />
          : aba === "pesagem"
            ? <PesagemTab key={recarga} onAbrirLote={setLoteId} onPesar={setPesagemDe} />
            : aba === "pasto"
              ? <PastoTab key={recarga} />
              : aba === "sanidade"
                ? <SanidadeTab key={recarga} onRegistrarManejo={(lote) => setEventoDe({ tipo: "sanidade", lote })} />
                : aba === "nutricao"
                  ? <NutricaoTab key={recarga} onRegistrarManejo={(lote) => setEventoDe({ tipo: "nutricao", lote })} />
                  : aba === "comercial"
                    ? <ComercialTab key={recarga} onRegistrar={(lote) => setEventoDe({ tipo: "comercial", lote })} />
                    : aba === "custo"
                      ? <CustoTab />
                      : aba === "dashboard"
                        ? <DashboardView onNav={(t) => onNavCor?.(t as CorSub)} />
                        : <IaView />}
      {form && <LoteForm modo={form.modo} lote={form.lote} onFechar={() => setForm(null)} onSalvo={() => { setForm(null); setRecarga((n) => n + 1); }} />}
      {pesagemDe && (
        <PesagemForm
          lote={pesagemDe}
          onFechar={() => setPesagemDe(null)}
          onSalvo={() => { setPesagemDe(null); setRecarga((n) => n + 1); }}
        />
      )}
      {eventoDe?.tipo === "sanidade" && (
        <ManejoForm lote={eventoDe.lote} onFechar={() => setEventoDe(null)} onSalvo={aoSalvarEvento} />
      )}
      {eventoDe?.tipo === "nutricao" && (
        <SuplementacaoForm lote={eventoDe.lote} onFechar={() => setEventoDe(null)} onSalvo={aoSalvarEvento} />
      )}
      {eventoDe?.tipo === "comercial" && (
        <OperacaoComercialForm lote={eventoDe.lote} onFechar={() => setEventoDe(null)} onSalvo={aoSalvarEvento} />
      )}
    </div>
  );
}
