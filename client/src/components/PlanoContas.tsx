/* Rio Novo — Plano de Contas (categorias) */

import { useState } from "react";
import R from "../data/rionovo";
import { ReportHeader } from "./Shell";
import { fmtMoney } from "./charts";
import type { Tab } from "./Shell";
import { useEscClose } from "../hooks/useEscClose";

function NewCategoryModal({ onClose }: { onClose: () => void }) {
  useEscClose(onClose);
  const [nome, setNome] = useState("");
  const [grupoId, setGrupoId] = useState("insumos-animais");
  const [pilha, setPilha] = useState<"Custeio" | "Investimento">("Custeio");
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="ttl">Nova categoria</span>
          <button className="close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label className="field-label">Nome da categoria</label>
            <input
              className="field-input"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Ração de cavalo"
            />
          </div>
          <div className="field">
            <label className="field-label">Grupo</label>
            <div className="chip-group">
              {R.gruposPlano.map((g: { id: string; nome: string }) => (
                <button
                  key={g.id}
                  type="button"
                  className="chip"
                  aria-pressed={grupoId === g.id}
                  onClick={() => setGrupoId(g.id)}
                >
                  {g.nome}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="field-label">Pilha</label>
            <div className="chip-group">
              {(["Custeio", "Investimento"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className="chip"
                  aria-pressed={pilha === p}
                  onClick={() => setPilha(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="field-label">Descrição (opcional)</label>
            <textarea className="field-textarea" placeholder="Ajuda a IA a categorizar lançamentos futuros."></textarea>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" disabled title="Em desenvolvimento">
            Criar categoria →
          </button>
        </div>
      </div>
    </div>
  );
}

function TreeSub({ sub }: { sub: { nome: string; total: number; lancamentos: number } }) {
  return (
    <div className="tree-sub">
      <span className="bullet">·</span>
      <span className="snm">{sub.nome}</span>
      <span className="stot mono-nums">{fmtMoney(sub.total)}</span>
      <span className="scnt">{sub.lancamentos} lançam.</span>
    </div>
  );
}

function TreeCat({
  cat,
  expanded,
  onToggle,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cat: any;
  expanded: boolean;
  onToggle: () => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let subs: any[] = cat.subcategorias || [];
  let total: number = cat.total || 0;
  let lancamentos: number = cat.lancamentos || 0;
  if (cat.ref) {
    const d = R.categoriasDetalhe[cat.ref];
    if (d) {
      subs = d.subcategorias.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (s: any) => ({ nome: s.nome, total: s.total, lancamentos: Math.round(s.share * 4 + 10) }),
      );
      total = d.total;
      lancamentos = d.subcategorias.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (s: number, x: any) => s + Math.round(x.share * 4 + 10),
        0,
      );
    }
  }

  return (
    <div>
      <button className="tree-cat-head" onClick={onToggle}>
        <span className="cnm">{cat.nome}</span>
        <span className="ctot mono-nums">{fmtMoney(total)}</span>
        <span className="ccnt">
          {lancamentos} lançam. · {subs.length} subcategorias
        </span>
        <span className="chev">{expanded ? "▾" : "›"}</span>
      </button>
      {expanded && (
        <div className="tree-subs">
          {subs.map((s, i) => (
            <TreeSub key={i} sub={s} />
          ))}
          <button className="tree-sub-add" type="button" disabled title="Em desenvolvimento">
            <span className="bullet">+</span>
            <span>adicionar subcategoria</span>
          </button>
        </div>
      )}
    </div>
  );
}

function TreeGroup({
  grupo,
  search,
  defaultOpen,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  grupo: any;
  search: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalG = grupo.categorias.reduce((sum: number, c: any) => {
    if (c.ref) return sum + (R.categoriasDetalhe[c.ref]?.total || 0);
    return sum + (c.total || 0);
  }, 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cntG = grupo.categorias.reduce((sum: number, c: any) => {
    if (c.ref) {
      const d = R.categoriasDetalhe[c.ref];
      if (d) return sum + d.subcategorias.length;
      return sum;
    }
    return sum + (c.subcategorias?.length || 0);
  }, 0);

  const filtered = search
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      grupo.categorias.filter((c: any) => c.nome.toLowerCase().includes(search.toLowerCase()))
    : grupo.categorias;

  if (search && filtered.length === 0) return null;

  return (
    <div className="tree-group">
      <button className="tree-group-head" onClick={() => setOpen(!open)}>
        <span className="gnm">
          {grupo.nome}
          <small>
            {grupo.pilha} · {grupo.categorias.length} categorias · {cntG} subcategorias
          </small>
        </span>
        <span className="gtot mono-nums">{fmtMoney(totalG)}</span>
        <span className="gcnt">YTD 2026</span>
        <span className="chev">{open ? "▾" : "›"}</span>
      </button>
      {open && (
        <div className="tree-cat">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {filtered.map((c: any) => (
            <TreeCat
              key={c.id}
              cat={c}
              expanded={!!openCats[c.id]}
              onToggle={() => setOpenCats((s) => ({ ...s, [c.id]: !s[c.id] }))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PlanoContas({ onNav: _onNav }: { onNav: (t: Tab) => void }) {
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalCat: number = R.gruposPlano.reduce((s: number, g: any) => s + g.categorias.length, 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalSub: number = R.gruposPlano.reduce((s: number, g: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return s + g.categorias.reduce((ss: number, c: any) => {
      if (c.ref) return ss + (R.categoriasDetalhe[c.ref]?.subcategorias?.length || 0);
      return ss + (c.subcategorias?.length || 0);
    }, 0);
  }, 0);

  return (
    <div className="shell-wide">
      <ReportHeader subtitle="Plano de Contas" updatedAt={R.UPDATED_AT} />

      <div className="plano-toolbar">
        <div className="search-box" style={{ marginLeft: 0, width: 320 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="7"></circle>
            <line x1="16" y1="16" x2="21" y2="21"></line>
          </svg>
          <input
            placeholder="Buscar categoria ou subcategoria…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <button type="button" className="btn-ghost" disabled title="Em desenvolvimento">Exportar CSV</button>
          <button type="button" className="btn-primary" onClick={() => setShowNew(true)}>
            + Nova categoria
          </button>
        </div>
      </div>

      <div className="plano-grid">
        <div>
          <div className="caption" style={{ marginBottom: 14, fontStyle: "italic" }}>
            Toque um grupo para abrir suas categorias. Toque uma categoria para ver as subcategorias.
          </div>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {R.gruposPlano.map((g: any, i: number) => (
            <TreeGroup key={g.id} grupo={g} search={search} defaultOpen={i < 2} />
          ))}
        </div>

        <div className="plano-side-section">
          <h4>Resumo</h4>
          <div className="plano-stats">
            <div className="cell">
              <span className="l">Grupos</span>
              <span className="v mono-nums">{R.gruposPlano.length}</span>
            </div>
            <div className="cell">
              <span className="l">Categorias</span>
              <span className="v mono-nums">{totalCat}</span>
            </div>
            <div className="cell">
              <span className="l">Subcategorias</span>
              <span className="v mono-nums">{totalSub}</span>
            </div>
            <div className="cell">
              <span className="l">Última edição</span>
              <span
                className="v mono-nums"
                style={{ fontSize: 14, fontVariantNumeric: "tabular-nums" }}
              >
                23/mai/2026
              </span>
            </div>
          </div>

          <h4 style={{ marginTop: 22 }}>Sugestões da IA</h4>
          <div className="ia-suggestions">
            {R.sugestoesPlano.map(
              (s: { titulo: string; detalhe: string; acao: string }, i: number) => (
                <div key={i} className="ia-suggestion-card">
                  <div className="head">
                    <span className="dot"></span>
                    <span className="lbl">Sugestão</span>
                  </div>
                  <div className="ttl">{s.titulo}</div>
                  <div className="det">{s.detalhe}</div>
                  <div className="row">
                    <button type="button" className="btn-mini" disabled title="Em desenvolvimento">{s.acao}</button>
                    <button type="button" className="btn-mini ghost" disabled title="Em desenvolvimento">Ignorar</button>
                  </div>
                </div>
              ),
            )}
          </div>

          <div
            style={{
              marginTop: 10,
              padding: "16px 18px",
              background: "var(--bg-card)",
              borderLeft: "3px solid var(--leite)",
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              color: "var(--ink-2)",
              fontSize: 15,
              lineHeight: 1.5,
            }}
          >
            A IA observa os lançamentos novos e sugere divisões ou agrupamentos quando detecta padrões. Você decide
            se aceita.
          </div>
        </div>
      </div>

      {showNew && <NewCategoryModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
