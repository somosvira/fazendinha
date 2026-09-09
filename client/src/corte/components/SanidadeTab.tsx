import { Loader } from "../../components/Loading";
import { useLotes } from "../api";
import { LoteDomainView } from "./LoteDomainView";
import { DOMAINS } from "../domains";
import { insightDaFazenda } from "../mock";
import { CALENDARIO_SANITARIO } from "../lib/calendario";
import { RebHeader } from "@/rebanho/components/RebHeader";
import { RebTable } from "@/components/rb/RebTable";
import { RebMain, RebAnm, RebPill, REB_SEC_SUB } from "@/components/rb/RebPrimitives";
import type { ResumoLote, Lote } from "../types";

export function SanidadeTab({ onRegistrarManejo }: { onRegistrarManejo: (lote: Lote) => void }) {
  const { data, loading } = useLotes({ estado: "ATIVO" });
  if (loading) return <RebMain><RebHeader eyebrow="Pecuária · Lotes coletivos" title="Sanidade" /><Loader /></RebMain>;
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
      <RebMain style={{ paddingTop: 0 }}>
        <h2 className="font-serif text-xl font-medium mb-3" style={{ marginTop: 8 }}>Calendário sanitário Embrapa (Sul de Minas)</h2>
        <p className={REB_SEC_SUB}>Cronograma 11 — referência regional. Etapas <b>obrigatórias</b> (aftosa) marcadas em destaque.</p>
        <RebTable>
          <thead><tr><th>Mês</th><th>Ação</th><th>Detalhe</th><th>Público</th></tr></thead>
          <tbody>
            {CALENDARIO_SANITARIO.map((i, idx) => (
              <tr key={idx}>
                <td style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 500 }}>
                  {String(i.mes).padStart(2, "0")}
                </td>
                <td><RebAnm>
                  {i.titulo}
                  {i.obrigatorio && <RebPill tone="bad" style={{ marginLeft: 8 }}>obrigatório</RebPill>}
                </RebAnm></td>
                <td>{i.detalhe}</td>
                <td>{i.publico}</td>
              </tr>
            ))}
          </tbody>
        </RebTable>
      </RebMain>
    </>
  );
}
