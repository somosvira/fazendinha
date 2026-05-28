import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import type { Dashboard as Dash, Serie, AtividadeNome } from "../types";
import { apiGet } from "../api";
import { money, moneyCompact, pct } from "../format";

type Tipo = "REALIZADO" | "PROJECAO";
type AtivBar = AtividadeNome | "Consolidado";

const C = {
  leite: "#2f6fed",
  cafe: "#a9551f",
  outros: "#6b7a6f",
  receita: "#2e8b57",
  despesa: "#d9534f",
  investimento: "#7c5cd6",
  pos: "#2e8b57",
  neg: "#c0392b",
};

const GRUPO_CORES = [
  "#2e6b3e", "#3b82f6", "#b06b4a", "#e0a23b", "#7c5cd6",
  "#d9534f", "#16a085", "#8e7cc3", "#c98a3b", "#5d6d7e", "#d96fa0",
];

const ATIV_META: Record<AtividadeNome, { icon: string; cor: string }> = {
  Leite: { icon: "🥛", cor: C.leite },
  Café: { icon: "☕", cor: C.cafe },
  Outros: { icon: "📦", cor: C.outros },
};

// ---- helpers de agregação ----
const sumOver = (map: Record<string, number>, keys: string[]) =>
  keys.reduce((s, k) => s + (map[k] ?? 0), 0);

const resMes = (s: Serie, k: string) => (s.receita[k] ?? 0) - (s.despesa[k] ?? 0);

function kpis(s: Serie, keys: string[]) {
  const receita = sumOver(s.receita, keys);
  const despesa = sumOver(s.despesa, keys);
  const investimento = sumOver(s.investimento, keys);
  const lucroOp = receita - despesa;
  return { receita, despesa, investimento, lucroOp, lucroLiq: lucroOp - investimento, margem: receita ? lucroOp / receita : 0 };
}

function grupoTotais(porGrupo: Record<string, Record<string, number>>, keys: string[]) {
  return Object.entries(porGrupo)
    .map(([name, m]) => ({ name, value: sumOver(m, keys) }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
}

// ---- tooltips ----
function TipMoney({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="tip-label">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="tip-row">
          <span className="tip-dot" style={{ background: p.color }} />
          {p.name}: <strong>{money(p.value)}</strong>
        </div>
      ))}
    </div>
  );
}
function TipPie({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="chart-tip">
      <strong>{p.name}</strong>: {money(p.value)}
    </div>
  );
}

