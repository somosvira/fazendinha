import type { ReactNode, RefObject } from "react";
import { BuscaLista } from "../components/BuscaLista";
import { SubTabs } from "../components/SubTabs";
import { Dialog, DialogContent, DialogTitle } from "../components/ui/dialog";
import { Paginacao } from "../financeiro/financeiro-ui";

export function DialogoSelecaoProdutos({ aberto, onAberto, gatilho, titulo, contexto, busca, onBusca, aba, onAba, mostrarAbas, paginacao, children, resumo, acoes }: {
  aberto: boolean; onAberto: (v: boolean) => void; gatilho: RefObject<HTMLButtonElement>; titulo: string; contexto: string;
  busca: string; onBusca: (v: string) => void; aba: "meus" | "catalogo"; onAba: (v: "meus" | "catalogo") => void; mostrarAbas: boolean;
  paginacao?: { pagina: number; total: number; porPagina: number; onPagina: (v: number) => void }; children: ReactNode; resumo?: ReactNode; acoes: ReactNode;
}) {
  return <Dialog open={aberto} onOpenChange={onAberto}><DialogContent overlayClassName="z-[1390]" aria-describedby={undefined} className="z-[1400] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl flex-col gap-3 overflow-hidden" onCloseAutoFocus={e => { e.preventDefault(); gatilho.current?.focus(); }}>
    <div className="shrink-0 px-5 pt-5 pr-14"><DialogTitle>{titulo}</DialogTitle><p className="mt-1 text-sm text-ink-3">{contexto}</p></div>
    <div className="shrink-0 px-5"><BuscaLista rotulo="Buscar produto" placeholder="Buscar produto" valor={busca} onChange={onBusca}/></div>
    {mostrarAbas && <div className="shrink-0 px-5"><SubTabs tabs={[{ id: "meus", label: "Meus produtos" }, { id: "catalogo", label: "Catálogo" }]} active={aba} onSelect={onAba} ariaLabel="Origem dos produtos" className="[&_button]:whitespace-nowrap" variant="financeiro"/></div>}
    <div className="min-h-0 flex-1 overflow-y-auto px-5">{children}</div>
    {paginacao && <div className="[&_button]:max-sm:px-2 [&_select]:max-sm:text-xs"><Paginacao pagina={paginacao.pagina} totalPaginas={Math.max(1, Math.ceil(paginacao.total / paginacao.porPagina))} total={paginacao.total} porPagina={paginacao.porPagina} rotulo="Paginação de produtos" substantivo="produtos" idSelect="pagina-seletor-produtos" onPagina={paginacao.onPagina}/></div>}
    {resumo}<div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border px-5 py-4">{acoes}</div>
  </DialogContent></Dialog>;
}
