import { useState } from "react";
import { Loader } from "../../components/Loading";
import { useLotes } from "../api";
import { LoteDomainView } from "./LoteDomainView";
import { DOMAINS } from "../domains";
import { insightDaFazenda } from "../mock";
import { arrobasCarcaca } from "../lib/derive";
import { RebHeader } from "@/rebanho/components/RebHeader";
import { RebButton } from "@/components/rb/RebButton";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";
import { RebTable } from "@/components/rb/RebTable";
import { RebField } from "@/components/rb/RebField";
import { RebMain, RebAnm, REB_SEC_SUB } from "@/components/rb/RebPrimitives";
import { fmtBRL } from "@/components/charts";
import type { ResumoLote, Lote } from "../types";

const PRECO_SPOT_MG = 317;
const CURVA_B3 = [
  { mes: "Jul/2026", preco: 346.70 },
  { mes: "Ago/2026", preco: 345.20 },
  { mes: "Set/2026", preco: 347.35 },
  { mes: "Out/2026", preco: 355.90 },
  { mes: "Nov/2026", preco: 357.65 },
];

const money = (n: number) => fmtBRL(n, { compact: false });

export function ComercialTab({ onRegistrar }: { onRegistrar: (lote: Lote) => void }) {
  const [aba, setAba] = useState<"painel" | "simulador">("painel");
  const { data, loading } = useLotes({ estado: "ATIVO" });

  if (loading) return <RebMain><RebHeader eyebrow="Corte" title="Comercial" /><Loader /></RebMain>;
  const resumos: ResumoLote[] = data.map((l) => l.resumo ?? ({ loteId: l.id } as ResumoLote));
  const abrir = (id: string) => { const l = data.find((x) => x.id === id); if (l) onRegistrar(l); };

  if (aba === "simulador") return <Simulador lotes={data} onVoltar={() => setAba("painel")} />;

  return (
    <LoteDomainView
      config={DOMAINS.comercial}
      resumos={resumos}
      lotes={data}
      insight={insightDaFazenda("comercial")}
      onAbrirLote={abrir}
      dicaLinha="clique num lote pra registrar venda / operação"
      controles={
        <div className="flex gap-1.5">
          <RebButton aria-pressed onClick={() => setAba("painel")}>Painel</RebButton>
          <RebButton onClick={() => setAba("simulador")}>Simulador de venda</RebButton>
        </div>
      }
    />
  );
}

/* Simulador editorial: "vender agora vs. atrasar para X" por lote, descontando
 * suplementação e GMD esperado. Não é cálculo financeiro completo (não desconta
 * frete frigorífico, comissões), mas dá um nort claro. */
function Simulador({ lotes, onVoltar }: { lotes: Lote[]; onVoltar: () => void }) {
  const [loteId, setLoteId] = useState(lotes.find((l) => (l.resumo?.pesoMedio ?? 0) >= 480)?.id ?? lotes[0]?.id);
  const lote = lotes.find((l) => l.id === loteId);
  const resumo = lote?.resumo;

  const arrobasHoje = resumo?.pesoMedio ? arrobasCarcaca(resumo.pesoMedio) * lote!.numCabecas : 0;
  const receitaHoje = arrobasHoje * PRECO_SPOT_MG;

  return (
    <RebMain>
      <RebHeader
        eyebrow="Corte · simulador de venda"
        title="Simulador de janela comercial"
        actions={<RebButton onClick={onVoltar}>← Painel comercial</RebButton>}
      />

      <RebField label="Lote a simular" style={{ maxWidth: 480 }}>
        <select className="rb-field-select" value={loteId} onChange={(e) => setLoteId(e.target.value)}>
          {lotes.map((l) => {
            const ready = (l.resumo?.pesoMedio ?? 0) >= 480;
            return <option key={l.id} value={l.id}>{l.codigo} — {l.nome} ({l.numCabecas} cab · {l.resumo?.pesoMedio ?? "—"} kg){ready ? " · pronto" : ""}</option>;
          })}
        </select>
      </RebField>

      {lote && resumo && (
        <>
          <RebKpiStrip cols={4}>
            <RebKpi lab="Cabeças" val={lote.numCabecas} />
            <RebKpi lab="Peso médio" val={<>{resumo.pesoMedio}<u>kg</u></>} />
            <RebKpi lab="GMD atual" val={<>{resumo.gmd?.toFixed(2) ?? "—"}<u>kg/d</u></>} />
            <RebKpi lab="@ no lote hoje" val={<>{arrobasHoje.toFixed(0)}<u>@</u></>} />
          </RebKpiStrip>

          <h2 className="font-serif text-xl font-medium mb-3">Cenários</h2>
          <p className={REB_SEC_SUB}>
            Receita estimada por mês de saída. <b>Vender agora:</b> indicador Cepea/Esalq MG @ <b>R$ {PRECO_SPOT_MG}/@</b>.
            <b> Atrasar:</b> indicador futuro B3 (sem desconto de basis frigorífico, custos de manutenção descontados a R$ 1,80/cab/dia).
          </p>
          <RebTable>
            <thead><tr><th>Janela</th><th>Preço @</th><th>Peso projetado</th><th>@ projetadas</th><th>Receita bruta</th><th>Custo manutenção</th><th>Diferença vs. hoje</th></tr></thead>
            <tbody>
              <tr>
                <td><RebAnm>Hoje (spot)</RebAnm></td>
                <td>R$ {PRECO_SPOT_MG}</td>
                <td>{resumo.pesoMedio} kg</td>
                <td>{arrobasHoje.toFixed(0)} @</td>
                <td><b>{money(receitaHoje)}</b></td>
                <td>—</td>
                <td>—</td>
              </tr>
              {CURVA_B3.map((c, i) => {
                const dias = (i + 1) * 30;
                const pesoProj = (resumo.pesoMedio ?? 0) + (resumo.gmd ?? 0) * dias;
                const arrProj = arrobasCarcaca(pesoProj) * lote.numCabecas;
                const receita = arrProj * c.preco;
                const custoManut = 1.80 * lote.numCabecas * dias;
                const liquido = receita - custoManut;
                const diff = liquido - receitaHoje;
                return (
                  <tr key={c.mes}>
                    <td><RebAnm>{c.mes}</RebAnm></td>
                    <td>R$ {c.preco.toFixed(2)}</td>
                    <td>{pesoProj.toFixed(0)} kg</td>
                    <td>{arrProj.toFixed(0)} @</td>
                    <td>{money(receita)}</td>
                    <td>{money(custoManut)}</td>
                    <td style={{ color: diff > 0 ? "var(--lucro)" : "var(--prejuizo)", fontWeight: 600 }}>
                      {diff > 0 ? "+" : ""}{money(diff)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </RebTable>

          <p className="text-sm text-ink-3" style={{ marginTop: 16 }}>
            <b>Observação:</b> a curva B3 não desconta o <i>basis</i> regional Minas (boi gordo MG costuma negociar ~R$ 8-15/@ abaixo
            do indicador São Paulo da Esalq). O custo de manutenção R$ 1,80/cab/dia cobre suplemento mineral + proteinado seca + mão
            de obra alocada. Custos de transporte ao frigorífico (R$ 20-40/cab) não estão incluídos.
          </p>
        </>
      )}
    </RebMain>
  );
}
