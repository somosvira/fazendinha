import { useState } from "react";
import { useRebanhoNav } from "./nav";
import { Sidebar } from "./components/Sidebar";
import { HerdDomainView } from "./components/HerdDomainView";
import { AnimalCockpit } from "./components/AnimalCockpit";
import { AnimalTab } from "./components/AnimalTab";
import { ReproducaoTab } from "./components/ReproducaoTab";
import { SanidadeTab } from "./components/SanidadeTab";
import { NutricaoTab } from "./components/NutricaoTab";
import { AnimalForm } from "./components/AnimalForm";
import { DashboardView } from "./components/DashboardView";
import { IaView } from "./components/IaView";
import { DOMAINS } from "./domains";
import { resumos, insightDoRebanho } from "./mock";

export function RebanhoApp() {
  const nav = useRebanhoNav();
  const domainKey = (["animal", "reproducao", "sanidade", "nutricao"] as const).includes(nav.tab as any) ? (nav.tab as keyof typeof DOMAINS) : null;
  const [form, setForm] = useState<{ modo: "novo" | "editar" | "baixa"; animal?: import("./types").Animal } | null>(null);
  const [recarga, setRecarga] = useState(0);

  return (
    <div className="rb">
      <Sidebar atual={nav.tab} onNav={nav.irPara} />
      {nav.animalId
        ? <AnimalCockpit key={recarga} animalId={nav.animalId} onVoltar={nav.voltarAoRebanho} onAbrirAnimal={nav.abrirAnimal} onEditar={(a) => setForm({ modo: "editar", animal: a })} onBaixa={(a) => setForm({ modo: "baixa", animal: a })} />
        : domainKey === "animal"
          ? <AnimalTab key={recarga} onAbrirAnimal={nav.abrirAnimal} onNovo={() => setForm({ modo: "novo" })} />
          : domainKey === "reproducao"
            ? <ReproducaoTab onAbrirAnimal={nav.abrirAnimal} />
            : domainKey === "sanidade"
            ? <SanidadeTab onAbrirAnimal={nav.abrirAnimal} />
            : domainKey === "nutricao"
            ? <NutricaoTab />
            : domainKey
              ? <HerdDomainView key={domainKey} config={DOMAINS[domainKey]} resumos={resumos} insight={insightDoRebanho(domainKey)} onAbrirAnimal={nav.abrirAnimal} />
              : nav.tab === "dashboard"
                ? <DashboardView onNav={nav.irPara} />
                : <IaView />}
      {form && <AnimalForm modo={form.modo} animal={form.animal} onFechar={() => setForm(null)} onSalvo={() => { setForm(null); setRecarga((n) => n + 1); }} />}
    </div>
  );
}
