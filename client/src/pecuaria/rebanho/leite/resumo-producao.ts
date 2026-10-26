export interface DiaOperacionalLeite {
  data:string;
  consumo:{totalLitros:string|null;comumLitros:string|null;naoComercialLitros:string|null;colostroLitros:string|null;nutricaoLitros:string|null;funcionariosLitros:null;casaLitros:null};
  descarte:{totalLitros:string|null;comercialLitros:string|null;naoComercialLitros:string|null;semClassificacaoLitros:string|null;colostroLitros:string|null};
  vendas:{totalLitros:string|null;compradores:{id:string|null;nome:string;litros:string}[];coletasSemPreco:number};
}
export interface ResumoOperacionalProducao {propriedadeId:number;periodo:{inicio:string;fim:string};dias:DiaOperacionalLeite[]}
const somar=(valores:(string|null)[])=>valores.every(v=>v===null)?null:String(Math.round(valores.reduce<number>((s,v)=>s+(v===null?0:Number(v)),0)*1000)/1000);
/** Agregação de apresentação: mesmo período, fatos já deduplicados no servidor. */
export function resumirOperacionalPeriodo(dias:DiaOperacionalLeite[],periodo:string):DiaOperacionalLeite {
 const filtrados=dias.filter(d=>d.data.startsWith(periodo));
 const compradores=new Map<string,{id:string|null;nome:string;litros:string}>();
 for(const d of filtrados)for(const c of d.vendas.compradores){const chave=c.id??`sem-id:${c.nome}`;const anterior=compradores.get(chave);compradores.set(chave,{...c,litros:somar([anterior?.litros??null,c.litros])!})}
 return {data:periodo,
 consumo:{totalLitros:somar(filtrados.map(d=>d.consumo.totalLitros)),comumLitros:somar(filtrados.map(d=>d.consumo.comumLitros)),naoComercialLitros:somar(filtrados.map(d=>d.consumo.naoComercialLitros)),colostroLitros:somar(filtrados.map(d=>d.consumo.colostroLitros)),nutricaoLitros:somar(filtrados.map(d=>d.consumo.nutricaoLitros)),funcionariosLitros:null,casaLitros:null},
 descarte:{totalLitros:somar(filtrados.map(d=>d.descarte.totalLitros)),comercialLitros:somar(filtrados.map(d=>d.descarte.comercialLitros)),naoComercialLitros:somar(filtrados.map(d=>d.descarte.naoComercialLitros)),colostroLitros:somar(filtrados.map(d=>d.descarte.colostroLitros)),semClassificacaoLitros:somar(filtrados.map(d=>d.descarte.semClassificacaoLitros))},
 vendas:{totalLitros:somar(filtrados.map(d=>d.vendas.totalLitros)),compradores:[...compradores.values()].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')),coletasSemPreco:filtrados.reduce((s,d)=>s+d.vendas.coletasSemPreco,0)}};
}
export interface GrupoProducaoLeite {periodo:string;litros:number|null;completa:boolean;vacasOrdenhadas?:number|null;mediaPorVaca?:number|null;turnos:{posicaoId:string;nome?:string;litros:number|null}[]}
