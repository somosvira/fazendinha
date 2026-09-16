import { useEffect, useState } from "react";
import { Loader } from "../../components/Loading";
import { useProducao, registrarProducaoLote, listarGrupos, type GrupoDTO } from "../api";
import { HOJE } from "../HOJE";
import { RebHeader } from "./RebHeader";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";
import { RebTable } from "@/components/rb/RebTable";
import { RebButton } from "@/components/rb/RebButton";
import { RebField } from "@/components/rb/RebField";
import { CampoData } from "@/components/CampoData";
import { SelectBusca } from "@/components/SelectBusca";
import { RebMain, RebBox, RebAnm, RebEmpty } from "@/components/rb/RebPrimitives";
import { QualidadeLeiteSection } from "./QualidadeLeiteSection";
import { TanquesSection } from "./TanquesSection";
import { AnimalIdentity } from "./AnimalIdentity";

// "DD/MM HH:mm" local — fim da carência (leite liberado a partir daí).
function fmtDataHora(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

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
    <RebBox style={{ marginTop: 18 }}>
      <h4>Registrar produção do tanque / lote</h4>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <RebField label="Lote" style={{ marginBottom: 0 }}>
          <SelectBusca variante="sublinhado" className="min-w-48" aria-label="Lote" value={grupoId} onValueChange={setGrupoId} opcaoVazia="Fazenda inteira" buscaPlaceholder="Buscar lote…" options={grupos.map((g) => ({ value: String(g.id), label: g.nome }))} />
        </RebField>
        <RebField label="Data*" style={{ marginBottom: 0 }}><CampoData variante="sublinhado" className="min-w-36" aria-label="Data" value={data} onChange={setData} /></RebField>
        <RebField label="Litros*" style={{ marginBottom: 0 }}><input type="number" min={0} step="0.1" value={litros} onChange={(e) => setLitros(e.target.value)} /></RebField>
        <RebButton variant="pri" disabled={salvando || !litros} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</RebButton>
      </div>
      {erro && <p className="mt-[7px] text-sm text-prejuizo">{erro}</p>}
    </RebBox>
  );
}

export function ProducaoTab() {
  const { data, loading, erro, recarregar } = useProducao();
  if (loading) return <RebMain><RebHeader eyebrow="Rebanho" title="Produção" /><Loader /></RebMain>;
  if (erro || !data) return <RebMain><RebHeader title="Produção" /><p className="mt-[7px] text-sm text-prejuizo">Erro: {erro}</p></RebMain>;

  const tanque = data.modo === "TANQUE_LOTE";
  const modoLabel = data.modo === "ORDENHA" ? "Controle leiteiro" : data.modo === "TOTAL_DIARIO" ? "Total diário" : "Tanque / lote";

  return (
    <RebMain>
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
            <tbody>{(data.lotes ?? []).map((l) => (
              <tr key={l.grupo}><td><RebAnm>{l.grupo}</RebAnm></td><td>{l.litros != null ? `${l.litros} L` : "—"}</td><td>{l.vacas}</td><td>{l.rateio != null ? `${l.rateio} L/d` : "—"}</td></tr>
            ))}</tbody>
          </RebTable>
          {(data.lotes ?? []).length === 0 && <RebEmpty style={{ marginTop: 12 }}>Nenhuma produção de lote registrada ainda.</RebEmpty>}
          <LoteForm onSalvo={recarregar} />
        </>
      ) : (
        <>
          <h2 className="font-serif text-xl font-medium mb-3">Ranking de produção</h2>
          <RebTable>
            <thead><tr><th>Vaca</th><th>Produção</th><th>Carência</th></tr></thead>
            <tbody>{(data.ranking ?? []).map((r) => (
              <tr key={r.numero}>
                <td><AnimalIdentity numero={r.numero} nome={r.nome} /></td>
                <td>{r.litros} L/d</td>
                <td>
                  {r.carencia ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-[13px] border border-[#E4B7B0] bg-[#FBEDEB] px-[9px] py-[3px] text-sm font-semibold text-[color:var(--prejuizo,#9A3B2E)]"
                      title={`Não vender o leite desta vaca até ${fmtDataHora(r.carencia.fim)}`}
                    >
                      ⚠️ não vender até {fmtDataHora(r.carencia.fim)}
                    </span>
                  ) : (
                    <span className="text-sm text-ink-3">—</span>
                  )}
                </td>
              </tr>
            ))}</tbody>
          </RebTable>
          {(data.ranking ?? []).length === 0 && <RebEmpty style={{ marginTop: 12 }}>Nenhuma vaca em lactação com produção registrada.</RebEmpty>}
          <p className="mt-[14px] text-sm text-ink-3">Registre controles na ficha de cada animal (+ Registrar controle).</p>
        </>
      )}

      <QualidadeLeiteSection />
      <TanquesSection />
    </RebMain>
  );
}
