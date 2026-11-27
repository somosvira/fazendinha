import type { Key, ReactNode } from "react";
import { TabelaFinanceira, type ColunaTabela } from "@/financeiro/financeiro-ui";
import "./consultas-leite.css";

export function ListaConsultaLeite<T>({ rotulo, itens, colunas, chaveDe, onAbrir, compacta, icone, iconeDe, rodape }: {
  /** Ícone padronizado da linha, mostrado na coluna principal. */
  icone?: React.ComponentProps<typeof TabelaFinanceira<T>>["icone"]; iconeDe?: React.ComponentProps<typeof TabelaFinanceira<T>>["iconeDe"];
  rotulo: string; itens: T[]; colunas: ColunaTabela<T>[];
  chaveDe: (item: T) => Key; onAbrir?: (item: T) => void; compacta?: boolean;
  /** Paginação da lista: fica dentro da mesma caixa da tabela, como nas demais consultas. */
  rodape?: ReactNode;
}) {
  return <div className="leite-lista-consulta">
    <TabelaFinanceira icone={icone} iconeDe={iconeDe} barraRolagemSuperior rotulo={rotulo} itens={itens} colunas={colunas} chaveDe={chaveDe} onAbrir={onAbrir} compacta={compacta} />
    {rodape}
  </div>;
}
