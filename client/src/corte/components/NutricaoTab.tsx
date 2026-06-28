import { useLotes } from "../api";
import { LoteDomainView } from "./LoteDomainView";
import { DOMAINS } from "../domains";
import { insightDaFazenda } from "../mock";
import type { ResumoLote, Lote } from "../types";

/* Catálogo de suplementos típicos Sul de Minas, com R$/kg de mai/2026. */
const SUPLEMENTOS = [
  { tipo: "MINERAL",            label: "Mineral 80",                       gCabDia:  80, custoKg: 5.20 },
  { tipo: "PROTEICO_SECA",      label: "Proteinado 30% PB · seca",        gCabDia: 800, custoKg: 4.80 },
  { tipo: "ENERGETICO_AGUAS",   label: "Energético 18% PB + ureia · águas", gCabDia: 500, custoKg: 4.30 },
  { tipo: "RACAO_CONFINAMENTO", label: "Ração alto-grão (terminação)",     gCabDia: 9_500, custoKg: 1.95 },
  { tipo: "SAL_BRANCO",         label: "Sal branco (manutenção)",          gCabDia:  60, custoKg: 1.10 },
];

export function NutricaoTab({ onRegistrarManejo }: { onRegistrarManejo: (lote: Lote) => void }) {
  const { data, loading } = useLotes({ estado: "ATIVO" });
  if (loading) return <main className="rb-main"><div className="rb-eyebrow">Corte</div><div className="rb-head"><h1>Nutrição</h1></div><p className="rb-sub">Carregando…</p></main>;
  const resumos: ResumoLote[] = data.map((l) => l.resumo ?? ({ loteId: l.id } as ResumoLote));
  const abrir = (id: string) => { const l = data.find((x) => x.id === id); if (l) onRegistrarManejo(l); };

  return (
    <>
      <LoteDomainView
        config={DOMAINS.nutricao}
        resumos={resumos}
        lotes={data}
        insight={insightDaFazenda("nutricao")}
        onAbrirLote={abrir}
        dicaLinha="clique num lote pra registrar suplementação"
      />
      <main className="rb-main" style={{ paddingTop: 0 }}>
        <h2 className="rb-sec-title" style={{ marginTop: 8 }}>Catálogo de suplementação</h2>
        <p className="rb-sec-sub">Valores médios de referência (Sul de Minas, jun/2026). Defina o protocolo por lote na ficha do lote.</p>
        <div className="rb-tbl-wrap"><table className="rb-tbl">
          <thead><tr><th>Produto</th><th>Consumo (g/cab/dia)</th><th>R$/kg</th><th>R$/cab/dia</th><th>R$/cab/mês</th></tr></thead>
          <tbody>
            {SUPLEMENTOS.map((s) => {
              const diaCab = (s.gCabDia / 1000) * s.custoKg;
              const mesCab = diaCab * 30;
              return (
                <tr key={s.tipo}>
                  <td className="rb-anm">{s.label}</td>
                  <td>{s.gCabDia.toLocaleString("pt-BR")} g</td>
                  <td>{s.custoKg.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                  <td>{diaCab.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                  <td>{mesCab.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </main>
    </>
  );
}
