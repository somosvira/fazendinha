import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { consultarColetasPartoTx } from "./colostro.js";
const data=new Date('2026-11-01');
const D=(v:number)=>new Prisma.Decimal(v);
describe('coletas na página do parto',()=>{
 it('restringe a consulta ao parto/sítio e mantém rascunho sem inventar qualidade ou destino',async()=>{
  const findMany=vi.fn().mockResolvedValue([{id:'retirada',data,ocorridoEm:null,horarioEstimado:false,quantidadeLitros:D(4),status:'RASCUNHO',primeiraRetirada:true,origem:null}]);
  const tx={loteColostro:{findMany}} as unknown as Prisma.TransactionClient;
  const itens=await consultarColetasPartoTx(tx,'parto',3);
  expect(findMany).toHaveBeenCalledWith(expect.objectContaining({where:{partoId:'parto',propriedadeId:3,status:{not:'ESTORNADO'}}}));
  expect(itens[0]).toMatchObject({quantidadeLitros:'4',status:'RASCUNHO',brix:null,destinos:[]});
 });
 it('distingue banco de consumo posterior e não expõe os valores da origem',async()=>{
  const findMany=vi.fn().mockResolvedValue([{id:'retirada',data,ocorridoEm:null,horarioEstimado:false,quantidadeLitros:D(4),status:'CONFIRMADO',primeiraRetirada:true,
   origem:{id:'origem',propriedadeId:3,valorTotal:D(100),amostras:[],preparos:[],
    unidades:[{id:'u',propriedadeId:3,status:'CONGELADA',codigo:'BC1',volumeLitros:D(4),dataCongelamento:data}],
    fornecimentos:[{id:'f',unidadeId:'u',quantidadeLitros:D(2),fornecimento:{propriedadeId:3,status:'VALIDO',data}}]}}]);
  const itens=await consultarColetasPartoTx({loteColostro:{findMany}} as unknown as Prisma.TransactionClient,'parto',3);
  expect(itens[0].destinos).toEqual([expect.objectContaining({tipo:'BANCO',quantidadeLitros:'4',viaBanco:false}),expect.objectContaining({tipo:'FORNECIMENTO',quantidadeLitros:'2',viaBanco:true})]);
  expect(JSON.stringify(itens)).not.toMatch(/valorTotal|100/);
 });
});
