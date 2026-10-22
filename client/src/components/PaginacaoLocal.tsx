import { useEffect, useState } from "react";
import { Paginacao as PaginacaoFinanceira } from "@/financeiro/financeiro-ui";

/** Recorta somente a apresentação: a coleção completa segue disponível para agregados e regras. */
export function usePaginacaoLocal<T>(itens: readonly T[], chaveFiltros: string, porPagina = 15) {
  const [estado, setEstado] = useState({ chave: chaveFiltros, pagina: 1 });
  const totalPaginas = Math.max(1, Math.ceil(itens.length / porPagina));
  const pagina = estado.chave === chaveFiltros ? Math.min(estado.pagina, totalPaginas) : 1;
  useEffect(() => {
    setEstado((anterior) => anterior.chave === chaveFiltros && anterior.pagina === pagina ? anterior : { chave: chaveFiltros, pagina });
  }, [chaveFiltros, pagina]);
  return {
    itens: itens.slice((pagina - 1) * porPagina, pagina * porPagina),
    controles: { pagina, totalPaginas, total: itens.length, porPagina, onPagina: (proxima: number) => setEstado({ chave: chaveFiltros, pagina: Math.max(1, Math.min(proxima, totalPaginas)) }) },
  };
}

export function PaginacaoLocal({ controles, substantivo, id }: {
  controles: ReturnType<typeof usePaginacaoLocal>["controles"];
  substantivo: string;
  id: string;
}) {
  return <PaginacaoFinanceira {...controles} rotulo={`Paginação de ${substantivo}`} substantivo={substantivo} idSelect={id} />;
}
