import type {Tab} from '../components/Shell';
/** A revisão operacional nunca entra nas rotas financeiras, mesmo em componentes compartilhados. */
export function usaDesignOperacional(tab:Tab,pathname:string):boolean {
 if(pathname.startsWith('/financeiro')) return false;
 return tab.startsWith('pec-') || ['estoque','gerencial','acessos','sitios'].includes(tab) || (tab==='config'&&pathname.startsWith('/configuracoes/pecuaria'));
}
