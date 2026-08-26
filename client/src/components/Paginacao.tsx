import { useEffect, useMemo, useState } from "react";

export const OPCOES_POR_PAGINA = [10, 25, 50, 100] as const;

export function usePaginacaoLocal<T>(itens: readonly T[], resetDeps: readonly unknown[] = []) {
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState<number>(25);
  useEffect(() => setPagina(1), [porPagina, ...resetDeps]);
  const totalPaginas = Math.max(1, Math.ceil(itens.length / porPagina));
  useEffect(() => { if (pagina > totalPaginas) setPagina(totalPaginas); }, [pagina, totalPaginas]);
  const paginaItens = useMemo(() => itens.slice((pagina - 1) * porPagina, pagina * porPagina), [itens, pagina, porPagina]);
  return { pagina, setPagina, porPagina, setPorPagina, total: itens.length, totalPaginas, itens: paginaItens };
}

export function Paginacao({ estado, nome = "registros" }: { estado: ReturnType<typeof usePaginacaoLocal<any>>; nome?: string }) {
  const { pagina, setPagina, porPagina, setPorPagina, total, totalPaginas } = estado;
  if (total === 0) return null;
  const inicio = (pagina - 1) * porPagina + 1;
  const fim = Math.min(pagina * porPagina, total);
  const btn = "cursor-pointer border border-[color:var(--rule)] bg-transparent px-3 py-1.5 text-xs font-semibold text-ink enabled:hover:bg-[color:var(--paper-2)] disabled:cursor-not-allowed disabled:opacity-50";
  return <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-3">
    <span>Mostrando {inicio}–{fim} de <span className="tabular-nums">{total}</span> {nome}</span>
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1.5">Ver
        <select aria-label="Itens por página" value={porPagina} onChange={(e) => setPorPagina(Number(e.target.value))} className="border border-[color:var(--rule)] bg-card px-1.5 py-1 text-xs text-ink">
          {OPCOES_POR_PAGINA.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <span>Página {pagina} de {totalPaginas}</span>
      <button type="button" className={btn} disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>← Anterior</button>
      <button type="button" className={btn} disabled={pagina === totalPaginas} onClick={() => setPagina(pagina + 1)}>Próxima →</button>
    </div>
  </div>;
}
