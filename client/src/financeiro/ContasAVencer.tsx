/* Contas — card do topo da aba Gastos com 3 tabs (A vencer / Vencidas / Pagas)
 * e paginação de 20 em 20. Fonte de dados: GET /api/lancamentos filtrado por
 * situação + natureza + dataVencimento. A ação "Marcar como paga" (POST
 * /api/vencimentos/:id/liquidar) só aparece nas tabs "A vencer" e "Vencidas".
 * Confirmação inline (flash verde + fade-out) — sem toast em cima do botão.
 *
 * O card mantém, no topo, um resumo curto de vencidas via useContasAVencer,
 * como alerta pra quem está em outra tab. */

import { useEffect, useMemo, useState } from "react";
import {
  useContasAVencer,
  useLancamentos,
  liquidarConta,
  type LancamentoLinhaDTO,
  type OrdemLancamentos,
  type DirecaoOrdem,
} from "./api";
import { fmtMoneyExact } from "../components/charts";
import { useToast } from "../components/Toast";
import { Input } from "@/components/ui/input";
import { OPCOES_POR_PAGINA } from "@/components/Paginacao";
import { HOJE } from "./HOJE";

// "YYYY-MM-DD" → "dd/mm/aaaa" sem passar por Date (evita shift de fuso).
const dataBR = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

// Aritmética de dias sobre strings YYYY-MM-DD (UTC), sem fuso.
function subDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - dias);
  return dt.toISOString().slice(0, 10);
}
function diffDias(aISO: string, bISO: string): number {
  const [aY, aM, aD] = aISO.split("-").map(Number);
  const [bY, bM, bD] = bISO.split("-").map(Number);
  return Math.floor((Date.UTC(aY, aM - 1, aD) - Date.UTC(bY, bM - 1, bD)) / 86400000);
}

