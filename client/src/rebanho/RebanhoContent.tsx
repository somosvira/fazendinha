import { useEffect, useState } from "react";
import { AnimalCockpit } from "./components/AnimalCockpit";
import { AnimalTab } from "./components/AnimalTab";
import { ReproducaoTab } from "./components/ReproducaoTab";
import { SanidadeTab } from "./components/SanidadeTab";
import { NutricaoTab } from "./components/NutricaoTab";
import { AnimalForm } from "./components/AnimalForm";
import { DashboardView } from "./components/DashboardView";
import { IaView } from "./components/IaView";
import type { Animal } from "./types";

export type RebSub = "dashboard" | "animal" | "reproducao" | "sanidade" | "nutricao" | "ia";

export function RebanhoContent({ aba, onNavReb }: { aba: RebSub; onNavReb?: (aba: RebSub) => void }) {
  const [animalId, setAnimalId] = useState<string | null>(null);
  const [form, setForm] = useState<{ modo: "novo" | "editar" | "baixa"; animal?: Animal } | null>(null);
  const [recarga, setRecarga] = useState(0);
  // trocar de aba fecha o cockpit
  useEffect(() => { setAnimalId(null); }, [aba]);

  return (
    <div className="rb">
      {animalId
        ? <AnimalCockpit key={recarga} animalId={animalId} onVoltar={() => setAnimalId(null)} onAbrirAnimal={setAnimalId} onEditar={(a) => setForm({ modo: "editar", animal: a })} onBaixa={(a) => setForm({ modo: "baixa", animal: a })} />
        : aba === "animal"
          ? <AnimalTab key={recarga} onAbrirAnimal={setAnimalId} onNovo={() => setForm({ modo: "novo" })} />
          : aba === "reproducao"
            ? <ReproducaoTab onAbrirAnimal={setAnimalId} />
            : aba === "sanidade"
              ? <SanidadeTab onAbrirAnimal={setAnimalId} />
              : aba === "nutricao"
                ? <NutricaoTab />
                : aba === "dashboard"
                  ? <DashboardView onNav={(t) => onNavReb?.(t as RebSub)} />
                  : <IaView />}
      {form && <AnimalForm modo={form.modo} animal={form.animal} onFechar={() => setForm(null)} onSalvo={() => { setForm(null); setRecarga((n) => n + 1); }} />}
    </div>
  );
}
