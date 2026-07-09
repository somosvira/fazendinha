import { Loader } from "../../components/Loading";
import type { PlantioTab } from "../nav";
import { insightDaLavoura } from "../mock";
import { IaInsightBand } from "./IaInsight";
import { useDashboard } from "../api";
import { FASES_LABEL } from "../lib/fenologia";

export function DashboardView({ onNav }: { onNav: (t: PlantioTab) => void }) {
  const { data, loading } = useDashboard();
  const insight = insightDaLavoura("colheita");
  if (loading || !data) {
    return <main className="rb-main">
      <div className="rb-head"><h1>Lavoura · Painel</h1></div>
      <Loader />
    </main>;
  }
  const k = data.k;
  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Lavoura Rio Novo · {k.areaTotal} ha · {k.talhoesAtivos} talhões ativos</div>
      <div className="rb-head"><h1>Painel da lavoura</h1></div>

      <div className="rb-kstrip" style={{ ["--cols" as any]: 6 }}>
        <div className="rb-k">
          <div className="lab">Área</div>
          <div className="val">{k.areaTotal}<u>ha</u></div>
          <div className="d">{k.talhoesAtivos} talhões ativos</div>
        </div>
        <div className="rb-k">
          <div className="lab">Fase predominante</div>
          <div className="val" style={{ fontSize: 24 }}>{FASES_LABEL[k.fase]}</div>
          <div className="d">na lavoura toda</div>
        </div>
        <div className="rb-k">
          <div className="lab">Sacas esperadas</div>
          <div className="val">{k.sacasEsperadas.toLocaleString("pt-BR")}<u>sc</u></div>
          <div className="d">safra 2026 (estimado)</div>
        </div>
        <div className="rb-k">
          <div className="lab">Já colhidas</div>
          <div className="val">{k.sacasJaColhidas.toLocaleString("pt-BR")}<u>sc</u></div>
          <div className="d">benefício parcial</div>
        </div>
        <div className="rb-k">
          <div className="lab">Produtividade média</div>
          <div className="val">{k.produtividadeMedia}<u>sc/ha</u></div>
          <div className="d">{k.variedades} variedades</div>
        </div>
        <div className="rb-k">
          <div className="lab">Em alerta fito</div>
          <div className="val">{k.alertaFito}<u>talhões</u></div>
          <div className={"d " + (k.alertaFito > 0 ? "rb-up" : "rb-ok")}>
            {k.alertaFito > 0 ? "acima do limiar MIP" : "dentro do limiar"}
          </div>
        </div>
      </div>

      {insight && <IaInsightBand insight={insight} />}

      <div className="rb-dash">
        <div className="rb-dcards">
          {data.dominios.map((d) => (
            <button key={d.tab} className="rb-dcard" onClick={() => onNav(d.tab.replace("pla-", "") as PlantioTab)}>
              <h4>{d.titulo}<span className="go">ver →</span></h4>
              <ul>{d.linhas.map((l, i) => <li key={i}>{l}</li>)}</ul>
            </button>
          ))}
        </div>
        <div className="rb-alerts">
          <h4>Talhões em situação de alerta</h4>
          {data.alertas.map((al) => (
            <button key={al.label} className="rb-alert" onClick={() => onNav(al.tab.replace("pla-", "") as PlantioTab)}>
              <span>{al.label}</span>
              <span className={"n " + (al.n === 0 ? "ok" : al.tom ?? "")}>{al.n}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
