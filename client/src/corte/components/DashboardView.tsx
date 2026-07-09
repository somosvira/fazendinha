import { Loader } from "../../components/Loading";
import type { CorteTab } from "../nav";
import { insightDaFazenda } from "../mock";
import { IaInsightBand } from "./IaInsight";
import { useDashboard } from "../api";

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function DashboardView({ onNav }: { onNav: (t: CorteTab) => void }) {
  const { data, loading } = useDashboard();
  const insight = insightDaFazenda("comercial");

  if (loading || !data) {
    return <main className="rb-main"><div className="rb-head"><h1>Corte · Painel</h1></div><Loader /></main>;
  }
  const k = data.k;
  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Atividade Corte · Rio Novo · {k.totalCabecas} cabeças · {k.totalAtivos} lotes</div>
      <div className="rb-head"><h1>Painel da pecuária</h1></div>

      <div className="rb-kstrip" style={{ ["--cols" as any]: 6 }}>
        <div className="rb-k">
          <div className="lab">Plantel</div>
          <div className="val">{k.totalCabecas}<u>cab</u></div>
          <div className="d">{k.totalAtivos} lotes ativos</div>
        </div>
        <div className="rb-k">
          <div className="lab">UA total</div>
          <div className="val">{k.uaTotal}<u>UA</u></div>
          <div className="d">1 UA = 450 kg</div>
        </div>
        <div className="rb-k">
          <div className="lab">@ no estoque</div>
          <div className="val">{k.arrobasEstoque.toFixed(0)}<u>@</u></div>
          <div className="d">carcaça · rendimento 52%</div>
        </div>
        <div className="rb-k">
          <div className="lab">@ prontas (≥ 480 kg)</div>
          <div className="val">{k.arrobasProntas.toFixed(0)}<u>@</u></div>
          <div className="d rb-ok">disponíveis pra venda</div>
        </div>
        <div className="rb-k" style={{ borderLeft: "3px solid var(--leite)" }}>
          <div className="lab">Valor de estoque</div>
          <div className="val" style={{ fontSize: 26, color: "var(--cafe)" }}>{money(k.valorEstoque)}</div>
          <div className="d">@ spot R$ {k.precoArrobaSpot}</div>
        </div>
        <div className="rb-k">
          <div className="lab">GMD médio</div>
          <div className="val">{k.gmdMedio.toFixed(2)}<u>kg/d</u></div>
          <div className="d">lotes em ganho</div>
        </div>
      </div>

      {insight && <IaInsightBand insight={insight} />}

      <div className="rb-dash">
        <div className="rb-dcards">
          {data.dominios.map((d) => (
            <button key={d.tab} className="rb-dcard" onClick={() => onNav(d.tab.replace("cor-", "") as CorteTab)}>
              <h4>{d.titulo}<span className="go">ver →</span></h4>
              <ul>{d.linhas.map((l, i) => <li key={i}>{l}</li>)}</ul>
            </button>
          ))}
        </div>
        <div className="rb-alerts">
          <h4>Alertas e oportunidades</h4>
          {data.alertas.map((al) => (
            <button key={al.label} className="rb-alert" onClick={() => onNav(al.tab.replace("cor-", "") as CorteTab)}>
              <span>{al.label}</span>
              <span className={"n " + (al.n === 0 ? "ok" : al.tom ?? "")}>{al.n}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Pull-quote editorial: curva B3 contango — narrativa que o produtor entende */}
      <div className="rb-box" style={{ marginTop: 26, borderLeft: "3px solid var(--leite)" }}>
        <h3 style={{ margin: "0 0 6px" }}>Janela comercial: B3 sinaliza contango</h3>
        <p className="rb-sub" style={{ marginTop: 0 }}>
          A curva futura B3/Esalq fechou junho com <b>contango</b>: arroba spot em <b>R$ {k.precoArrobaSpot}/@</b> (MG),
          set/2026 em <b>R$ {k.precoArrobaSet}/@</b>, out/2026 em ~R$ 356. Para os {k.arrobasProntas.toFixed(0)} @ prontos
          hoje, atrasar a venda em ~60 dias renderia <b>{money(k.arrobasProntas * (k.precoArrobaSet - k.precoArrobaSpot))}</b>
          {" "}— descontando consumo de pasto e risco. Use a aba <b>Comercial</b> para simular cada lote.
        </p>
      </div>
    </main>
  );
}
