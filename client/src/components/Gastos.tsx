/* Rio Novo — Gastos (expense exploration) */

import { useEffect, useMemo, useState } from "react";
import R from "../data/rionovo";
import { ReportHeader } from "./Shell";
import { ContextStrip } from "./ContextStrip";
import { formatRangeLabel } from "./DateRangePicker";
import { getHoje } from "../lib/hoje";
import { fmtMoneyExact } from "./charts";
import type { Tab } from "./Shell";
import type { DateRange } from "./DateRangePicker";
import type { User } from "../data/acessos";
import { AnomaliasStrip } from "./Vigilancia";
import { anomalias } from "./../data/anomalias";
import { ContasAVencer } from "../financeiro/ContasAVencer";
import { useLancamentos } from "../financeiro/api";
import type { LancamentoLinhaDTO, SituacaoLancamento } from "../financeiro/api";

export function ActivityPill({ atv, mix }: { atv?: string; mix?: boolean }) {
  if (mix) {
    return (
      <span className="act-pill mix">
        <span className="dot"></span>Misto
      </span>
    );
  }
  const map: Record<string, string> = { leite: "Leite", cafe: "Café", outros: "Outros" };
  return (
    <span className={"act-pill " + (atv ?? "outros")}>
      <span className="dot"></span>
      {map[atv ?? "outros"] ?? "Outros"}
    </span>
  );
}

// ── Mock (KPIs): a faixa de resumo/filtros de atividade+pilha ainda lê do mock
// `R.gastos`. DÉBITO conhecido — só a TABELA de lançamentos abaixo é real. Os
// KPIs precisam de agregados no servidor (fora desta fatia). ──────────────────
type Gasto = {
  id: number;
  data: string;
  fornecedor: string;
  subtitle: string;
  categoria: string;
  valor: number;
  atividade: string;
  investimento: boolean;
  mix?: boolean;
};

// ── Lançamentos reais (GET /api/lancamentos) ─────────────────────────────────