export function Dashboard() {
  const [tipo, setTipo] = useState<Tipo>("REALIZADO");
  const [ano, setAno] = useState<number | "todos">("todos");
  const [ativBar, setAtivBar] = useState<AtivBar>("Leite");
  const [d, setD] = useState<Dash | null>(null);

  useEffect(() => {
    apiGet<Dash>(`/relatorios/dashboard?tipo=${tipo}`).then(setD);
  }, [tipo]);

  const meses = useMemo(
    () => (d ? d.meses.filter((m) => ano === "todos" || m.key.startsWith(String(ano))) : []),
    [d, ano]
  );
  const keys = meses.map((m) => m.key);

  if (!d) return <section className="card"><p className="muted">Carregando painel…</p></section>;

  const kLeite = kpis(d.atividades.Leite, keys);
  const kCafe = kpis(d.atividades.Café, keys);
  const kOutros = kpis(d.atividades.Outros, keys);
  const kCons = kpis(d.consolidado, keys);

  const lineData = meses.map((m) => ({
    mes: m.label,
    Leite: resMes(d.atividades.Leite, m.key),
    Café: resMes(d.atividades.Café, m.key),
    Total: resMes(d.consolidado, m.key),
  }));

  const serieBar = ativBar === "Consolidado" ? d.consolidado : d.atividades[ativBar];
  const barData = meses.map((m) => ({
    mes: m.label,
    Receita: serieBar.receita[m.key] ?? 0,
    Despesa: serieBar.despesa[m.key] ?? 0,
    Investimento: serieBar.investimento[m.key] ?? 0,
  }));
  const barWidth = Math.max(680, meses.length * 70);

  return (
    <section className="dash">
      {/* Toolbar */}
      <div className="card dash-toolbar">
        <div className="seg">
          <button className={tipo === "REALIZADO" ? "on" : ""} onClick={() => setTipo("REALIZADO")}>Realizado</button>
          <button className={tipo === "PROJECAO" ? "on" : ""} onClick={() => setTipo("PROJECAO")}>Projeção</button>
        </div>
        <label className="inline-field">
          Período
          <select name="periodo" value={String(ano)} onChange={(e) => setAno(e.target.value === "todos" ? "todos" : Number(e.target.value))}>
            <option value="todos">Todos os anos</option>
            {d.anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <span className="muted dash-range">{meses.length ? `${meses[0].label} – ${meses[meses.length - 1].label}` : "sem dados"}</span>
      </div>

      {/* Painéis por atividade */}
      <div className="ativ-grid">
        <AtividadePanel nome="Leite" k={kLeite} grupos={grupoTotais(d.atividades.Leite.despesaPorGrupo, keys)} />
        <AtividadePanel nome="Café" k={kCafe} grupos={grupoTotais(d.atividades.Café.despesaPorGrupo, keys)} />
      </div>

      {/* KPIs consolidados */}
      <div className="card">
        <h3 className="dash-h3">Consolidado da fazenda</h3>
        <div className="kpi-row">
          <Kpi titulo="Receita" valor={kCons.receita} cor={C.receita} />
          <Kpi titulo="Despesa operacional" valor={-kCons.despesa} cor={C.despesa} />
          <Kpi titulo="Investimento" valor={-kCons.investimento} cor={C.investimento} />
          <Kpi titulo="Lucro operacional" valor={kCons.lucroOp} cor={kCons.lucroOp >= 0 ? C.pos : C.neg} destaque />
          <Kpi titulo="Resultado líq. (pós-invest.)" valor={kCons.lucroLiq} cor={kCons.lucroLiq >= 0 ? C.pos : C.neg} />
        </div>
        <p className="muted small">
          Inclui <strong>Outros</strong> (sem centro de custo): receita {money(kOutros.receita)} · despesa {money(kOutros.despesa)}.
        </p>
      </div>

      {/* Lucro mensal por atividade */}
      <div className="card">
        <h3 className="dash-h3">Lucro operacional mensal por atividade</h3>
        <div>
          <ResponsiveContainer width="100%" height={320} minWidth={0}>
            <LineChart data={lineData} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => moneyCompact(v)} tick={{ fontSize: 11 }} width={70} />
              <ReferenceLine y={0} stroke="#bbb" />
              <Tooltip content={<TipMoney />} />
              <Legend />
              <Line type="monotone" dataKey="Leite" stroke={C.leite} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="Café" stroke={C.cafe} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="Total" stroke="#111" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Receita × Despesa × Investimento mensal */}
      <div className="card">
        <div className="dash-card-head">
          <h3 className="dash-h3">Entradas e saídas mensais</h3>
          <div className="seg small">
            {(["Leite", "Café", "Consolidado"] as AtivBar[]).map((a) => (
              <button key={a} className={ativBar === a ? "on" : ""} onClick={() => setAtivBar(a)}>{a}</button>
            ))}
          </div>
        </div>
        <div className="chart-scroll">
          <div style={{ width: barWidth }}>
            <ResponsiveContainer width="100%" height={340} minWidth={0}>
              <BarChart data={barData} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => moneyCompact(v)} tick={{ fontSize: 11 }} width={70} />
                <Tooltip content={<TipMoney />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Legend />
                <Bar dataKey="Receita" fill={C.receita} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Despesa" fill={C.despesa} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Investimento" fill={C.investimento} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---- componentes ----
function Kpi({ titulo, valor, cor, destaque }: { titulo: string; valor: number; cor: string; destaque?: boolean }) {
  return (
    <div className={`kpi ${destaque ? "kpi-destaque" : ""}`}>
      <span className="kpi-titulo">{titulo}</span>
      <span className="kpi-valor" style={{ color: cor }}>{money(valor)}</span>
    </div>
  );
}

function AtividadePanel({
  nome,
  k,
  grupos,
}: {
  nome: AtividadeNome;
  k: ReturnType<typeof kpis>;
  grupos: { name: string; value: number }[];
}) {
  const meta = ATIV_META[nome];
  return (
    <div className="card ativ-panel" style={{ borderTop: `4px solid ${meta.cor}` }}>
      <div className="ativ-head">
        <span className="ativ-icon" style={{ background: meta.cor }}>{meta.icon}</span>
        <div>
          <h3 className="ativ-nome">{nome === "Café" ? "Café (plantio)" : nome === "Leite" ? "Leite (pecuária)" : nome}</h3>
          <span className="muted small">Margem operacional: {pct(k.margem)}</span>
        </div>
        <div className={`ativ-lucro ${k.lucroOp >= 0 ? "pos" : "neg"}`}>
          <small>Lucro operacional</small>
          <strong>{money(k.lucroOp)}</strong>
        </div>
      </div>

      <div className="ativ-kpis">
        <MiniKpi titulo="Receita" valor={k.receita} cor={C.receita} />
        <MiniKpi titulo="Despesa" valor={-k.despesa} cor={C.despesa} />
        <MiniKpi titulo="Investimento" valor={-k.investimento} cor={C.investimento} />
        <MiniKpi titulo="Resultado líq." valor={k.lucroLiq} cor={k.lucroLiq >= 0 ? C.pos : C.neg} />
      </div>

      {grupos.length > 0 ? (
        <div className="ativ-donut">
          <PieChart width={180} height={180}>
            <Pie data={grupos} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={1}>
              {grupos.map((_, i) => <Cell key={i} fill={GRUPO_CORES[i % GRUPO_CORES.length]} />)}
            </Pie>
            <Tooltip content={<TipPie />} />
          </PieChart>
          <ul className="donut-legend">
            {grupos.slice(0, 6).map((g, i) => (
              <li key={g.name}>
                <span className="tip-dot" style={{ background: GRUPO_CORES[i % GRUPO_CORES.length] }} />
                <span className="dl-nome">{g.name}</span>
                <span className="dl-valor">{money(g.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted small">Sem despesas no período.</p>
      )}
    </div>
  );
}

function MiniKpi({ titulo, valor, cor }: { titulo: string; valor: number; cor: string }) {
  return (
    <div className="mini-kpi">
      <span className="mk-titulo">{titulo}</span>
      <span className="mk-valor" style={{ color: cor }}>{money(valor)}</span>
    </div>
  );
}
