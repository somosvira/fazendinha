import { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { CabecalhoTabela } from '@/financeiro/financeiro-ui';
import type { ComponentProps } from 'react';

/** A rotina usa o cabeçalho da página; consultas isoladas preservam seu próprio título. */
export const AcoesRotinaLeite = createContext<HTMLElement | null>(null);
export function CabecalhoRotinaLeite(props: ComponentProps<typeof CabecalhoTabela>) {
  const destino = useContext(AcoesRotinaLeite);
  return destino ? (props.acao ? createPortal(props.acao, destino) : null) : <CabecalhoTabela {...props}/>;
}
