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
import { COMANDOS, buscar, type Comando, type GrupoComando } from "../lib/searchIndex";

type Props = {
  aberto: boolean;
  onFechar: () => void;
  onNav: (t: Tab) => void;
  podeVer: (t: Tab) => boolean;
};

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

  // Lista achatada NA MESMA ORDEM dos grupos — o índice `sel` indexa aqui.
  const planos = useMemo(() => grupos.flatMap((g) => g.itens), [grupos]);

  const vazio = query.trim() === "";

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

  const escolher = (c: Comando | undefined) => {
    if (!c) return;
    onNav(c.tab);
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

          {planos.length === 0 ? (
            <div className="cmdk-empty">
              Nenhum resultado para «{query.trim()}»
            </div>
          ) : (
            grupos.map((g) => (
              <div className="cmdk-group" key={g.grupo}>
                <div className="cmdk-group-head">{vazio && g.grupo === "Financeiro" ? "Sugestões" : g.grupo}</div>
                {g.itens.map((c) => {
                  const idx = planos.indexOf(c);
                  const ativo = idx === sel;
                  return (
                    <div
                      key={c.id}
                      data-idx={idx}
                      role="option"
                      aria-selected={ativo}
                      className={"cmdk-row" + (ativo ? " is-active" : "")}
                      onMouseMove={() => setSel(idx)}
                      onClick={() => escolher(c)}
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
            ))
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
