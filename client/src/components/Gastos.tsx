/* Rio Novo — Gastos (expense exploration) */

import { useEffect, useMemo, useState } from "react";
import R from "../data/rionovo";
import { ReportHeader } from "./Shell";
import { ContextStrip } from "./ContextStrip";
import { formatRangeLabel } from "./DateRangePicker";
import { fmtMoneyExact } from "./charts";
import type { Tab } from "./Shell";
import type { DateRange } from "./DateRangePicker";
import type { User } from "../data/acessos";
import { AnomaliasStrip } from "./Vigilancia";
import { anomalias } from "./../data/anomalias";

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

function ExpenseDrawer({ gasto, onClose }: { gasto: Gasto | null; onClose: () => void }) {
  useEffect(() => {
    if (!gasto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gasto, onClose]);

  if (!gasto) return null;
  const splits = gasto.mix
    ? [
        { categoria: "Ração", atv: "leite", valor: 814.3 },
        { categoria: "Medicamento animal", atv: "leite", valor: 433.5 },
      ]
    : null;

  return (
    <div className="drawer-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Detalhes do lançamento ${gasto.fornecedor}`}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <div className="eyebrow">Lançamento #{String(gasto.id).padStart(5, "0")}</div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 22, marginTop: 4 }}>{gasto.fornecedor}</div>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="drawer-body">
          <div>
            <div className="eyebrow">Valor total</div>
            <div
              className="drawer-amount mono-nums"
              style={{
                color: gasto.investimento ? "var(--ink-2)" : "var(--ink)",
                fontStyle: gasto.investimento ? "italic" : "normal",
              }}
            >
              {fmtMoneyExact(gasto.valor)}
            </div>
            {gasto.investimento && (
              <div style={{ marginTop: 8 }}>
                <span className="invest-tag">Investimento</span>
              </div>
            )}
          </div>

          <div className="drawer-meta-grid">
            <div className="mcell">
              <span className="ml">Data</span>
              <span className="mv">{gasto.data}/2026</span>
            </div>
            <div className="mcell">
              <span className="ml">Categoria</span>
              <span className="mv">{gasto.categoria}</span>
            </div>
            <div className="mcell">
              <span className="ml">Atividade</span>
              <span className="mv">
                <ActivityPill atv={gasto.atividade} mix={gasto.mix} />
              </span>
            </div>
            <div className="mcell">
              <span className="ml">Conta bancária</span>
              <span className="mv">Banco do Brasil ag. 1234-5</span>
            </div>
            <div className="mcell">
              <span className="ml">Documento</span>
              <span className="mv">NF-e 00{gasto.id}.842</span>
            </div>
            <div className="mcell">
              <span className="ml">Lançado por</span>
              <span className="mv">Sandra (WhatsApp)</span>
            </div>
          </div>

          {splits && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                Separação automática
              </div>
              <div className="split-stack">
                {splits.map((s, i) => (
                  <div key={i} className="split-row">
                    <ActivityPill atv={s.atv} />
                    <span style={{ fontSize: 14 }}>{s.categoria}</span>
                    <span className="mono-nums" style={{ fontFamily: "var(--serif)", fontSize: 16 }}>
                      {fmtMoneyExact(s.valor)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="footnote" style={{ marginTop: 12 }}>
                <span className="dagger">†</span>
                <span>
                  Nota fiscal mista — itens separados a partir da leitura do XML pela IA. Toque em cada linha para
                  revisar.
                </span>
              </div>
            </div>
          )}

          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Nota fiscal anexa
            </div>
            <div className="nota-frame">
              <div className="nota-img">
                NF-e 00{gasto.id}.842 — {gasto.fornecedor.toUpperCase()}
              </div>
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: "var(--ink-3)",
                }}
              >
                <span>Capturada por: WhatsApp · Sandra (Admin)</span>
                <span>{gasto.data}/2026 — 16:42</span>
              </div>
            </div>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Descrição
            </div>
            <div style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.55 }}>
              {gasto.subtitle}. Compra efetuada em {gasto.data}/2026 com pagamento à vista via PIX. Categorizado
              automaticamente pela IA com base nos itens descritos na nota.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Gastos({ onNav, user }: { onNav: (t: Tab) => void; user?: User }) {
  const [range, setRange] = useState<DateRange>({ start: new Date(2026, 4, 1), end: new Date(2026, 4, 28) });
  const [filterAct, setFilterAct] = useState<"Tudo" | "Leite" | "Café" | "Outros">("Tudo");
  const [filterInvest, setFilterInvest] = useState<"Tudo" | "Custeio" | "Investimento">("Tudo");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Gasto | null>(null);

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
            placeholder="Buscar fornecedor, categoria…"
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

      <div style={{ marginTop: 24 }}>
        <table className="expense-table">
          <thead>
            <tr>
              <th style={{ width: 90 }}>Data</th>
              <th>Fornecedor</th>
              <th>Categoria</th>
              <th style={{ width: 120 }}>Atividade</th>
              <th style={{ width: 60 }}></th>
              <th className="right" style={{ width: 160 }}>
                Valor
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((g) => (
              <tr
                key={g.id}
                className={selected?.id === g.id ? "active" : ""}
                onClick={() => setSelected(g)}
                tabIndex={0}
                role="button"
                aria-label={`Ver detalhes do lançamento ${g.fornecedor}, ${fmtMoneyExact(g.valor)}`}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(g); } }}
              >
                <td className="date">{g.data}</td>
                <td>
                  <span className="supplier">{g.fornecedor}</span>
                  <small>{g.subtitle}</small>
                </td>
                <td>{g.categoria}</td>
                <td>
                  <ActivityPill atv={g.atividade} mix={g.mix} />
                </td>
                <td>{g.investimento && <span className="invest-tag">Invest.</span>}</td>
                <td className={"amount " + (g.investimento ? "invest" : "")}>{fmtMoneyExact(g.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="icon">⌕</div>
            <div className="title">Nenhum lançamento bate com esses filtros</div>
            <div className="detail">
              Tente outra combinação de período, atividade ou pilha — ou limpe a busca para ver tudo.
            </div>
            <div className="actions">
              <button
                className="btn-ghost"
                onClick={() => {
                  setFilterAct("Tudo");
                  setFilterInvest("Tudo");
                  setSearch("");
                }}
              >
                Limpar filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <div style={{ padding: "28px 0 60px" }}>
          <div className="caption" style={{ letterSpacing: "0.16em", textTransform: "uppercase" }}>
            Mostrando {filtered.length} de {gastos.length} lançamentos.
            {gastos.length > filtered.length && " Refine o filtro para ver mais."}
          </div>
        </div>
      )}

      <ExpenseDrawer gasto={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
