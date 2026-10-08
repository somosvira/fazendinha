import { Button } from "../../../financeiro/financeiro-ui";
export function PaginacaoNutricao({ pagina, total, limite, onPagina, nome }: { pagina: number; total: number; limite: number; onPagina: (p: number) => void; nome: string }) {
  if (total <= limite) return null;
  return <nav className="nutricao-paginacao" aria-label={`Páginas de ${nome}`}><span>Página {pagina} · {total} {nome}</span><div className="flex gap-2"><Button secondary disabled={pagina === 1} onClick={() => onPagina(pagina - 1)}>Anteriores</Button><Button secondary disabled={pagina * limite >= total} onClick={() => onPagina(pagina + 1)}>Mais {nome}</Button></div></nav>;
}
