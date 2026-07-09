import { Loader } from "../../components/Loading";
import type { RebanhoTab } from "../nav";
import { insightDoRebanho } from "../mock";
import { IaInsightBand } from "./IaInsight";
import { useDashboard } from "../api";

export function DashboardView({ onNav }: { onNav: (t: RebanhoTab) => void }) {
  const { data, loading, erro } = useDashboard();
  const insight = insightDoRebanho("reproducao");
  if (loading) return <main className="rb-main"><div className="rb-head"><h1>Dashboard</h1></div><Loader /></main>;
  if (erro || !data) return <main className="rb-main"><div className="rb-head"><h1>Dashboard</h1></div><p className="rb-sub" style={{ color: "var(--prejuizo)" }}>Erro: {erro}</p></main>;
  const k = data.kpis;
  const pctLactacao = k.rebanhoAtivo > 0 ? Math.round((k.emLactacao / k.rebanhoAtivo) * 100) : 0;
  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Sítio São Francisco · {k.rebanhoAtivo} animais</div>
      <div className="rb-head"><h1>Dashboard</h1></div>
      <div className="rb-kstrip" style={{ ["--cols" as any]: 6 }}>
        <div className="rb-k">
          <div className="lab">Rebanho ativo</div>
          <div className="val">{k.rebanhoAtivo}</div>
          <div className="d">Total da fazenda</div>
        </div>
        <div className="rb-k">
          <div className="lab">Em lactação</div>
          <div className="val">{k.emLactacao}<u>vacas</u></div>
          <div className="d">{pctLactacao}% do rebanho</div>
        </div>
        <div className="rb-k">
          <div className="lab">Secas</div>
          <div className="val">{k.secas}<u>vacas</u></div>
          <div className="d">Em preparo para o próximo parto</div>
        </div>
        <div className="rb-k">
          <div className="lab">Produção média</div>
          <div className="val">{k.producaoMedia ?? "—"}<u>L/vaca·dia</u></div>
          <div className="d">Média do rebanho em lactação</div>
        </div>
        <div className="rb-k">
          <div className="lab">Gestantes</div>
          <div className="val">{k.gestantes}<u>prenhes</u></div>
          <div className="d">Próximos partos no calendário</div>
        </div>
        <div className="rb-k">
          <div className="lab">Prenhez</div>
          <div className="val">{k.prenhez}<u>%</u></div>
          <div className={"d " + (k.prenhez >= 35 ? "rb-ok" : k.prenhez >= 25 ? "" : "rb-up")}>
            {k.prenhez >= 35 ? "Acima da meta" : k.prenhez >= 25 ? "Dentro do esperado" : "Abaixo da meta"}
          </div>
        </div>
      </div>
      {insight && <IaInsightBand insight={insight} />}
      <div className="rb-dash">
        <div className="rb-dcards">
          {data.dominios.map((d) => (
            <button key={d.tab} className="rb-dcard" onClick={() => onNav(d.tab as RebanhoTab)}>
              <h4>{d.titulo}<span className="go">ver →</span></h4>
              <ul>{d.linhas.map((l, i) => <li key={i}>{l}</li>)}</ul>
            </button>
          ))}
        </div>
        <div className="rb-alerts">
          <h4>Animais em situação de alerta</h4>
          {data.alertas.map((al) => (
            <button key={al.label} className="rb-alert" onClick={() => onNav(al.tab as RebanhoTab)}>
              <span>{al.label}</span><span className={"n " + (al.n === 0 ? "ok" : al.tom)}>{al.n}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
