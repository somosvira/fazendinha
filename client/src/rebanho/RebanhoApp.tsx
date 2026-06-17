import { useRebanhoNav } from "./nav";
import { Sidebar } from "./components/Sidebar";
import { HerdDomainView } from "./components/HerdDomainView";
import { AnimalCockpit } from "./components/AnimalCockpit";
import { DOMAINS } from "./domains";
import { resumos, insightDoRebanho } from "./mock";

export function RebanhoApp() {
  const nav = useRebanhoNav();
  const domainKey = (["animal", "reproducao", "sanidade", "nutricao"] as const).includes(nav.tab as any) ? (nav.tab as keyof typeof DOMAINS) : null;

  return (
    <div className="rb">
      <Sidebar atual={nav.tab} onNav={nav.irPara} />
      {nav.animalId
        ? <AnimalCockpit animalId={nav.animalId} onVoltar={nav.voltarAoRebanho} onAbrirAnimal={nav.abrirAnimal} />
        : domainKey
          ? <HerdDomainView key={domainKey} config={DOMAINS[domainKey]} resumos={resumos} insight={insightDoRebanho(domainKey)} onAbrirAnimal={nav.abrirAnimal} />
          : <main className="rb-main"><div className="rb-eyebrow">Em breve</div><div className="rb-head"><h1>{nav.tab === "ia" ? "IA" : "Dashboard"}</h1></div><p className="rb-sub">Esta aba entra numa próxima etapa.</p></main>}
    </div>
  );
}
