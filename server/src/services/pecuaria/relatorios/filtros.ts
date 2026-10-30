import {z} from 'zod';
import {Prisma} from '@prisma/client';
import catalogo from './filtros-campos.json';
import {diaIatf} from '../reproducao/horarios.calc.js';
import type {LinhaRelatorio} from './tipos.js';
export type TipoCampoFiltro='texto'|'numero'|'data'|'booleano';
export type CampoFiltroRelatorio={id:string;tipo:TipoCampoFiltro;monetario?:boolean;unidade?:string};
export const operadoresFiltro=['igual','diferente','contem','entre','maiorIgual','menorIgual','informado','naoInformado','umDe'] as const;
const escalar=z.union([z.string().max(500),z.number().finite(),z.boolean()]);
export const regraFiltroSchema=z.object({campo:z.string().min(1).max(80),operador:z.enum(operadoresFiltro),valor:escalar.optional(),ate:escalar.optional(),valores:z.array(escalar).min(1).max(100).optional()}).strict();
export const filtrosRelatorioSchema=z.array(regraFiltroSchema).max(20);
export type RegraFiltroRelatorio=z.infer<typeof regraFiltroSchema>;
export class ErroFiltroRelatorio extends Error{constructor(mensagem:string,public status:403|422=422){super(mensagem)}}
export function camposFiltroRelatorio(fonte:string,podeVerValores:boolean):CampoFiltroRelatorio[]{
 if(!Object.hasOwn(catalogo,fonte))throw new ErroFiltroRelatorio('Fonte de relatório desconhecida.');
 return (catalogo[fonte as keyof typeof catalogo] as CampoFiltroRelatorio[]).filter(c=>podeVerValores||!c.monetario);
}
export function validarFiltrosRelatorio(fonte:string,filtros:unknown,podeVerValores:boolean):RegraFiltroRelatorio[]{
 const todos=camposFiltroRelatorio(fonte,true),entrada=filtrosRelatorioSchema.safeParse(filtros??[]);
 if(!entrada.success)throw new ErroFiltroRelatorio('Filtros inválidos: informe no máximo vinte critérios válidos.');
 for(const r of entrada.data){
  const campo=todos.find(c=>c.id===r.campo);
  if(!campo)throw new ErroFiltroRelatorio('Campo de filtro desconhecido para esta fonte.');
  if(campo.monetario&&!podeVerValores)throw new ErroFiltroRelatorio('Sem permissão para filtrar valores monetários.',403);
  const permitidos=campo.tipo==='texto'?['igual','diferente','contem','umDe','informado','naoInformado']:campo.tipo==='booleano'?['igual','diferente','informado','naoInformado']:['igual','diferente','entre','maiorIgual','menorIgual','umDe','informado','naoInformado'];
  if(!permitidos.includes(r.operador))throw new ErroFiltroRelatorio('Operador incompatível com o campo.');
  const valido=(v:unknown)=>campo.tipo==='numero'?(typeof v==='number'&&Number.isFinite(v)||campo.monetario&&typeof v==='string'&&/^-?\d+(\.\d+)?$/.test(v)):campo.tipo==='booleano'?typeof v==='boolean':campo.tipo==='data'?z.string().date().safeParse(v).success:typeof v==='string';
  if(r.operador==='informado'||r.operador==='naoInformado'){
   if(r.valor!==undefined||r.ate!==undefined||r.valores!==undefined)throw new ErroFiltroRelatorio('O critério de informação não aceita valores.');
  }else if(r.operador==='umDe'){
   if(r.valor!==undefined||r.ate!==undefined||!r.valores?.every(valido))throw new ErroFiltroRelatorio('Informe os valores do critério.');
  }else{
   if(!valido(r.valor)||r.valores!==undefined||(r.operador==='entre'?!valido(r.ate):r.ate!==undefined))throw new ErroFiltroRelatorio('Valor incompatível com o campo.');
   if(r.operador==='entre'&&(campo.monetario&&campo.tipo==='numero'?new Prisma.Decimal(r.valor as number|string).gt(r.ate as number|string):r.valor!>r.ate!))throw new ErroFiltroRelatorio('O início do intervalo deve ser anterior ou igual ao fim.');
  }
 }
 return entrada.data;
}
const texto=(v:unknown)=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
// Instantes seguem o dia mostrado na interface; datas civis permanecem preservadas.
const camposInstante=new Set(['registradoEm','publicadaEm','registradaEm','confirmadoEm','estornadoEm','estornadaEm','desfeitoEm','realizacao','dispensa','aplicadaEm']);
/** Null/ausência nunca satisfaz comparação, inclusive diferente. Zero e falso são informação. */
export function linhaAtendeFiltros(linha:LinhaRelatorio,filtros:RegraFiltroRelatorio[],campos:CampoFiltroRelatorio[]):boolean{
 return filtros.every(r=>{
  const bruto=linha[r.campo],informado=bruto!==null&&bruto!==undefined;
  if(r.operador==='informado')return informado;
  if(r.operador==='naoInformado')return !informado;
  if(!informado)return false;
  const campo=campos.find(c=>c.id===r.campo)!;
  const tipo=campo.tipo;
  if(campo.monetario&&tipo==='numero'){
   if((typeof bruto!=='string'&&typeof bruto!=='number')||String(bruto).trim()==='')return false;
   let decimal:Prisma.Decimal;
   try{decimal=new Prisma.Decimal(bruto);}catch{return false;}
   if(!decimal.isFinite())return false;
   const comparar=(valor:unknown)=>decimal.comparedTo(valor as number|string);
   switch(r.operador){
    case 'igual':return comparar(r.valor)===0;
    case 'diferente':return comparar(r.valor)!==0;
    case 'umDe':return r.valores!.some(v=>comparar(v)===0);
    case 'maiorIgual':return comparar(r.valor)>=0;
    case 'menorIgual':return comparar(r.valor)<=0;
    case 'entre':return comparar(r.valor)>=0&&comparar(r.ate)<=0;
    default:return false;
   }
  }
  const v=tipo==='texto'?texto(bruto):tipo==='numero'?(typeof bruto==='number'?bruto:typeof bruto==='string'&&bruto.trim()!==''?Number(bruto):NaN):tipo==='data'&&typeof bruto==='string'?(bruto.length>10&&(camposInstante.has(r.campo)||r.campo==='previsao'&&linha.precisao==='HORA')&&Number.isFinite(Date.parse(bruto))?diaIatf(new Date(bruto),'HORA'):bruto.slice(0,10)):bruto;
  if(tipo==='numero'&&(typeof v!=='number'||!Number.isFinite(v)))return false;
  const comparar=(b:unknown)=>tipo==='texto'?texto(b):b;
  const a=comparar(r.valor) as string|number|boolean;
  switch(r.operador){
   case 'igual':return v===a;
   case 'diferente':return v!==a;
   case 'contem':return String(v).includes(String(a));
   case 'umDe':return r.valores!.some(b=>v===comparar(b));
   case 'maiorIgual':return v>=a;
   case 'menorIgual':return v<=a;
   case 'entre':return v>=a&&v<=(comparar(r.ate) as string|number|boolean);
  }
 });
}