// Badge de STATUS (só leitura). Formatos diferentes por bucket para reforçar
// a diferença semântica.
function BadgeAVencer({ dias }: { dias: number }) {
  const label = dias === 0 ? "Vence hoje" : dias === 1 ? "Vence em 1 dia" : `Vence em ${dias}d`;
  return (
    <span
      style={{
        fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
        color: dias === 0 ? "var(--neg)" : "var(--ink-2)",
        background: dias === 0 ? "color-mix(in srgb, var(--neg) 10%, transparent)" : "transparent",
        border: `1px solid ${dias === 0 ? "var(--neg)" : "var(--rule)"}`,
        padding: "3px 9px", borderRadius: 4, whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
function BadgeVencida({ diasAtraso }: { diasAtraso: number }) {
  return (
    <span
      style={{
        fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
        color: "#fff", background: "var(--neg)", padding: "3px 9px", borderRadius: 4, whiteSpace: "nowrap",
      }}
      title={`Venceu há ${diasAtraso} ${diasAtraso === 1 ? "dia" : "dias"}`}
    >
      Vencida · {diasAtraso}d
    </span>
  );
}
function BadgePaga({ dataPagamento }: { dataPagamento: string }) {
  return (
    <span
      style={{
        fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
        color: "var(--pos, #1a7f4b)",
        background: "color-mix(in srgb, var(--pos, #1a7f4b) 10%, transparent)",
        border: "1px solid color-mix(in srgb, var(--pos, #1a7f4b) 40%, transparent)",
        padding: "3px 9px", borderRadius: 4, whiteSpace: "nowrap",
      }}
      title={`Paga em ${dataBR(dataPagamento)}`}
    >
      Paga · {dataBR(dataPagamento)}
    </span>
  );
}

const FLASH_MS = 380;

type Tab = "aVencer" | "vencidas" | "pagas";

const TABS: { id: Tab; label: string }[] = [
  { id: "aVencer", label: "A vencer" },
  { id: "vencidas", label: "Vencidas" },
  { id: "pagas", label: "Pagas" },
];

// Ordem default por tab — leitura mais útil sem intervenção do usuário.
const ORDEM_DEFAULT: Record<Tab, { by: OrdemLancamentos; dir: DirecaoOrdem }> = {
  aVencer:  { by: "dataVencimento", dir: "asc" },  // mais próximo primeiro
  vencidas: { by: "dataVencimento", dir: "asc" },  // mais antigas (mais atrasadas) no topo
  pagas:    { by: "data",           dir: "desc" }, // pagamentos mais recentes primeiro
};

// Direção default quando o usuário clica numa coluna pela primeira vez.
const DIR_DEFAULT_COL: Record<OrdemLancamentos, DirecaoOrdem> = {
  dataVencimento: "asc",
  data:           "desc",
  valor:          "desc",
  categoria:      "asc",
  fornecedor:     "asc",
};

function SortHeader({
  label, coluna, ordem, onOrdenar, align = "left", style,
}: {
  label: string;
  coluna: OrdemLancamentos;
  ordem: { by: OrdemLancamentos; dir: DirecaoOrdem };
  onOrdenar: (c: OrdemLancamentos) => void;
  align?: "left" | "right";
  style?: React.CSSProperties;
}) {
  const ativo = ordem.by === coluna;
  const seta = ativo ? (ordem.dir === "asc" ? "▲" : "▼") : "";
  return (
    <th
      onClick={() => onOrdenar(coluna)}
      style={{
        padding: "6px 8px", fontWeight: 500, cursor: "pointer",
        textAlign: align, userSelect: "none",
        color: ativo ? "var(--ink)" : undefined,
        ...style,
      }}
      title={`Ordenar por ${label.toLowerCase()}`}
      aria-sort={ativo ? (ordem.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {label}
        <span
          aria-hidden
          style={{
            fontSize: 9, lineHeight: 1,
            opacity: ativo ? 1 : 0.25,
            color: ativo ? "var(--ink)" : "var(--ink-3)",
          }}
        >
          {seta || "↕"}
        </span>
      </span>
    </th>
  );
}

function TabButton({
  ativo, onClick, children, badge,
}: { ativo: boolean; onClick: () => void; children: React.ReactNode; badge?: number }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      style={{
        background: ativo ? "var(--ink)" : "transparent",
        color: ativo ? "var(--mast-ink, #fff)" : "var(--ink-2)",
        border: `1px solid ${ativo ? "var(--ink)" : "var(--rule)"}`,
        padding: "6px 14px", borderRadius: 999, cursor: "pointer",
        fontSize: 13, fontWeight: 600, letterSpacing: "0.02em",
        display: "inline-flex", alignItems: "center", gap: 6,
        transition: "background 150ms ease, color 150ms ease, border-color 150ms ease",
      }}
    >
      {children}
      {badge != null && badge > 0 && (
        <span
          style={{
            fontSize: 11, fontWeight: 700,
            background: ativo ? "color-mix(in srgb, #fff 25%, transparent)" : "var(--rule)",
            color: ativo ? "var(--mast-ink, #fff)" : "var(--ink-2)",
            padding: "1px 7px", borderRadius: 999, minWidth: 18, textAlign: "center",
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

export function ContasAVencer({ filtrosIniciais }: { filtrosIniciais?: Record<string, string> }) {
  // Deep-link da IA (via /gastos?status=…&q=…): status → tab; categoria/pessoa/q → busca
  // universal (que já casa fornecedor + categoria + descrição).
  const stInicial = filtrosIniciais?.status;
  const tabInicial: Tab = stInicial === "vencidas" ? "vencidas" : stInicial === "pagas" ? "pagas" : "aVencer";
  const qInicial = filtrosIniciais?.q ?? filtrosIniciais?.categoria ?? filtrosIniciais?.pessoa ?? "";
  const [tab, setTab] = useState<Tab>(tabInicial);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const [ordem, setOrdem] = useState<{ by: OrdemLancamentos; dir: DirecaoOrdem }>(ORDEM_DEFAULT.aVencer);
  const toast = useToast();
  const [liquidandoId, setLiquidandoId] = useState<number | null>(null);
  const [estadoLinha, setEstadoLinha] = useState<Record<number, "confirmando" | "saindo">>({});

  // Busca universal (fornecedor, categoria, descrição e — se numérico — valor).
  // Debounce leve pra não bater o backend a cada tecla.
  const [q, setQ] = useState(qInicial);
  const [qDebounced, setQDebounced] = useState(qInicial);
  useEffect(() => {
    const id = window.setTimeout(() => setQDebounced(q.trim()), 250);
    return () => window.clearTimeout(id);
  }, [q]);

  // Reset paginação + ordem default ao trocar de tab.
  useEffect(() => {
    setPagina(1);
    setOrdem(ORDEM_DEFAULT[tab]);
  }, [tab]);

  // Reset paginação quando a busca muda (senão a página 3 fica órfã).
  useEffect(() => { setPagina(1); }, [qDebounced]);
  useEffect(() => { setPagina(1); }, [porPagina]);

  // Toggle asc/desc na mesma coluna; nova coluna aplica dir default e volta pra página 1.
  function ordenarPor(coluna: OrdemLancamentos) {
    setPagina(1);
    setOrdem((atual) =>
      atual.by === coluna
        ? { by: coluna, dir: atual.dir === "asc" ? "desc" : "asc" }
        : { by: coluna, dir: DIR_DEFAULT_COL[coluna] },
    );
  }

  // Resumo p/ o alerta do topo (só vencidas). Barato e reusa o endpoint já existente.
  const { data: resumo } = useContasAVencer(HOJE);
  const qtdVencidas = resumo?.totais.vencidasQtd ?? 0;

  // Filtros por tab (montados fora do hook pra manter estabilidade).
  const filtros = useMemo(() => {
    const base = {
      natureza: "DEBITO" as const,
      limit: porPagina,
      offset: (pagina - 1) * porPagina,
      orderBy: ordem.by,
      orderDir: ordem.dir,
      q: qDebounced || undefined,
    };
    if (tab === "aVencer") return { ...base, situacao: "ABERTO" as const, vencimentoDe: HOJE };
    if (tab === "vencidas") return { ...base, situacao: "ABERTO" as const, vencimentoAte: subDias(HOJE, 1) };
    return { ...base, situacao: "LIQUIDADO" as const };
  }, [tab, pagina, porPagina, ordem, qDebounced]);

  const { data, loading, erro, recarregar } = useLancamentos(filtros);
  const itens = data?.itens ?? [];
  const total = data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const permiteAcao = tab !== "pagas";

  async function marcarPago(it: LancamentoLinhaDTO) {
    setLiquidandoId(it.id);
    try {
      await liquidarConta(it.id, HOJE);
      setEstadoLinha((s) => ({ ...s, [it.id]: "confirmando" }));
      window.setTimeout(() => {
        setEstadoLinha((s) => ({ ...s, [it.id]: "saindo" }));
        recarregar({ silent: true });
      }, FLASH_MS);
    } catch (e) {
      toast.error("Não foi possível dar baixa", e instanceof Error ? e.message : String(e));
    } finally {
      setLiquidandoId(null);
    }
  }

  const legendaTab =
    tab === "aVencer" ? "Contas em aberto ainda no prazo" :
    tab === "vencidas" ? "Contas em aberto com vencimento passado" :
    "Contas já pagas (liquidadas)";

  return (
    <section
      style={{
        border: "1px solid var(--rule)", borderRadius: 12, padding: "16px 18px",
        marginBottom: 24, background: "var(--surface, transparent)",
      }}
      aria-label="Contas — a vencer, vencidas e pagas"
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 18, margin: 0 }}>Contas</h2>
        <span className="caption" style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-3)" }}>
          {legendaTab}
        </span>
      </div>

      {/* Alerta compacto quando há vencidas e o usuário NÃO está nessa tab. */}
      {qtdVencidas > 0 && tab !== "vencidas" && resumo && (
        <button
          onClick={() => setTab("vencidas")}
          style={{
            marginTop: 12, padding: "8px 12px", borderRadius: 8, width: "100%", textAlign: "left",
            background: "color-mix(in srgb, var(--neg) 10%, transparent)",
            borderLeft: "3px solid var(--neg)", border: "none",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          }}
          title="Ir para a tab Vencidas"
        >
          <span style={{ color: "var(--neg)", fontWeight: 600, fontSize: 14 }}>
            {qtdVencidas} {qtdVencidas === 1 ? "conta vencida" : "contas vencidas"}
            {" · "}
            <span className="mono-nums">{fmtMoneyExact(resumo.totais.vencidasValor)}</span>
          </span>
          <span style={{ color: "var(--neg)", fontSize: 12, fontWeight: 600 }}>Ver →</span>
        </button>
      )}

      {/* Tabs + busca universal (fornecedor, categoria, descrição, valor) */}
      <div style={{
        display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap",
        alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TABS.map((t) => (
            <TabButton
              key={t.id}
              ativo={tab === t.id}
              onClick={() => setTab(t.id)}
              badge={t.id === "vencidas" ? qtdVencidas : undefined}
            >
              {t.label}
            </TabButton>
          ))}
        </div>
        <div className="ml-auto flex w-[280px] items-center gap-2 border border-border bg-card px-3 py-[7px] max-[900px]:ml-0 max-[900px]:w-full">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className="text-ink-2">
            <circle cx="11" cy="11" r="7"></circle>
            <line x1="16" y1="16" x2="21" y2="21"></line>
          </svg>
          <Input
            className="h-auto flex-1 border-0 bg-transparent p-0 text-[15px] font-medium text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 md:text-[15px]"
            placeholder="Buscar fornecedor, categoria ou valor…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Buscar contas"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Limpar busca"
              className="cursor-pointer border-0 bg-transparent p-0 text-base leading-none text-ink-3"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {erro ? (
        <p style={{ color: "var(--neg)", marginTop: 16, marginBottom: 0 }}>
          Erro ao carregar: {erro}
        </p>
      ) : loading && !data ? (
        <p style={{ color: "var(--ink-3)", marginTop: 16, marginBottom: 0 }}>Carregando…</p>
      ) : itens.length === 0 ? (
        <p style={{ color: "var(--ink-2)", marginTop: 16, marginBottom: 0 }}>
          {qDebounced ? (
            <>Nenhum resultado para <em>“{qDebounced}”</em> nesta aba.</>
          ) : (
            <>
              {tab === "aVencer" && "Nenhuma conta a vencer no momento."}
              {tab === "vencidas" && "Nenhuma conta vencida — em dia."}
              {tab === "pagas" && "Nenhuma conta paga registrada."}
            </>
          )}
        </p>
      ) : (
        <>
          <div style={{ overflowX: "auto", marginTop: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--ink-3)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  <SortHeader
                    label={tab === "pagas" ? "Pago em" : "Venc."}
                    coluna={tab === "pagas" ? "data" : "dataVencimento"}
                    ordem={ordem}
                    onOrdenar={ordenarPor}
                    style={{ width: 112 }}
                  />
                  <SortHeader label="Fornecedor" coluna="fornecedor" ordem={ordem} onOrdenar={ordenarPor} />
                  <SortHeader label="Categoria" coluna="categoria" ordem={ordem} onOrdenar={ordenarPor} />
                  <SortHeader label="Valor" coluna="valor" ordem={ordem} onOrdenar={ordenarPor} align="right" />
                  <th style={{ padding: "6px 8px", fontWeight: 500, width: 140 }}>Status</th>
                  {permiteAcao && (
                    <th style={{ padding: "6px 8px", fontWeight: 500, width: 160, textAlign: "right" }}>Ação</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {itens.map((it) => {
                  const estado = estadoLinha[it.id];
                  const confirmando = estado === "confirmando";
                  const saindo = estado === "saindo";
                  const dias = diffDias(HOJE, it.dataVencimento);
                  return (
                    <tr
                      key={it.id}
                      style={{
                        borderTop: "1px solid var(--rule-soft, var(--rule))",
                        transition: "opacity 260ms ease, background-color 300ms ease",
                        opacity: saindo ? 0 : 1,
                        backgroundColor: confirmando
                          ? "color-mix(in srgb, var(--pos, #1a7f4b) 18%, transparent)"
                          : "transparent",
                        pointerEvents: (saindo || confirmando) ? "none" : "auto",
                      }}
                    >
                      <td className="mono-nums" style={{ padding: "8px", color: "var(--ink-2)", whiteSpace: "nowrap" }}>
                        {dataBR(tab === "pagas" ? it.data : it.dataVencimento)}
                      </td>
                      <td style={{ padding: "8px" }}>{it.fornecedorNome ?? it.descricao ?? "—"}</td>
                      <td style={{ padding: "8px", color: "var(--ink-2)" }}>{it.categoriaNome}</td>
                      <td
                        className="mono-nums"
                        style={{
                          padding: "8px", textAlign: "right", whiteSpace: "nowrap",
                          color: tab === "vencidas" ? "var(--neg)" : "var(--ink)",
                        }}
                      >
                        {fmtMoneyExact(it.valor)}
                      </td>
                      <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                        {tab === "pagas"
                          ? <BadgePaga dataPagamento={it.data} />
                          : dias > 0
                            ? <BadgeVencida diasAtraso={dias} />
                            : <BadgeAVencer dias={-dias} />}
                      </td>
                      {permiteAcao && (
                        <td style={{ padding: "8px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <button
                            onClick={() => marcarPago(it)}
                            disabled={liquidandoId === it.id || confirmando || saindo}
                            title="Registra a liquidação hoje e remove da lista"
                            style={{
                              fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
                              cursor: (liquidandoId === it.id || confirmando) ? "default" : "pointer",
                              color: "var(--mast-ink, #fff)",
                              background: confirmando
                                ? "var(--pos, #1a7f4b)"
                                : liquidandoId === it.id
                                  ? "var(--rule)"
                                  : "var(--pos, #1a7f4b)",
                              border: "1px solid transparent", borderRadius: 6, padding: "6px 12px",
                              opacity: liquidandoId === it.id && !confirmando ? 0.7 : 1,
                              whiteSpace: "nowrap", transition: "background 200ms ease",
                            }}
                          >
                            {confirmando ? "✓ Pago" : liquidandoId === it.id ? "Registrando…" : "Marcar como paga"}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginTop: 14, gap: 12, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
              Página {pagina} de {totalPaginas} · <span className="mono-nums">{total}</span> {total === 1 ? "lançamento" : "lançamentos"}
            </span>
            <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <label style={{ fontSize: 12, color: "var(--ink-3)" }}>Ver{" "}
                <select aria-label="Lançamentos por página" value={porPagina} onChange={(e) => setPorPagina(Number(e.target.value))} style={{ border: "1px solid var(--rule)", background: "var(--surface)", color: "var(--ink)", padding: "5px" }}>
                  {OPCOES_POR_PAGINA.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <button
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina <= 1 || loading}
                style={paginacaoBtn(pagina <= 1 || loading)}
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={pagina >= totalPaginas || loading}
                style={paginacaoBtn(pagina >= totalPaginas || loading)}
              >
                Próxima →
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function paginacaoBtn(desabilitado: boolean): React.CSSProperties {
  return {
    fontSize: 12, fontWeight: 600, letterSpacing: "0.02em",
    padding: "6px 12px", borderRadius: 6,
    border: "1px solid var(--rule)",
    background: "transparent",
    color: desabilitado ? "var(--ink-3)" : "var(--ink)",
    cursor: desabilitado ? "not-allowed" : "pointer",
    opacity: desabilitado ? 0.5 : 1,
  };
}