// range (Date local, meia-noite) → "YYYY-MM-DD" pelos componentes locais, sem
// passar por toISOString (que deslocaria o dia pelo fuso).
function diaISO(d: Date | null): string | undefined {
  if (!d) return undefined;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// "2026-05-28" → "28/05/2026"
function fmtDataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const SITUACAO_LABEL: Record<SituacaoLancamento, string> = {
  LIQUIDADO: "Pago",
  ABERTO: "A vencer",
  LIQUIDADO_PARCIAL: "Parcial",
};

function SituacaoPill({ situacao }: { situacao: SituacaoLancamento }) {
  return (
    <span
      style={{
        fontSize: 11,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid var(--rule)",
        color: situacao === "LIQUIDADO" ? "var(--ink-2)" : "var(--cafe)",
        whiteSpace: "nowrap",
      }}
    >
      {SITUACAO_LABEL[situacao]}
    </span>
  );
}

const PAGINA = 100;

// Detalhe do lançamento — só campos REAIS do DTO (sem dados fabricados).
function LancamentoDrawer({ lanc, onClose }: { lanc: LancamentoLinhaDTO | null; onClose: () => void }) {
  useEffect(() => {
    if (!lanc) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lanc, onClose]);

  if (!lanc) return null;
  const nome = lanc.fornecedorNome ?? "(sem fornecedor)";

  return (
    <div
      className="drawer-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhes do lançamento ${nome}`}
    >
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <div className="eyebrow">Lançamento #{String(lanc.id).padStart(5, "0")}</div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 22, marginTop: 4 }}>{nome}</div>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="drawer-body">
          <div>
            <div className="eyebrow">Valor</div>
            <div
              className="drawer-amount mono-nums"
              style={{ color: lanc.natureza === "CREDITO" ? "var(--leite)" : "var(--ink)" }}
            >
              {fmtMoneyExact(lanc.valor)}
            </div>
            <div style={{ marginTop: 8 }}>
              <SituacaoPill situacao={lanc.situacao} />
            </div>
          </div>

          <div className="drawer-meta-grid">
            <div className="mcell">
              <span className="ml">Data (caixa)</span>
              <span className="mv">{fmtDataBR(lanc.data)}</span>
            </div>
            <div className="mcell">
              <span className="ml">Vencimento</span>
              <span className="mv">{fmtDataBR(lanc.dataVencimento)}</span>
            </div>
            <div className="mcell">
              <span className="ml">Categoria</span>
              <span className="mv">{lanc.categoriaNome}</span>
            </div>
            <div className="mcell">
              <span className="ml">Grupo</span>
              <span className="mv">{lanc.grupoNome ?? "—"}</span>
            </div>
            <div className="mcell">
              <span className="ml">Natureza</span>
              <span className="mv">{lanc.natureza === "CREDITO" ? "Entrada" : "Saída"}</span>
            </div>
            <div className="mcell">
              <span className="ml">Nota fiscal</span>
              <span className="mv">{lanc.temNota ? "Anexa" : "Sem nota"}</span>
            </div>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Descrição
            </div>
            <div style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.55 }}>
              {lanc.descricao ?? "(sem descrição)"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// A TABELA de lançamentos, agora REAL. Filtra por período (DateRangePicker) e
// busca textual (a mesma caixa de busca da toolbar). natureza=DEBITO: a aba é
// "Gastos" (saídas), espelhando o mock `R.gastos`. Os filtros de atividade/pilha
// da toolbar NÃO afetam esta tabela — o DTO não carrega atividade/investimento
// (DÉBITO conhecido; exigiria centro de custo no endpoint).
function LancamentosReais({ range, search }: { range: DateRange; search: string }) {
  const from = diaISO(range.start);
  const to = diaISO(range.end);
  const q = search.trim() || undefined;
  const [limit, setLimit] = useState(PAGINA);

  // Reset da paginação quando os filtros mudam.
  useEffect(() => { setLimit(PAGINA); }, [from, to, q]);

  const { data, loading, erro, recarregar } = useLancamentos({
    from,
    to,
    q,
    natureza: "DEBITO",
    limit,
  });

  const [aberto, setAberto] = useState<LancamentoLinhaDTO | null>(null);

  if (loading && !data) {
    return (
      <div className="empty-state" style={{ marginTop: 24 }}>
        <div className="icon" aria-hidden>⏳</div>
        <div className="title">Carregando lançamentos…</div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="empty-state" style={{ marginTop: 24 }}>
        <div className="icon" aria-hidden>!</div>
        <div className="title">Não foi possível carregar os lançamentos</div>
        <div className="detail">{erro}</div>
        <div className="actions">
          <button className="btn-ghost" onClick={() => recarregar()}>Tentar de novo</button>
        </div>
      </div>
    );
  }

  const itens = data?.itens ?? [];
  const total = data?.total ?? 0;

  return (
    <div style={{ marginTop: 24 }}>
      {itens.length > 0 ? (
        <>
          <table className="expense-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Data</th>
                <th>Fornecedor</th>
                <th>Categoria</th>
                <th style={{ width: 110 }}>Situação</th>
                <th style={{ width: 48 }}></th>
                <th className="right" style={{ width: 160 }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((l) => (
                <tr
                  key={l.id}
                  className={aberto?.id === l.id ? "active" : ""}
                  onClick={() => setAberto(l)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Ver detalhes do lançamento ${l.fornecedorNome ?? "sem fornecedor"}, ${fmtMoneyExact(l.valor)}`}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAberto(l); } }}
                >
                  <td className="date">{fmtDataBR(l.data)}</td>
                  <td>
                    <span className="supplier">{l.fornecedorNome ?? "(sem fornecedor)"}</span>
                    {l.descricao && <small>{l.descricao}</small>}
                  </td>
                  <td>{l.categoriaNome}</td>
                  <td><SituacaoPill situacao={l.situacao} /></td>
                  <td>
                    {l.temNota && (
                      <span
                        title="Nota fiscal anexa"
                        style={{
                          fontSize: 11,
                          color: "var(--ink-3)",
                          border: "1px solid var(--rule)",
                          borderRadius: 4,
                          padding: "1px 5px",
                        }}
                      >
                        NF
                      </span>
                    )}
                  </td>
                  <td className="amount">{fmtMoneyExact(l.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ padding: "28px 0 60px" }}>
            <div className="caption" style={{ letterSpacing: "0.16em", textTransform: "uppercase" }}>
              Dados reais — mostrando {itens.length} de {total} lançamentos (saídas no período + busca).
            </div>
            {data?.temMais && (
              <div style={{ marginTop: 14 }}>
                <button className="btn-ghost" onClick={() => setLimit((n) => n + PAGINA)} disabled={loading}>
                  {loading ? "Carregando…" : "Carregar mais"}
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <div className="icon" aria-hidden>⌕</div>
          <div className="title">Nenhum lançamento no período</div>
          <div className="detail">
            Nenhuma saída bate com o período e a busca atuais. Ajuste o intervalo de datas ou limpe a busca.
          </div>
        </div>
      )}

      <LancamentoDrawer lanc={aberto} onClose={() => setAberto(null)} />
    </div>
  );
}

export function Gastos({ onNav, user }: { onNav: (t: Tab) => void; user?: User }) {
  const hoje = getHoje();
  const [range, setRange] = useState<DateRange>({
    start: new Date(hoje.getFullYear(), hoje.getMonth(), 1),
    end: hoje,
  });
  const [filterAct, setFilterAct] = useState<"Tudo" | "Leite" | "Café" | "Outros">("Tudo");
  const [filterInvest, setFilterInvest] = useState<"Tudo" | "Custeio" | "Investimento">("Tudo");
  const [search, setSearch] = useState("");

  // KPIs de resumo (mock — DÉBITO conhecido). A tabela abaixo é real.
  const gastos = R.gastos as Gasto[];
  const filtered = useMemo(() => {
    return gastos.filter((g) => {
      if (filterAct !== "Tudo" && g.atividade !== filterAct.toLowerCase()) return false;
      if (filterInvest === "Custeio" && g.investimento) return false;
      if (filterInvest === "Investimento" && !g.investimento) return false;
      if (search) {
        const s = search.toLowerCase();
        return g.fornecedor.toLowerCase().includes(s) || g.categoria.toLowerCase().includes(s);
      }
      return true;
    });
  }, [filterAct, filterInvest, search, gastos]);

  const total = filtered.reduce((s, g) => s + g.valor, 0);
  const totalCusteio = filtered.filter((g) => !g.investimento).reduce((s, g) => s + g.valor, 0);
  const totalInvest = filtered.filter((g) => g.investimento).reduce((s, g) => s + g.valor, 0);

  return (
    <div className={"shell-wide " + (user && !user.flags.includes("verValores") ? "mask-values" : "")}>
      <ReportHeader
        subtitle="Gastos — exploração descritiva"
        range={range}
        onRangeChange={setRange}
        updatedAt={R.UPDATED_AT}
      />

      <ContasAVencer />

      <ContextStrip
        items={[
          { label: "Período", value: formatRangeLabel(range) },
          { label: "Atividade", value: filterAct === "Tudo" ? "Todas" : filterAct },
          { label: "Tipo", value: filterInvest === "Tudo" ? "Custeio + investimento" : filterInvest },
        ]}
      />

      <AnomaliasStrip
        R={{ anomalias }}
        onNav={onNav}
        onDrill={(catId) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const c = R.categoriasReais.find((x: any) => x.id === catId);
          if (c) setSearch(c.nome.split(" ")[0]);
        }}
      />

      <div className="gastos-toolbar">
        <div
          className="filter-chip"
          aria-pressed={filterAct === "Tudo"}
          onClick={() => setFilterAct("Tudo")}
        >
          <span className="chip-label">Atividade</span> Tudo
        </div>
        {(["Leite", "Café", "Outros"] as const).map((a) => (
          <div
            key={a}
            className="filter-chip"
            aria-pressed={filterAct === a}
            onClick={() => setFilterAct(a)}
          >
            <span
              className="dot"
              style={{
                width: 8,
                height: 8,
                display: "inline-block",
                background:
                  a === "Leite" ? "var(--leite)" : a === "Café" ? "var(--cafe)" : "var(--outros)",
              }}
            ></span>
            {a}
          </div>
        ))}
        <div style={{ width: 1, height: 28, background: "var(--rule)", margin: "0 6px" }}></div>
        {(["Tudo", "Custeio", "Investimento"] as const).map((k) => (
          <div
            key={k}
            className="filter-chip"
            aria-pressed={filterInvest === k}
            onClick={() => setFilterInvest(k)}
          >
            <span className="chip-label">Pilha</span> {k}
          </div>
        ))}
        <div className="search-box">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <circle cx="11" cy="11" r="7"></circle>
            <line x1="16" y1="16" x2="21" y2="21"></line>
          </svg>
          <input
            placeholder="Buscar fornecedor, descrição…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar nos lançamentos"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Limpar busca"
              style={{
                background: "none", border: 0, cursor: "pointer",
                color: "var(--ink-3)", padding: 0, fontSize: 16, lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="gastos-summary">
        <div className="sum">
          <div className="label">Lançamentos no filtro</div>
          <div className="val">{filtered.length}</div>
        </div>
        <div className="sum">
          <div className="label">Total</div>
          <div className="val mono-nums">{fmtMoneyExact(total)}</div>
        </div>
        <div className="sum">
          <div className="label">Custeio</div>
          <div className="val mono-nums" style={{ color: "var(--cafe)" }}>
            {fmtMoneyExact(totalCusteio)}
          </div>
        </div>
        <div className="sum">
          <div className="label">Investimento</div>
          <div className="val mono-nums" style={{ color: "var(--outros)", fontStyle: "italic" }}>
            {fmtMoneyExact(totalInvest)}
          </div>
        </div>
      </div>

      <LancamentosReais range={range} search={search} />
    </div>
  );
}
