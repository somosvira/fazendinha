import type {FonteRelatorio} from './catalogo';
export type DefinicaoFonteOperacional=FonteRelatorio&{area:string;referencia:'ATUAL'|'PERIODO'|'DATA';contexto?:'animal'|'lote';criterio?:string;escopo?:'SITIO'|'GLOBAL'};
