import {fontesRebanho} from './catalogo-rebanho';
import {fontesSanidadeLeite} from './catalogo-sanidade-leite';
import {fontesNutricaoCustos} from './catalogo-nutricao-custos';
import type {DefinicaoFonteOperacional} from './tipos-operacionais';
export const fontesOperacionais={...fontesRebanho,...fontesSanidadeLeite,...fontesNutricaoCustos};
export type FonteOperacionalId=keyof typeof fontesOperacionais;
export type FonteCatalogoId=FonteOperacionalId|'tentativas';
export function ehFonteOperacional(v:string):v is FonteOperacionalId{return Object.hasOwn(fontesOperacionais,v)}
export function ehFonteCatalogo(v:string):v is FonteCatalogoId{return v==='tentativas'||ehFonteOperacional(v)}
export function definicaoOperacional(v:string):DefinicaoFonteOperacional|undefined{return ehFonteOperacional(v)?fontesOperacionais[v]:undefined}
