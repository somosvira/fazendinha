import { Loader } from "../../components/Loading";
import { usePiquetes, useLotes } from "../api";
import { toUA } from "../lib/derive";
import { RebHeader } from "@/rebanho/components/RebHeader";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";
import { RebTable } from "@/components/rb/RebTable";

const ESTADO_LABEL: Record<string, string> = {
  OCUPADO: "Ocupado",
  DESCANSO: "Em descanso",
  REFORMA: "Em reforma",
  DISPONIVEL: "Disponível",
};

const ESTADO_TOM: Record<string, "warn" | "bad" | undefined> = {
  REFORMA: "bad",
  DESCANSO: "warn",
};

export function PastoTab() {
  const { data: piquetes } = usePiquetes();
  const { data: lotes, loading: loadingLotes } = useLotes({ estado: "ATIVO" });

  if (loadingLotes) return <main className="rb-main"><RebHeader eyebrow="Corte · pasto" title="Pasto & piquetes" /><Loader /></main>;

  const ocupados = piquetes.filter((p) => p.estado === "OCUPADO");
  const areaAtiva = ocupados.reduce((a, p) => a + p.areaHa, 0);
  const uaTotal = lotes.reduce((a, l) => a + toUA(l.resumo?.pesoMedio ?? 0, l.numCabecas), 0);
  const uaPorHa = areaAtiva > 0 ? uaTotal / areaAtiva : 0;

  return (
    <main className="rb-main">
      <RebHeader eyebrow="Corte · gestão de pasto" title="Pasto & piquetes" />

      <RebKpiStrip cols={4}>
        <RebKpi
          lab="Piquetes"
          val={piquetes.length}
          d={`${ocupados.length} ocupados · ${piquetes.filter((p) => p.estado === "DESCANSO").length} em descanso`}
        />
        <RebKpi lab="Área ocupada" val={<>{areaAtiva.toFixed(1)}<u>ha</u></>} d={`de ${piquetes.reduce((a, p) => a + p.areaHa, 0).toFixed(1)} ha total`} />
        <RebKpi lab="UA total" val={uaTotal.toFixed(1)} d="1 UA = 450 kg" />
        <RebKpi
          lab="Lotação média"
          val={<>{uaPorHa.toFixed(2)}<u>UA/ha</u></>}
          d={uaPorHa > 1.5 ? "acima da capacidade recomendada" : uaPorHa < 0.8 ? "sub-utilizado" : "dentro do recomendado Embrapa"}
          tom={uaPorHa > 1.5 ? "up" : uaPorHa < 0.8 ? undefined : "ok"}
        />
      </RebKpiStrip>

      <h2 className="font-serif text-xl font-medium mb-3">Piquetes</h2>
      <RebTable>
        <thead><tr>
          <th>Código</th><th>Nome</th><th>Capim</th><th>Área</th>
          <th>Lotação máx</th><th>Estado</th><th>Lote atual</th>
        </tr></thead>
        <tbody>
          {piquetes.map((p) => {
            const lote = lotes.find((l) => l.id === p.loteAtualId);
            const ua = lote ? toUA(lote.resumo?.pesoMedio ?? 0, lote.numCabecas) : 0;
            const uaHa = ua / p.areaHa;
            return (
              <tr key={p.id}>
                <td className="rb-anm">{p.codigo}</td>
                <td>{p.nome}</td>
                <td style={{ fontStyle: "italic" }}>{p.capim}</td>
                <td>{p.areaHa.toFixed(1)} ha</td>
                <td>{p.lotacaoMaxUA} UA</td>
                <td><span className={"rb-pill" + (ESTADO_TOM[p.estado] ? " " + ESTADO_TOM[p.estado] : "")}>{ESTADO_LABEL[p.estado]}</span></td>
                <td>
                  {lote
                    ? <>{lote.nome} <small style={{ color: "var(--ink-2)" }}>· {ua.toFixed(1)} UA ({uaHa.toFixed(2)}/ha)</small></>
                    : <span style={{ color: "var(--ink-3)" }}>—{p.diasDescanso ? ` (descanso ${p.diasDescanso}d)` : ""}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </RebTable>
    </main>
  );
}
