import { useEffect, useRef, useState } from "react";
import { LoteCockpit } from "./components/LoteCockpit";
import { LoteTab } from "./components/LoteTab";
import { PesagemTab } from "./components/PesagemTab";
import { PastoTab } from "./components/PastoTab";
import { SanidadeTab } from "./components/SanidadeTab";
import { NutricaoTab } from "./components/NutricaoTab";
import { ComercialTab } from "./components/ComercialTab";
import { CustoTab } from "./components/CustoTab";
import { DashboardView } from "./components/DashboardView";
import { LoteForm } from "./components/LoteForm";
import { PesagemForm } from "./components/PesagemForm";
import { ManejoForm } from "./components/ManejoForm";
import { SuplementacaoForm } from "./components/SuplementacaoForm";
import { OperacaoComercialForm } from "./components/OperacaoComercialForm";
import type { Lote } from "./types";

export type CorSub = "dashboard" | "lote" | "pesagem" | "pasto" | "sanidade" | "nutricao" | "comercial" | "custo";

/* Espelho do PlantioContent: roteia entre as 9 sub-abas do módulo Corte e
 * gerencia os modais (novo lote, editar/baixa, pesagem, manejo/suplementação/
 * operação comercial). Lê/escreve no backend real (/api/corte/*). O deep-link
 * do ⌘K abre o cockpit de um lote por id. */
export function PlantelContent({ aba, onNavCor, abrirId, onAbriuEntidade }: { aba: CorSub; onNavCor?: (aba: CorSub) => void; abrirId?: string; onAbriuEntidade?: () => void }) {
  const [loteId, setLoteId] = useState<string | null>(null);
  const [form, setForm] = useState<{ modo: "novo" | "editar" | "baixa"; lote?: Lote } | null>(null);
  const [pesagemDe, setPesagemDe] = useState<Lote | null>(null);
  // Drawer de evento (sanidade/nutricao/comercial), com o dominio que o abriu.
  const [eventoDe, setEventoDe] = useState<{ tipo: "sanidade" | "nutricao" | "comercial"; lote: Lote } | null>(null);
  // Contador de recarga: bump força o remount (e o refetch) da tab/cockpit após salvar.
  const [recarga, setRecarga] = useState(0);

  // Guarda o lote a abrir após troca de aba (deep-link ⌘K), pro efeito [aba]
  // não limpar o cockpit recém-aberto. Espelha o proximoAnimalRef.
  const proximoLoteRef = useRef<string | null>(null);

  // Trocar de sub-aba fecha cockpit/drawers — exceto quando há um lote marcado
  // para abrir (deep-link), aí abrimos ele.
  useEffect(() => {
    if (proximoLoteRef.current) {
      setLoteId(proximoLoteRef.current);
      proximoLoteRef.current = null;
    } else {
      setLoteId(null);
    }
    setEventoDe(null);
    setPesagemDe(null);
  }, [aba]);

  // Deep-link do ⌘K: abre o cockpit do lote por id usando a ref.
  useEffect(() => {
    if (!abrirId) return;
    proximoLoteRef.current = abrirId;
    setLoteId(abrirId);
    onAbriuEntidade?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirId]);

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
                      : <DashboardView onNav={(t) => onNavCor?.(t as CorSub)} />}
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
