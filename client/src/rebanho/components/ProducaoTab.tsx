import { useEffect, useState } from "react";
import { Loader } from "../../components/Loading";
import { useProducao, registrarProducaoLote, listarGrupos, type GrupoDTO } from "../api";
import { HOJE } from "../HOJE";
import { RebHeader } from "./RebHeader";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";
import { RebTable } from "@/components/rb/RebTable";
import { RebButton } from "@/components/rb/RebButton";
import { RebField } from "@/components/rb/RebField";

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
        <RebField label="Lote" style={{ marginBottom: 0 }}>
          <select className="rb-field-select" value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
            <option value="">Fazenda inteira</option>
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
        </RebField>
        <RebField label="Data*" style={{ marginBottom: 0 }}><input type="date" value={data} onChange={(e) => setData(e.target.value)} /></RebField>
        <RebField label="Litros*" style={{ marginBottom: 0 }}><input type="number" min={0} step="0.1" value={litros} onChange={(e) => setLitros(e.target.value)} /></RebField>
        <RebButton variant="pri" disabled={salvando || !litros} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</RebButton>
      </div>
      {erro && <p className="mt-[7px] text-sm text-prejuizo">{erro}</p>}
    </div>
  );
}

export function ProducaoTab() {
  const { data, loading, erro, recarregar } = useProducao();
  if (loading) return <main className="rb-main"><RebHeader eyebrow="Rebanho" title="Produção" /><Loader /></main>;
  if (erro || !data) return <main className="rb-main"><RebHeader title="Produção" /><p className="mt-[7px] text-sm text-prejuizo">Erro: {erro}</p></main>;

  const tanque = data.modo === "TANQUE_LOTE";
  const modoLabel = data.modo === "ORDENHA" ? "Controle leiteiro" : data.modo === "TOTAL_DIARIO" ? "Total diário" : "Tanque / lote";

  return (
    <main className="rb-main">
      <RebHeader eyebrow={`Rebanho · medição: ${modoLabel}`} title="Produção" />

      <RebKpiStrip cols={3}>
        <RebKpi lab="Produção total" val={data.totalDia} sufixo="L" d="por dia" />
        <RebKpi lab="Média por vaca" val={data.mediaVaca ?? (data.emLactacao ? Math.round((data.totalDia / data.emLactacao) * 10) / 10 : "—")} sufixo="L" d="vaca/dia" />
        <RebKpi lab="Em lactação" val={data.emLactacao} d="vacas" />
      </RebKpiStrip>

      {tanque ? (
        <>
          <h2 className="font-serif text-xl font-medium mb-3">Lotes</h2>
          <RebTable>
            <thead><tr><th>Lote</th><th>Litros/dia</th><th>Vacas</th><th>Rateio por vaca</th></tr></thead>
            <tbody>{(data.lotes ?? []).map((l, i) => (
              <tr key={i}><td className="rb-anm">{l.grupo}</td><td>{l.litros != null ? `${l.litros} L` : "—"}</td><td>{l.vacas}</td><td>{l.rateio != null ? `${l.rateio} L/d` : "—"}</td></tr>
            ))}</tbody>
          </RebTable>
          {(data.lotes ?? []).length === 0 && <div className="rb-empty" style={{ marginTop: 12 }}>Nenhuma produção de lote registrada ainda.</div>}
          <LoteForm onSalvo={recarregar} />
        </>
      ) : (
        <>
          <h2 className="font-serif text-xl font-medium mb-3">Ranking de produção</h2>
          <RebTable>
            <thead><tr><th>Vaca</th><th>Produção</th></tr></thead>
            <tbody>{(data.ranking ?? []).map((r) => (
              <tr key={r.numero}>
                <td className="rb-anm">{r.nome ? <>{r.nome} <small>#{r.numero}</small></> : <>#{r.numero}</>}</td>
                <td>{r.litros} L/d</td>
              </tr>
            ))}</tbody>
          </RebTable>
          {(data.ranking ?? []).length === 0 && <div className="rb-empty" style={{ marginTop: 12 }}>Nenhuma vaca em lactação com produção registrada.</div>}
          <p className="mt-[14px] text-sm text-ink-3">Registre controles na ficha de cada animal (+ Registrar controle).</p>
        </>
      )}
    </main>
  );
}
