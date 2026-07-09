import { useState } from "react";
import { Loader } from "../../components/Loading";
import { useLotes } from "../api";
import { LoteDomainView } from "./LoteDomainView";
import { DOMAINS } from "../domains";
import { insightDaFazenda } from "../mock";
import { arrobasCarcaca } from "../lib/derive";
import type { ResumoLote, Lote } from "../types";

const PRECO_SPOT_MG = 317;
const CURVA_B3 = [
  { mes: "Jul/2026", preco: 346.70 },
  { mes: "Ago/2026", preco: 345.20 },
  { mes: "Set/2026", preco: 347.35 },
  { mes: "Out/2026", preco: 355.90 },
  { mes: "Nov/2026", preco: 357.65 },
];

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function ComercialTab({ onRegistrar }: { onRegistrar: (lote: Lote) => void }) {
  const [aba, setAba] = useState<"painel" | "simulador">("painel");
  const { data, loading } = useLotes({ estado: "ATIVO" });

  if (loading) return <main className="rb-main"><div className="rb-eyebrow">Corte</div><div className="rb-head"><h1>Comercial</h1></div><Loader /></main>;
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
        <>
          <div className="rb-seg" style={{ display: "flex", gap: 6 }}>
            <button className="rb-btn" aria-pressed onClick={() => setAba("painel")}>Painel</button>
            <button className="rb-btn" onClick={() => setAba("simulador")}>Simulador de venda</button>
          </div>
        </>
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
    <main className="rb-main">
      <div className="rb-eyebrow">Corte · simulador de venda</div>
      <div className="rb-head">
        <h1>Simulador de janela comercial</h1>
        <button className="rb-btn" onClick={onVoltar}>← Painel comercial</button>
      </div>

      <div className="rb-fld" style={{ maxWidth: 480 }}>
        <label>Lote a simular</label>
        <select value={loteId} onChange={(e) => setLoteId(e.target.value)}>
          {lotes.map((l) => {
            const ready = (l.resumo?.pesoMedio ?? 0) >= 480;
            return <option key={l.id} value={l.id}>{l.codigo} — {l.nome} ({l.numCabecas} cab · {l.resumo?.pesoMedio ?? "—"} kg){ready ? " · pronto" : ""}</option>;
          })}
        </select>
      </div>

      {lote && resumo && (
        <>
          <div className="rb-kstrip" style={{ ["--cols" as any]: 4 }}>
            <div className="rb-k"><div className="lab">Cabeças</div><div className="val">{lote.numCabecas}</div></div>
            <div className="rb-k"><div className="lab">Peso médio</div><div className="val">{resumo.pesoMedio}<u>kg</u></div></div>
            <div className="rb-k"><div className="lab">GMD atual</div><div className="val">{resumo.gmd?.toFixed(2) ?? "—"}<u>kg/d</u></div></div>
            <div className="rb-k"><div className="lab">@ no lote hoje</div><div className="val">{arrobasHoje.toFixed(0)}<u>@</u></div></div>
          </div>

          <h2 className="rb-sec-title">Cenários</h2>
          <p className="rb-sec-sub">
            Receita estimada por mês de saída. <b>Vender agora:</b> indicador Cepea/Esalq MG @ <b>R$ {PRECO_SPOT_MG}/@</b>.
            <b> Atrasar:</b> indicador futuro B3 (sem desconto de basis frigorífico, custos de manutenção descontados a R$ 1,80/cab/dia).
          </p>
          <div className="rb-tbl-wrap"><table className="rb-tbl">
            <thead><tr><th>Janela</th><th>Preço @</th><th>Peso projetado</th><th>@ projetadas</th><th>Receita bruta</th><th>Custo manutenção</th><th>Diferença vs. hoje</th></tr></thead>
            <tbody>
              <tr>
                <td className="rb-anm">Hoje (spot)</td>
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
                    <td className="rb-anm">{c.mes}</td>
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
          </table></div>

          <p className="rb-sub" style={{ marginTop: 16 }}>
            <b>Observação:</b> a curva B3 não desconta o <i>basis</i> regional Minas (boi gordo MG costuma negociar ~R$ 8-15/@ abaixo
            do indicador São Paulo da Esalq). O custo de manutenção R$ 1,80/cab/dia cobre suplemento mineral + proteinado seca + mão
            de obra alocada. Custos de transporte ao frigorífico (R$ 20-40/cab) não estão incluídos.
          </p>
        </>
      )}
    </main>
  );
}
