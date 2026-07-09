import { useEffect, useState } from "react";
import { Loader } from "../../components/Loading";
import { useProducao, registrarProducaoLote, listarGrupos, type GrupoDTO } from "../api";
import { HOJE } from "../HOJE";

function LoteForm({ onSalvo }: { onSalvo: () => void }) {
  const [grupos, setGrupos] = useState<GrupoDTO[]>([]);
  const [grupoId, setGrupoId] = useState("");
  const [data, setData] = useState(HOJE);
  const [litros, setLitros] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { listarGrupos().then(setGrupos).catch(() => {}); }, []);

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      await registrarProducaoLote({ grupoId: grupoId ? Number(grupoId) : undefined, data, litros: Number(litros) });
      setLitros("");
      onSalvo();
    } catch (e: any) { setErro(e.message); } finally { setSalvando(false); }
  }

  return (
    <div className="rb-box" style={{ marginTop: 18 }}>
      <h4>Registrar produção do tanque / lote</h4>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label className="rb-fld" style={{ marginBottom: 0 }}>Lote
          <select value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
            <option value="">Fazenda inteira</option>
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
        </label>
        <label className="rb-fld" style={{ marginBottom: 0 }}>Data*<input type="date" value={data} onChange={(e) => setData(e.target.value)} /></label>
        <label className="rb-fld" style={{ marginBottom: 0 }}>Litros*<input type="number" min={0} step="0.1" value={litros} onChange={(e) => setLitros(e.target.value)} /></label>
        <button className="rb-btn pri" disabled={salvando || !litros} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
      </div>
      {erro && <p style={{ color: "var(--neg)", fontSize: 13, marginTop: 8 }}>{erro}</p>}
    </div>
  );
}

export function ProducaoTab() {
  const { data, loading, erro, recarregar } = useProducao();
  if (loading) return <main className="rb-main"><div className="rb-eyebrow">Rebanho</div><div className="rb-head"><h1>Produção</h1></div><Loader /></main>;
  if (erro || !data) return <main className="rb-main"><div className="rb-head"><h1>Produção</h1></div><p className="rb-sub" style={{ color: "var(--neg)" }}>Erro: {erro}</p></main>;

  const tanque = data.modo === "TANQUE_LOTE";
  const modoLabel = data.modo === "ORDENHA" ? "Controle leiteiro" : data.modo === "TOTAL_DIARIO" ? "Total diário" : "Tanque / lote";

  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Rebanho · medição: {modoLabel}</div>
      <div className="rb-head"><h1>Produção</h1></div>

      <div className="rb-kstrip" style={{ ["--cols" as any]: 3 }}>
        <div className="rb-k"><div className="lab">Produção total</div><div className="val">{data.totalDia}<small style={{ fontSize: 13 }}>L</small></div><div className="d">por dia</div></div>
        <div className="rb-k"><div className="lab">Média por vaca</div><div className="val">{data.mediaVaca ?? (data.emLactacao ? Math.round((data.totalDia / data.emLactacao) * 10) / 10 : "—")}<small style={{ fontSize: 13 }}>L</small></div><div className="d">vaca/dia</div></div>
        <div className="rb-k"><div className="lab">Em lactação</div><div className="val">{data.emLactacao}</div><div className="d">vacas</div></div>
      </div>

      {tanque ? (
        <>
          <h2 className="rb-sec-title">Lotes</h2>
          <div className="rb-tbl-wrap"><table className="rb-tbl">
            <thead><tr><th>Lote</th><th>Litros/dia</th><th>Vacas</th><th>Rateio por vaca</th></tr></thead>
            <tbody>{(data.lotes ?? []).map((l, i) => (
              <tr key={i}><td className="rb-anm">{l.grupo}</td><td>{l.litros != null ? `${l.litros} L` : "—"}</td><td>{l.vacas}</td><td>{l.rateio != null ? `${l.rateio} L/d` : "—"}</td></tr>
            ))}</tbody>
          </table></div>
          {(data.lotes ?? []).length === 0 && <div className="rb-empty" style={{ marginTop: 12 }}>Nenhuma produção de lote registrada ainda.</div>}
          <LoteForm onSalvo={recarregar} />
        </>
      ) : (
        <>
          <h2 className="rb-sec-title">Ranking de produção</h2>
          <div className="rb-tbl-wrap"><table className="rb-tbl">
            <thead><tr><th>Vaca</th><th>Produção</th></tr></thead>
            <tbody>{(data.ranking ?? []).map((r) => (
              <tr key={r.numero}>
                <td className="rb-anm">{r.nome ? <>{r.nome} <small>#{r.numero}</small></> : <>#{r.numero}</>}</td>
                <td>{r.litros} L/d</td>
              </tr>
            ))}</tbody>
          </table></div>
          {(data.ranking ?? []).length === 0 && <div className="rb-empty" style={{ marginTop: 12 }}>Nenhuma vaca em lactação com produção registrada.</div>}
          <p className="rb-sub" style={{ marginTop: 14 }}>Registre controles na ficha de cada animal (+ Registrar controle).</p>
        </>
      )}
    </main>
  );
}
