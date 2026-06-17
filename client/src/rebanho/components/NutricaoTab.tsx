import { useState } from "react";
import { useLotes, useDietas, atribuirDieta } from "../api";
import { DietaForm } from "./DietaForm";
export function NutricaoTab() {
  const { data: lotes, loading, erro, recarregar } = useLotes();
  const { data: dietas, recarregar: recarregarDietas } = useDietas();
  const [novaDieta, setNovaDieta] = useState(false);
  if (loading) return <main className="rb-main"><div className="rb-eyebrow">Rebanho</div><div className="rb-head"><h1>Nutrição</h1></div><p className="rb-sub">Carregando…</p></main>;
  if (erro) return <main className="rb-main"><div className="rb-head"><h1>Nutrição</h1></div><p className="rb-sub" style={{ color: "var(--neg)" }}>Erro: {erro}</p></main>;
  const trocar = async (grupoId: number, dietaId: string) => { await atribuirDieta(grupoId, dietaId ? Number(dietaId) : null); recarregar(); };
  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Rebanho · {lotes.reduce((a, l) => a + l.numAnimais, 0)} animais ativos</div>
      <div className="rb-head"><h1>Nutrição</h1><button className="rb-btn pri" onClick={() => setNovaDieta(true)}>+ Nova dieta</button></div>
      <h2 className="rb-sec-title">Lotes</h2>
      <table className="rb-tbl">
        <thead><tr><th>Lote</th><th>Animais</th><th>Produção média</th><th>Dieta</th></tr></thead>
        <tbody>{lotes.map((l) => (
          <tr key={l.id}><td className="rb-anm">{l.nome}</td><td>{l.numAnimais}</td><td>{l.producaoMedia != null ? `${l.producaoMedia} L/d` : "—"}</td>
            <td><select value={l.dietaId ?? ""} onChange={(e) => trocar(l.id, e.target.value)}><option value="">—</option>{dietas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}</select></td></tr>
        ))}</tbody>
      </table>
      <h2 className="rb-sec-title" style={{ marginTop: 28 }}>Dietas cadastradas</h2>
      <div className="rb-dcards">{dietas.map((d) => (
        <div className="rb-dcard" key={d.id}><h4>{d.nome}</h4><ul>{d.descricao && <li>{d.descricao}</li>}{d.pb != null && <li>{d.pb}% PB</li>}{d.edMcal != null && <li>{d.edMcal} Mcal/kg</li>}</ul></div>
      ))}</div>
      {novaDieta && <DietaForm onFechar={() => setNovaDieta(false)} onSalvo={() => { setNovaDieta(false); recarregarDietas(); }} />}
    </main>
  );
}
