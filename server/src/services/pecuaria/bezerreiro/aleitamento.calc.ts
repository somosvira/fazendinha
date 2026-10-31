import { Prisma } from "@prisma/client";
import { RebanhoError } from "../rebanho/regras.js";
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
export function distribuirQuantidade(total: Prisma.Decimal.Value, pesos: { id: string; peso: Prisma.Decimal.Value }[], casas = 3) {
  const quantidade = D(total), escala = D(10).pow(casas);
  if (!quantidade.isFinite() || quantidade.lt(0) || quantidade.decimalPlaces() > casas || new Set(pesos.map(p=>p.id)).size !== pesos.length)
    throw new RebanhoError("VALIDACAO", "Confira a quantidade e os participantes da distribuição");
  const bases = pesos.map(p => ({id:p.id,peso:D(p.peso)}));
  if (bases.some(p=>!p.peso.isFinite() || p.peso.lt(0))) throw new RebanhoError("VALIDACAO", "Base de atribuição inválida");
  const soma = bases.reduce((n,p)=>n.plus(p.peso),D(0));
  if (soma.isZero()) { if (quantidade.gt(0)) throw new RebanhoError("VALIDACAO", "Quantidade sem base comprovada de atribuição"); return bases.map(p=>({id:p.id,quantidade:D(0)})); }
  const partes = bases.map(p=>{const exata=quantidade.mul(escala).mul(p.peso).div(soma); return {id:p.id,inteiro:exata.floor(),resto:exata.minus(exata.floor())};});
  let falta = quantidade.mul(escala).minus(partes.reduce((n,p)=>n.plus(p.inteiro),D(0))).toNumber();
  partes.sort((a,b)=>b.resto.cmp(a.resto)||a.id.localeCompare(b.id));
  return partes.map(p=>({id:p.id,quantidade:p.inteiro.plus(falta-->0?1:0).div(escala)}));
}
export function conferirProgramacao(litrosDia: Prisma.Decimal.Value, ofertas: {identidadeId:string;ordem:number;percentual:Prisma.Decimal.Value;horarioPrevisto?:string|null}[], publicada: boolean) {
  const litros=D(litrosDia);
  if(!litros.isFinite()||litros.lt(0)||litros.decimalPlaces()>3)throw new RebanhoError("VALIDACAO","Dose diária inválida");
  if(new Set(ofertas.map(o=>o.identidadeId)).size!==ofertas.length||new Set(ofertas.map(o=>o.ordem)).size!==ofertas.length)throw new RebanhoError("VALIDACAO","Identificação ou ordem de oferta repetida");
  if(ofertas.some(o=>D(o.percentual).lte(0)||D(o.percentual).gt(100)))throw new RebanhoError("VALIDACAO","Percentuais devem ser positivos até 100");
  if(publicada&&((litros.gt(0)&&!ofertas.length)||(ofertas.length&&!ofertas.reduce((n,o)=>n.plus(o.percentual),D(0)).eq(100))))throw new RebanhoError("VALIDACAO","Distribua 100% do total diário entre as ofertas");
}
export function quantidadePorOferta(totalDia: Prisma.Decimal.Value, ofertas: {id:string;percentual:Prisma.Decimal.Value}[]) {
  return distribuirQuantidade(totalDia,ofertas.map(o=>({id:o.id,peso:o.percentual})));
}
