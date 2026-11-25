import type { Key } from 'react';
import type { IconeTabela } from '@/components/iconesTabela';
import { TabelaFinanceira, type ColunaTabela } from '@/financeiro/financeiro-ui';

export type ListaBezerreiroProps<T> = {
  rotulo: string;
  itens: T[];
  chaveDe: (item: T) => Key;
  colunas: ColunaTabela<T>[];
  icone?: IconeTabela;
};

export function ListaBezerreiro<T>({ rotulo, itens, chaveDe, colunas, icone }: ListaBezerreiroProps<T>) {
  return <TabelaFinanceira icone={icone} rotulo={rotulo} itens={itens} chaveDe={chaveDe} colunas={colunas} />;
}
