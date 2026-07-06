/* Contas a vencer — card compacto (item 6 do backlog: avisar nota/conta
 * vencendo ou vencida). Lê GET /api/vencimentos (Lancamentos ABERTO/DEBITO,
 * contas a pagar) ancorado em HOJE (2026-05-28). Faixa de destaque quando há
 * vencidas; tabela curta com badge por bucket. Moeda via fmtMoneyExact;
 * cores via var(). Monta no topo da aba Gastos. */

import { useState } from "react";
import { useContasAVencer, liquidarConta, type ContaAVencerItem } from "./api";
import { fmtMoneyExact } from "../components/charts";
import { useToast } from "../components/Toast";
import { HOJE } from "./HOJE";

// "YYYY-MM-DD" → "dd/mm" sem passar por Date (evita shift de fuso).
const dataBR = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

function Badge({ diasAtraso }: { diasAtraso: number }) {
  if (diasAtraso > 0) {
    return (
      <span
        style={{
          fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase",
          color: "#fff", background: "var(--neg)", padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap",
        }}
      >
        Vencida{diasAtraso > 1 ? ` há ${diasAtraso}d` : " há 1d"}
      </span>
    );
  }
  const emDias = -diasAtraso;
  const label = emDias === 0 ? "Vence hoje" : emDias === 1 ? "em 1 dia" : `em ${emDias} dias`;
  return (
    <span
      style={{
        fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
        color: emDias === 0 ? "var(--neg)" : "var(--ink-2)",
        border: "1px solid var(--rule)", padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

export function ContasAVencer() {
  const { data, loading, erro, recarregar } = useContasAVencer(HOJE);
  const toast = useToast();
  const [liquidandoId, setLiquidandoId] = useState<number | null>(null);

  const itens: ContaAVencerItem[] = data
    ? [...data.vencidas, ...data.venceHoje, ...data.proximos3, ...data.proximos7]
    : [];
  const temVencidas = !!data && data.totais.vencidasQtd > 0;

  async function marcarPago(it: ContaAVencerItem) {
    setLiquidandoId(it.id);
    try {
      // Liquida na âncora do app (HOJE) — não no relógio real da máquina.
      await liquidarConta(it.id, HOJE);
      toast.success("Conta marcada como paga", `${it.fornecedorNome ?? it.categoriaNome} · ${fmtMoneyExact(it.valor)}`);
      recarregar(); // some da lista (deixa de ser ABERTO)
    } catch (e) {
      toast.error("Não foi possível dar baixa", e instanceof Error ? e.message : String(e));
    } finally {
      setLiquidandoId(null);
    }
  }

  return (
    <section
      style={{
        border: "1px solid var(--rule)", borderRadius: 12, padding: "16px 18px",
        marginBottom: 24, background: "var(--surface, transparent)",
      }}
      aria-label="Contas a vencer"
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 18, margin: 0 }}>Contas a vencer</h2>
        <span className="caption" style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-3)" }}>
          Contas a pagar · próximos 7 dias
        </span>
      </div>

      {erro ? (
        <p style={{ color: "var(--neg)", marginTop: 12, marginBottom: 0 }}>Erro ao carregar contas a vencer: {erro}</p>
      ) : loading ? (
        <p style={{ color: "var(--ink-3)", marginTop: 12, marginBottom: 0 }}>Carregando…</p>
      ) : itens.length === 0 ? (
        <p style={{ color: "var(--ink-2)", marginTop: 12, marginBottom: 0 }}>
          Nenhuma conta a vencer nos próximos 7 dias.
        </p>
      ) : (
        <>
          {temVencidas && data && (
            <div
              style={{
                marginTop: 12, padding: "10px 14px", borderRadius: 8,
                background: "color-mix(in srgb, var(--neg) 12%, transparent)",
                borderLeft: "3px solid var(--neg)",
              }}
            >
              <div style={{ color: "var(--neg)", fontWeight: 600, fontSize: 15 }}>
                {data.totais.vencidasQtd} {data.totais.vencidasQtd === 1 ? "conta vencida" : "contas vencidas"}
                {" · "}
                <span className="mono-nums">{fmtMoneyExact(data.totais.vencidasValor)}</span>
              </div>
              {data.totais.aVencer7Qtd > 0 && (
                <div style={{ color: "var(--ink-2)", fontSize: 13, marginTop: 2 }}>
                  {data.totais.aVencer7Qtd} {data.totais.aVencer7Qtd === 1 ? "conta vence" : "contas vencem"} em até 7 dias
                  {" · "}
                  <span className="mono-nums">{fmtMoneyExact(data.totais.aVencer7Valor)}</span>
                </div>
              )}
            </div>
          )}

          {!temVencidas && data && data.totais.aVencer7Qtd > 0 && (
            <div style={{ color: "var(--ink-2)", fontSize: 14, marginTop: 12 }}>
              {data.totais.aVencer7Qtd} {data.totais.aVencer7Qtd === 1 ? "conta vence" : "contas vencem"} em até 7 dias
              {" · "}
              <span className="mono-nums">{fmtMoneyExact(data.totais.aVencer7Valor)}</span>
            </div>
          )}

          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--ink-3)", fontSize: 12 }}>
                  <th style={{ padding: "6px 8px", fontWeight: 500, width: 64 }}>Venc.</th>
                  <th style={{ padding: "6px 8px", fontWeight: 500 }}>Fornecedor</th>
                  <th style={{ padding: "6px 8px", fontWeight: 500 }}>Categoria</th>
                  <th style={{ padding: "6px 8px", fontWeight: 500, textAlign: "right" }}>Valor</th>
                  <th style={{ padding: "6px 8px", fontWeight: 500, width: 100 }} />
                </tr>
              </thead>
              <tbody>
                {itens.map((it) => (
                  <tr key={it.id} style={{ borderTop: "1px solid var(--rule-soft, var(--rule))" }}>
                    <td className="mono-nums" style={{ padding: "8px", color: "var(--ink-2)", whiteSpace: "nowrap" }}>
                      {dataBR(it.dataVencimento)}
                    </td>
                    <td style={{ padding: "8px" }}>{it.fornecedorNome ?? it.descricao ?? "—"}</td>
                    <td style={{ padding: "8px", color: "var(--ink-2)" }}>{it.categoriaNome}</td>
                    <td
                      className="mono-nums"
                      style={{ padding: "8px", textAlign: "right", color: it.diasAtraso > 0 ? "var(--neg)" : "var(--ink)", whiteSpace: "nowrap" }}
                    >
                      {fmtMoneyExact(it.valor)}
                    </td>
                    <td style={{ padding: "8px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <Badge diasAtraso={it.diasAtraso} />
                        <button
                          onClick={() => marcarPago(it)}
                          disabled={liquidandoId === it.id}
                          title="Marcar como paga (registra a liquidação)"
                          style={{
                            fontSize: 12, fontWeight: 600, cursor: liquidandoId === it.id ? "default" : "pointer",
                            color: "var(--pos, #1a7f4b)", background: "transparent",
                            border: "1px solid var(--rule)", borderRadius: 999, padding: "3px 10px",
                            opacity: liquidandoId === it.id ? 0.6 : 1, whiteSpace: "nowrap",
                          }}
                        >
                          {liquidandoId === it.id ? "…" : "✓ pago"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
