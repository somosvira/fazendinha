import { Loader } from "../../components/Loading";
import { useLotes } from "../api";
import { LoteDomainView } from "./LoteDomainView";
import { DOMAINS } from "../domains";
import { insightDaFazenda } from "../mock";
import { RebHeader } from "@/rebanho/components/RebHeader";
import { RebTable } from "@/components/rb/RebTable";
import { RebMain, RebAnm, REB_SEC_SUB } from "@/components/rb/RebPrimitives";
import { fmtMoneyExact } from "@/components/charts";
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
  if (loading) return <RebMain><RebHeader eyebrow="Pecuária · Lotes coletivos" title="Nutrição" /><Loader /></RebMain>;
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
      <RebMain style={{ paddingTop: 0 }}>
        <h2 className="font-serif text-xl font-medium mb-3" style={{ marginTop: 8 }}>Catálogo de suplementação</h2>
        <p className={REB_SEC_SUB}>Valores médios de referência (Sul de Minas, jun/2026). Defina o protocolo por lote na ficha do lote.</p>
        <RebTable>
          <thead><tr><th>Produto</th><th>Consumo (g/cab/dia)</th><th>R$/kg</th><th>R$/cab/dia</th><th>R$/cab/mês</th></tr></thead>
          <tbody>
            {SUPLEMENTOS.map((s) => {
              const diaCab = (s.gCabDia / 1000) * s.custoKg;
              const mesCab = diaCab * 30;
              return (
                <tr key={s.tipo}>
                  <td><RebAnm>{s.label}</RebAnm></td>
                  <td>{s.gCabDia.toLocaleString("pt-BR")} g</td>
                  <td>{fmtMoneyExact(s.custoKg)}</td>
                  <td>{fmtMoneyExact(diaCab)}</td>
                  <td>{fmtMoneyExact(mesCab)}</td>
                </tr>
              );
            })}
          </tbody>
        </RebTable>
      </RebMain>
    </>
  );
}
