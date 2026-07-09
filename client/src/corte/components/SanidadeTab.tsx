import { Loader } from "../../components/Loading";
import { useLotes } from "../api";
import { LoteDomainView } from "./LoteDomainView";
import { DOMAINS } from "../domains";
import { insightDaFazenda } from "../mock";
import { CALENDARIO_SANITARIO } from "../lib/calendario";
import type { ResumoLote, Lote } from "../types";

export function SanidadeTab({ onRegistrarManejo }: { onRegistrarManejo: (lote: Lote) => void }) {
  const { data, loading } = useLotes({ estado: "ATIVO" });
  if (loading) return <main className="rb-main"><div className="rb-eyebrow">Corte</div><div className="rb-head"><h1>Sanidade</h1></div><Loader /></main>;
  const resumos: ResumoLote[] = data.map((l) => l.resumo ?? ({ loteId: l.id } as ResumoLote));
  const abrir = (id: string) => { const l = data.find((x) => x.id === id); if (l) onRegistrarManejo(l); };

  return (
    <>
      <LoteDomainView
        config={DOMAINS.sanidade}
        resumos={resumos}
        lotes={data}
        insight={insightDaFazenda("sanidade")}
        onAbrirLote={abrir}
        dicaLinha="clique num lote pra registrar manejo sanitário"
      />
      <main className="rb-main" style={{ paddingTop: 0 }}>
        <h2 className="rb-sec-title" style={{ marginTop: 8 }}>Calendário sanitário Embrapa (Sul de Minas)</h2>
        <p className="rb-sec-sub">Cronograma 11 — referência regional. Etapas <b>obrigatórias</b> (aftosa) marcadas em destaque.</p>
        <div className="rb-tbl-wrap"><table className="rb-tbl">
          <thead><tr><th>Mês</th><th>Ação</th><th>Detalhe</th><th>Público</th></tr></thead>
          <tbody>
            {CALENDARIO_SANITARIO.map((i, idx) => (
              <tr key={idx}>
                <td style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 500 }}>
                  {String(i.mes).padStart(2, "0")}
                </td>
                <td className="rb-anm">
                  {i.titulo}
                  {i.obrigatorio && <span className="rb-pill bad" style={{ marginLeft: 8 }}>obrigatório</span>}
                </td>
                <td>{i.detalhe}</td>
                <td>{i.publico}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </main>
    </>
  );
}
