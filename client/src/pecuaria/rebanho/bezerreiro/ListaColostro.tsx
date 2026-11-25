import { createContext, useContext } from 'react';
import type { ModoConsulta } from '@/components/VisualizacaoConsulta';
import { ICONES_TABELA } from '@/components/iconesTabela';
import { ListaBezerreiro, type ListaBezerreiroProps } from './ListaBezerreiro';

export const VisualizacaoColostro = createContext<ModoConsulta | undefined>(undefined);

export function ListaColostro<T>(props: Omit<ListaBezerreiroProps<T>, 'modo'>) {
  const modo = useContext(VisualizacaoColostro);
  return <ListaBezerreiro icone={ICONES_TABELA.leite} {...props} />;
}
