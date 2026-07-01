/* Rio Novo — command palette (busca global ⌘K, estilo Cloudflare).
 *
 * Modal client-only: navega entre páginas/abas + dispara ações (atalhos).
 * Filtra o índice por `podeVer` (abas bloqueadas do Financeiro/Admin somem;
 * abas de módulo passam sempre). Busca via `buscar()` puro. Teclado completo.
 *
 * Acessibilidade: role=dialog/aria-modal, foco no input ao abrir, foco preso no
 * painel, scroll do body travado enquanto aberto, clique no backdrop fecha.
 * Nada toca `window`/`document` no nível de módulo — só dentro de effects.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { Tab } from "./Shell";
import { COMANDOS, buscar, type Comando, type GrupoComando, type ResultadoBusca } from "../lib/searchIndex";

type Props = {
  aberto: boolean;
  onFechar: () => void;
  onNav: (t: Tab, entidadeId?: string) => void;
  podeVer: (t: Tab) => boolean;
};

// Ordem fixa dos cabeçalhos de entidades reais (depois dos grupos de navegação).
const ORDEM_GRUPO_ENTIDADE = ["Talhões", "Animais", "Lotes de corte", "Categorias", "Fornecedores"];

// Ordem fixa das seções (cabeçalhos) no resultado.
const ORDEM_GRUPO: GrupoComando[] = [
  "Ações",
  "Financeiro",
  "Rebanho",
  "Plantio",
  "Gado de corte",
  "Administração",
];

// Pontinho colorido por grupo (reusa as vars de atividade da paleta).
const COR_GRUPO: Record<GrupoComando, string> = {
  Financeiro: "var(--info)",
  Rebanho: "var(--leite)",
  Plantio: "var(--outros)",
  "Gado de corte": "var(--cafe-2)",
  Administração: "var(--ink-3)",
  Ações: "var(--leite-2)",
};

function MagnifierIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function CommandPalette({ aberto, onFechar, onNav, podeVer }: Props) {
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const [entidades, setEntidades] = useState<ResultadoBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Índice já filtrado pela permissão — abas bloqueadas não aparecem.
  const visiveis = useMemo(() => COMANDOS.filter((c) => podeVer(c.tab)), [podeVer]);

  // Resultado plano (na ordem de exibição) — usado para navegação por teclado.
  const resultados = useMemo(() => buscar(visiveis, query), [visiveis, query]);

  // Agrupa preservando a ordem de ORDEM_GRUPO; dentro do grupo, ordem do resultado.
  const grupos = useMemo(() => {
    const out: { grupo: GrupoComando; itens: Comando[] }[] = [];
    for (const g of ORDEM_GRUPO) {
      const itens = resultados.filter((c) => c.grupo === g);
      if (itens.length) out.push({ grupo: g, itens });
    }
    return out;
  }, [resultados]);

  const vazio = query.trim() === "";

  // Busca de entidades reais no backend (GET /api/busca?q=). Só dispara com ≥2
  // chars, com debounce ~200ms; respostas obsoletas (query já mudou) são
  // ignoradas. NUNCA roda no nível de módulo — só dentro deste effect.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setEntidades([]);
      setBuscando(false);
      return;
    }
    let vivo = true;
    setBuscando(true);
    const id = window.setTimeout(() => {
      fetch(`/api/busca?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data: ResultadoBusca[]) => {
          if (!vivo) return; // resposta obsoleta — a query já mudou
          setEntidades(Array.isArray(data) ? data : []);
          setBuscando(false);
        })
        .catch(() => {
          if (!vivo) return;
          setEntidades([]);
          setBuscando(false);
        });
    }, 200);
    return () => {
      vivo = false;
      window.clearTimeout(id);
    };
  }, [query]);

  // Só entidades cujo `tab` o perfil pode ver (abas de módulo passam sempre).
  const entidadesVisiveis = useMemo(
    () => entidades.filter((e) => podeVer(e.tab as Tab)),
    [entidades, podeVer],
  );

  // Agrupa entidades por `grupo` na ordem fixa de ORDEM_GRUPO_ENTIDADE.
  const gruposEntidade = useMemo(() => {
    const out: { grupo: string; itens: ResultadoBusca[] }[] = [];
    for (const g of ORDEM_GRUPO_ENTIDADE) {
      const itens = entidadesVisiveis.filter((e) => e.grupo === g);
      if (itens.length) out.push({ grupo: g, itens });
    }
    // Qualquer grupo não previsto entra no fim, preservando a ordem de chegada.
    for (const e of entidadesVisiveis) {
      if (!ORDEM_GRUPO_ENTIDADE.includes(e.grupo) && !out.some((o) => o.grupo === e.grupo)) {
        out.push({ grupo: e.grupo, itens: entidadesVisiveis.filter((x) => x.grupo === e.grupo) });
      }
    }
    return out;
  }, [entidadesVisiveis]);

  // Lista achatada NA MESMA ORDEM da exibição (nav primeiro, entidades depois) —
  // o índice `sel` indexa aqui. Discrimina a origem de cada item para o Enter.
  const planos = useMemo<({ kind: "nav"; item: Comando } | { kind: "ent"; item: ResultadoBusca })[]>(
    () => [
      ...grupos.flatMap((g) => g.itens.map((item) => ({ kind: "nav" as const, item }))),
      ...gruposEntidade.flatMap((g) => g.itens.map((item) => ({ kind: "ent" as const, item }))),
    ],
    [grupos, gruposEntidade],
  );

  // Reset de seleção a cada nova query.
  useEffect(() => {
    setSel(0);
  }, [query]);

  // Ao abrir: limpa estado, foca o input, trava o scroll do body. Ao fechar/desmontar: restaura.
  useEffect(() => {
    if (!aberto) return;
    setQuery("");
    setSel(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = prevOverflow;
    };
  }, [aberto]);

  // Garante seleção dentro dos limites quando os resultados encolhem.
  useEffect(() => {
    if (sel > planos.length - 1) setSel(planos.length ? planos.length - 1 : 0);
  }, [planos.length, sel]);

  // Rola o item selecionado pra dentro da viewport da lista.
  useEffect(() => {
    if (!aberto) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${sel}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [sel, aberto]);

  if (!aberto) return null;

  const escolher = (p: (typeof planos)[number] | undefined) => {
    if (!p) return;
    if (p.kind === "nav") onNav(p.item.tab);
    else onNav(p.item.tab as Tab, p.item.entidadeId);
    onFechar();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onFechar();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (planos.length) setSel((s) => (s + 1) % planos.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (planos.length) setSel((s) => (s - 1 + planos.length) % planos.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      escolher(planos[sel]);
      return;
    }
    if (e.key === "Tab") {
      // Foco preso: só existe o input, então mantemos o foco nele.
      e.preventDefault();
      inputRef.current?.focus();
    }
  };

  const onBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onFechar();
  };

  return (
    <div className="cmdk-backdrop" onMouseDown={onBackdrop}>
      <div
        className="cmdk-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Busca global"
        ref={panelRef}
        onKeyDown={onKeyDown}
      >
        <div className="cmdk-search">
          <span className="cmdk-search-icon">
            <MagnifierIcon />
          </span>
          <input
            ref={inputRef}
            className="cmdk-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar páginas, ações e recursos…"
            autoComplete="off"
            spellCheck={false}
            aria-label="Pesquisar"
            aria-controls="cmdk-list"
          />
          <button className="cmdk-esc" onClick={onFechar} aria-label="Fechar busca" tabIndex={-1}>
            Esc
          </button>
        </div>

        <div className="cmdk-list" id="cmdk-list" role="listbox" ref={listRef}>
          {vazio && (
            <div className="cmdk-dicas">
              Digite uma página, ação ou recurso — ex.: <em>talhão</em>, <em>ferrugem</em>, <em>lançar gasto</em>.
            </div>
          )}

          {planos.length === 0 && !buscando ? (
            <div className="cmdk-empty">
              Nenhum resultado para «{query.trim()}»
            </div>
          ) : (
            <>
              {grupos.map((g) => (
                <div className="cmdk-group" key={g.grupo}>
                  <div className="cmdk-group-head">{vazio && g.grupo === "Financeiro" ? "Sugestões" : g.grupo}</div>
                  {g.itens.map((c) => {
                    const idx = planos.findIndex((p) => p.kind === "nav" && p.item === c);
                    const ativo = idx === sel;
                    return (
                      <div
                        key={c.id}
                        data-idx={idx}
                        role="option"
                        aria-selected={ativo}
                        className={"cmdk-row" + (ativo ? " is-active" : "")}
                        onMouseMove={() => setSel(idx)}
                        onClick={() => escolher(planos[idx])}
                      >
                        <span className="cmdk-dot" style={{ background: COR_GRUPO[c.grupo] }} aria-hidden />
                        <span className="cmdk-row-main">
                          <span className="cmdk-row-label">{c.label}</span>
                          {c.descricao && <span className="cmdk-row-desc">{c.descricao}</span>}
                        </span>
                        <span className="cmdk-row-crumb">{c.acao ? "Ação" : c.grupo}</span>
                      </div>
                    );
                  })}
                </div>
              ))}

              {gruposEntidade.map((g) => (
                <div className="cmdk-group" key={"ent-" + g.grupo}>
                  <div className="cmdk-group-head">{g.grupo}</div>
                  {g.itens.map((e) => {
                    const idx = planos.findIndex((p) => p.kind === "ent" && p.item === e);
                    const ativo = idx === sel;
                    return (
                      <div
                        key={e.tipo + ":" + e.entidadeId}
                        data-idx={idx}
                        role="option"
                        aria-selected={ativo}
                        className={"cmdk-row" + (ativo ? " is-active" : "")}
                        onMouseMove={() => setSel(idx)}
                        onClick={() => escolher(planos[idx])}
                      >
                        <span className="cmdk-dot" style={{ background: "var(--ink-3)" }} aria-hidden />
                        <span className="cmdk-row-main">
                          <span className="cmdk-row-label">{e.label}</span>
                          {e.sublabel && <span className="cmdk-row-desc">{e.sublabel}</span>}
                        </span>
                        <span className="cmdk-row-crumb">{e.grupo}</span>
                      </div>
                    );
                  })}
                </div>
              ))}

              {buscando && <div className="cmdk-buscando">buscando…</div>}
            </>
          )}
        </div>

        <div className="cmdk-footer">
          <span className="cmdk-hint"><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
          <span className="cmdk-hint"><kbd>↵</kbd> selecionar</span>
          <span className="cmdk-hint"><kbd>esc</kbd> fechar</span>
        </div>
      </div>
    </div>
  );
}
