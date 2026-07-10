import { useCallback, useEffect, useState } from "react";
import { previsaoConsumo, fecharConsumo, listarConsumos, estornarConsumo, type LoteDTO, type PrevisaoConsumoDTO, type ConsumoPeriodoDTO } from "../api";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

// Primeiro dia do mês corrente → hoje (default "fechar o mês em curso").
function mesCorrente(): { inicio: string; fim: string } {
  const hoje = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { inicio: iso(new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1))), fim: iso(hoje) };
}

export function ConsumoLoteDrawer({ lote, onFechar, onMudou }: { lote: LoteDTO; onFechar: () => void; onMudou?: () => void }) {
  const inicial = mesCorrente();
  const [dataInicio, setDataInicio] = useState(inicial.inicio);
  const [dataFim, setDataFim] = useState(inicial.fim);
  const [prev, setPrev] = useState<PrevisaoConsumoDTO | null>(null);
  const [erroPrev, setErroPrev] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const [historico, setHistorico] = useState<ConsumoPeriodoDTO[]>([]);

  const carregarPrevisao = useCallback(() => {
    if (!dataInicio || !dataFim) return;
    setCarregando(true); setErroPrev(null);
    previsaoConsumo(lote.id, dataInicio, dataFim)
      .then((p) => { setPrev(p); })
      .catch((e) => { setPrev(null); setErroPrev(e.message); })
      .finally(() => setCarregando(false));
  }, [lote.id, dataInicio, dataFim]);

  const carregarHistorico = useCallback(() => { listarConsumos(lote.id).then(setHistorico).catch(() => setHistorico([])); }, [lote.id]);

  useEffect(() => { carregarPrevisao(); }, [carregarPrevisao]);
  useEffect(() => { carregarHistorico(); }, [carregarHistorico]);

  async function fechar() {
    setSalvando(true); setMsg(null);
    try {
      const r = await fecharConsumo(lote.id, { dataInicio, dataFim });
      setMsg({ tom: "ok", texto: `Consumo fechado: ${r.movimentos} baixa(s), ${money(r.custoTotal)}${r.temInsuficiencia ? " — atenção: houve saldo negativo" : ""}.` });
      carregarPrevisao(); carregarHistorico(); onMudou?.();
    } catch (e: any) { setMsg({ tom: "erro", texto: e.message }); } finally { setSalvando(false); }
  }

  async function estornar(id: number) {
    setMsg(null);
    try { await estornarConsumo(id); setMsg({ tom: "ok", texto: "Fechamento estornado — estoque devolvido." }); carregarPrevisao(); carregarHistorico(); onMudou?.(); }
    catch (e: any) { setMsg({ tom: "erro", texto: e.message }); }
  }

  return (
    <RebModal
      title={`Consumo — ${lote.nome}`}
      onClose={onFechar}
      className="w-[min(560px,calc(100vw-32px))]"
      actions={<RebButton onClick={onFechar}>Fechar</RebButton>}
    >
      <>
        <p className="rb-sub" style={{ margin: "0 0 12px", fontSize: 12.5 }}>
          Baixa do estoque o consumo da dieta {lote.dietaNome ? <b>{lote.dietaNome}</b> : "do lote"} × cabeças ativas × dias. Confira a prévia antes de fechar.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <label className="rb-fld" style={{ flex: 1 }}>Início<input type="date" value={dataInicio} max={dataFim} onChange={(e) => setDataInicio(e.target.value)} /></label>
          <label className="rb-fld" style={{ flex: 1 }}>Fim<input type="date" value={dataFim} min={dataInicio} onChange={(e) => setDataFim(e.target.value)} /></label>
        </div>

        {carregando ? <p className="rb-sub">Calculando prévia…</p>
          : erroPrev ? <p className="rb-sub" style={{ color: "var(--neg)" }}>{erroPrev}</p>
          : prev ? (
            <>
              <div className="rb-tbl-wrap"><table className="rb-tbl">
                <thead><tr><th>Produto</th><th>Baixa</th><th>Saldo→</th><th>Custo</th></tr></thead>
                <tbody>{prev.linhas.map((l) => (
                  <tr key={l.produtoId}>
                    <td className="rb-anm">{l.produtoNome}</td>
                    <td>{qtd(l.quantidade)} {l.unidade}</td>
                    <td style={{ color: l.insuficiente ? "var(--neg)" : "inherit", fontWeight: l.insuficiente ? 600 : 400 }}>{qtd(l.saldoApos)}{l.insuficiente ? " ⚠" : ""}</td>
                    <td>{money(l.custoTotal)}</td>
                  </tr>
                ))}</tbody>
              </table></div>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6, margin: "10px 0", fontSize: 13 }}>
                <span>{prev.numCabecas} cabeça(s) · {prev.dias} dia(s)</span>
                <span>Total: <b>{money(prev.custoTotal)}</b></span>
              </div>
              {prev.temInsuficiencia && <p style={{ fontSize: 12.5, color: "var(--neg)", margin: "0 0 8px" }}>⚠ Algum produto ficará com saldo negativo. O fechamento é permitido (o animal consumiu) — regularize o estoque com uma entrada.</p>}
              {prev.numCabecas === 0 && <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: "0 0 8px" }}>O lote não tem animais ativos — nada será baixado.</p>}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <RebButton variant="pri" disabled={salvando || prev.numCabecas === 0} onClick={fechar}>{salvando ? "Fechando…" : "Fechar consumo do período"}</RebButton>
              </div>
            </>
          ) : null}

        {msg && <p style={{ fontSize: 13, marginTop: 10, color: msg.tom === "ok" ? "var(--pos)" : "var(--neg)" }}>{msg.texto}</p>}

        {historico.length > 0 && (
          <div style={{ marginTop: 20, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            <h4 style={{ margin: "0 0 8px" }}>Fechamentos anteriores</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {historico.map((h) => (
                <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <span>{h.dataInicio} → {h.dataFim} · {money(h.custoTotal)} · {h.numMovimentos} baixa(s)</span>
                  <RebButton type="button" disabled={h.mesFechado} title={h.mesFechado ? "Mês fechado contabilmente" : "Estornar"} onClick={() => estornar(h.id)}>{h.mesFechado ? "Mês fechado" : "Estornar"}</RebButton>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    </RebModal>
  );
}
