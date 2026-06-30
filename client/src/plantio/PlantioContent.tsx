import { useState } from "react";
import { TalhaoCockpit } from "./components/TalhaoCockpit";
import { TalhaoTab } from "./components/TalhaoTab";
import { FenologiaTab } from "./components/FenologiaTab";
import { FitossanidadeTab } from "./components/FitossanidadeTab";
import { NutricaoTab } from "./components/NutricaoTab";
import { ColheitaTab } from "./components/ColheitaTab";
import { PlanejamentoTab } from "./components/PlanejamentoTab";
import { EstoqueTab } from "./components/EstoqueTab";
import { CustoTab } from "./components/CustoTab";
import { IaView } from "./components/IaView";
import { DashboardView } from "./components/DashboardView";
import { TalhaoForm } from "./components/TalhaoForm";
import { OperacaoForm } from "./components/OperacaoForm";
import type { Talhao } from "./types";

export type PlaSub = "dashboard" | "talhao" | "fenologia" | "fitossanidade" | "nutricao" | "colheita" | "planejamento" | "estoque" | "custo" | "ia";

/* Espelho do RebanhoContent: roteia entre as sub-abas do módulo Plantio
 * e gerencia os modais (novo talhão, operação inline). Quando o usuário
 * clica numa linha em Fito/Nutrição, abrimos a modal de operação com o
 * domínio travado; no Talhão e Fenologia, abrimos o cockpit. */
export function PlantioContent({ aba, onNavPla }: { aba: PlaSub; onNavPla?: (aba: PlaSub) => void }) {
  const [talhaoId, setTalhaoId] = useState<string | null>(null);
  const [form, setForm] = useState<{ modo: "novo" | "editar" | "baixa"; talhao?: Talhao } | null>(null);
  const [registroInline, setRegistroInline] = useState<{ talhao: Talhao; dominio: "fitossanidade" | "nutricao" } | null>(null);
  // Contador de recarga: bump força o remount (e o refetch) da tab/cockpit após salvar.
  const [recarga, setRecarga] = useState(0);

  return (
    <div className="rb">
      {talhaoId
        ? <TalhaoCockpit key={recarga} talhaoId={talhaoId} onVoltar={() => setTalhaoId(null)} />
        : aba === "talhao"
          ? <TalhaoTab key={recarga} onAbrirTalhao={setTalhaoId} onNovo={() => setForm({ modo: "novo" })} />
          : aba === "fenologia"
            ? <FenologiaTab onAbrirTalhao={setTalhaoId} />
            : aba === "fitossanidade"
              ? <FitossanidadeTab onRegistrarOperacao={(talhao) => setRegistroInline({ talhao, dominio: "fitossanidade" })} />
              : aba === "nutricao"
                ? <NutricaoTab onRegistrarOperacao={(talhao) => setRegistroInline({ talhao, dominio: "nutricao" })} />
                : aba === "colheita"
                  ? <ColheitaTab onAbrirTalhao={setTalhaoId} />
                  : aba === "planejamento"
                    ? <PlanejamentoTab />
                    : aba === "estoque"
                      ? <EstoqueTab />
                      : aba === "custo"
                        ? <CustoTab />
                        : aba === "dashboard"
                          ? <DashboardView onNav={(t) => onNavPla?.(t as PlaSub)} />
                          : <IaView />}
      {form && <TalhaoForm modo={form.modo} talhao={form.talhao} onFechar={() => setForm(null)} onSalvo={() => { setForm(null); setRecarga((n) => n + 1); }} />}
      {registroInline && (
        <OperacaoForm
          talhaoId={registroInline.talhao.id}
          talhao={registroInline.talhao}
          dominioFixo={registroInline.dominio}
          onFechar={() => setRegistroInline(null)}
          onSalvo={() => setRegistroInline(null)}
        />
      )}
    </div>
  );
}
