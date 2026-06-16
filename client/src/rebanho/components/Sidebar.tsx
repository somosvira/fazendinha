import type { RebanhoTab } from "../nav";

const ICONS: Record<RebanhoTab, JSX.Element> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  animal: <><circle cx="12" cy="9" r="5" /><path d="M5 21c1-4 4-6 7-6s6 2 7 6" /></>,
  reproducao: <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" />,
  sanidade: <path d="M12 6v12M6 12h12" />,
  nutricao: <path d="M12 21c5-3 8-7 8-12 0-1.5-.5-3-1-4-3 0-7 1-9 4s-2 8-2 12c2-2 4-3 6-4" />,
  ia: <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />,
};

const ITENS: { id: RebanhoTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "animal", label: "Animal" },
  { id: "reproducao", label: "Reprodução" },
  { id: "sanidade", label: "Sanidade" },
  { id: "nutricao", label: "Nutrição" },
  { id: "ia", label: "IA" },
];

export function Sidebar({ atual, onNav }: { atual: RebanhoTab; onNav: (t: RebanhoTab) => void }) {
  return (
    <aside className="rb-side">
      <div className="brand">
        <div className="lg">Rio Novo</div>
        <div className="farm"><span>🌾 Sítio São Francisco</span><span>▾</span></div>
      </div>
      <div className="grp">Gestão de rebanho</div>
      {ITENS.map((it) => (
        <button key={it.id} className={"navi" + (atual === it.id ? " on" : "")} onClick={() => onNav(it.id)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>{ICONS[it.id]}</svg>
          {it.label}
        </button>
      ))}
      <button className="ia-btn" onClick={() => onNav("ia")}>✦ Perguntar à IA</button>
      <div className="spacer" />
      <div className="user"><div className="av">M</div><div><div className="nm">Marco Antônio</div><div className="rl">Gerente</div></div></div>
    </aside>
  );
}
