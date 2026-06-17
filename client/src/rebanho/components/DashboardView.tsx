import type { RebanhoTab } from "../nav";
import { insightDoRebanho } from "../mock";
import { IaInsightBand } from "./IaInsight";

// Figuras de rebanho representativas — espelham o dashboard real do Ideagri.
// (O mock por-animal alimenta as work-lists/ficha; o dashboard mostra agregados do rebanho.)
const HERD = { ativo: 522, lactacao: 103, secas: 21, prodMediaVaca: "25,8", gestantes: 106, prenhez: 31 };

const DOMINIOS: { tab: RebanhoTab; titulo: string; linhas: string[] }[] = [
  { tab: "reproducao", titulo: "Reprodução", linhas: ["106 gestantes · 33 servidas", "313 vazias (281 atrasadas)", "Prenhez 31% · IEP 488d"] },
  { tab: "sanidade", titulo: "Sanidade", linhas: ["CCS médio 248 mil", "2 vacas em tratamento", "4 com CCS ≥ 400 mil"] },
  { tab: "nutricao", titulo: "Nutrição", linhas: ["3 lotes ativos", "Produção média 26,4 L", "Alta Produção: 2 vacas"] },
  { tab: "animal", titulo: "Animal", linhas: ["519 fêmeas · 36 a desmamar", "103 em lactação · 21 secas", "DEL médio 175 dias"] },
];

const ALERTAS: { label: string; n: number; tom: "bad" | "ok"; tab: RebanhoTab }[] = [
  { label: "Partos atrasados", n: 0, tom: "ok", tab: "reproducao" },
  { label: "Secagens atrasadas", n: 4, tom: "bad", tab: "reproducao" },
  { label: "Vazias atrasadas (PEV)", n: 5, tom: "bad", tab: "reproducao" },
  { label: "Desmamas atrasadas", n: 17, tom: "bad", tab: "animal" },
];

export function DashboardView({ onNav }: { onNav: (t: RebanhoTab) => void }) {
  const insight = insightDoRebanho("reproducao");
  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Sítio São Francisco · {HERD.ativo} animais</div>
      <div className="rb-head"><h1>Dashboard</h1><div className="period">📅 Junho 2026 ▾</div></div>

      <div className="rb-kstrip" style={{ ["--cols" as any]: 6 }}>
        <div className="rb-k"><div className="lab">Rebanho ativo</div><div className="val">{HERD.ativo}</div><div className="d">total</div></div>
        <div className="rb-k"><div className="lab">Em lactação</div><div className="val">{HERD.lactacao}</div><div className="d">vacas</div></div>
        <div className="rb-k"><div className="lab">Secas</div><div className="val">{HERD.secas}</div><div className="d">vacas</div></div>
        <div className="rb-k"><div className="lab">Produção média</div><div className="val">{HERD.prodMediaVaca}<small style={{ fontSize: 13 }}>L</small></div><div className="d">por vaca/dia</div></div>
        <div className="rb-k"><div className="lab">Gestantes</div><div className="val">{HERD.gestantes}</div><div className="d rb-ok">↗ +4</div></div>
        <div className="rb-k"><div className="lab">Prenhez</div><div className="val">{HERD.prenhez}<small style={{ fontSize: 13 }}>%</small></div><div className="d rb-up">↓ era 42%</div></div>
      </div>

      {insight && <IaInsightBand insight={insight} />}

      <div className="rb-dash">
        <div className="rb-dcards">
          {DOMINIOS.map((d) => (
            <button key={d.tab} className="rb-dcard" onClick={() => onNav(d.tab)}>
              <h4>{d.titulo}<span className="go">ver →</span></h4>
              <ul>{d.linhas.map((l, i) => <li key={i}>{l}</li>)}</ul>
            </button>
          ))}
        </div>
        <div className="rb-alerts">
          <h4>Animais em situação de alerta</h4>
          {ALERTAS.map((a) => (
            <button key={a.label} className="rb-alert" onClick={() => onNav(a.tab)}>
              <span>{a.label}</span>
              <span className={"n " + (a.n === 0 ? "ok" : a.tom)}>{a.n}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
