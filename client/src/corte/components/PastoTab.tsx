import { Loader } from "../../components/Loading";
import { usePiquetes, useLotes } from "../api";
import { toUA } from "../lib/derive";

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

  if (loadingLotes) return <main className="rb-main"><div className="rb-eyebrow">Corte · pasto</div><div className="rb-head"><h1>Pasto & piquetes</h1></div><Loader /></main>;

  const ocupados = piquetes.filter((p) => p.estado === "OCUPADO");
  const areaAtiva = ocupados.reduce((a, p) => a + p.areaHa, 0);
  const uaTotal = lotes.reduce((a, l) => a + toUA(l.resumo?.pesoMedio ?? 0, l.numCabecas), 0);
  const uaPorHa = areaAtiva > 0 ? uaTotal / areaAtiva : 0;

  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Corte · gestão de pasto</div>
      <div className="rb-head"><h1>Pasto & piquetes</h1></div>

      <div className="rb-kstrip" style={{ ["--cols" as any]: 4 }}>
        <div className="rb-k">
          <div className="lab">Piquetes</div>
          <div className="val">{piquetes.length}</div>
          <div className="d">{ocupados.length} ocupados · {piquetes.filter((p) => p.estado === "DESCANSO").length} em descanso</div>
        </div>
        <div className="rb-k">
          <div className="lab">Área ocupada</div>
          <div className="val">{areaAtiva.toFixed(1)}<u>ha</u></div>
          <div className="d">de {piquetes.reduce((a, p) => a + p.areaHa, 0).toFixed(1)} ha total</div>
        </div>
        <div className="rb-k">
          <div className="lab">UA total</div>
          <div className="val">{uaTotal.toFixed(1)}</div>
          <div className="d">1 UA = 450 kg</div>
        </div>
        <div className="rb-k">
          <div className="lab">Lotação média</div>
          <div className="val">{uaPorHa.toFixed(2)}<u>UA/ha</u></div>
          <div className={"d " + (uaPorHa > 1.5 ? "rb-up" : uaPorHa < 0.8 ? "" : "rb-ok")}>
            {uaPorHa > 1.5 ? "acima da capacidade recomendada" : uaPorHa < 0.8 ? "sub-utilizado" : "dentro do recomendado Embrapa"}
          </div>
        </div>
      </div>

      <h2 className="rb-sec-title">Piquetes</h2>
      <div className="rb-tbl-wrap"><table className="rb-tbl">
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
      </table></div>
    </main>
  );
}
