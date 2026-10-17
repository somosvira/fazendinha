import { Prisma } from "@prisma/client";
import { describe,it,expect,vi } from "vitest";
import { conferirAtribuicaoServicoCustoTx } from "./custos.js";
const db=(classes:unknown[]=[],vinculos:unknown[]=[])=>({classificacaoCustoPecuaria:{findMany:vi.fn().mockResolvedValue(classes)},vinculoPreparoTentativa:{findMany:vi.fn().mockResolvedValue(vinculos)}}) as unknown as Prisma.TransactionClient;
describe("alterar Serviço preserva classificação e parcelas preparatórias",()=>{
 it("recusa atribuir Serviço em tentativa classificada não aplicável com erro de domínio",async()=>{
  const tx=db([{tentativaId:"t",servicoNaoAplicavel:true,coberturaServico:"PROCEDIMENTO"}]);
  await expect(conferirAtribuicaoServicoCustoTx(tx,[{id:"t",tipo:"TENTATIVA",operacaoServicoId:"op",valor:"20.00"}])).rejects.toMatchObject({code:"CONFLITO"});
 });
 it("recusa retirar a origem de um pacote identificado",async()=>{
  const tx=db([{tentativaId:"t",servicoNaoAplicavel:false,coberturaServico:"AMBOS"}]);
  await expect(conferirAtribuicaoServicoCustoTx(tx,[{id:"t",tipo:"TENTATIVA",operacaoServicoId:null,valor:null}])).rejects.toMatchObject({code:"CONFLITO"});
 });
 it("reduzir Serviço abaixo das parcelas de preparo não libera capacidade já atribuída",async()=>{
  const tx=db([],[{aplicacaoId:"a",valorServico:new Prisma.Decimal(20)}]);
  await expect(conferirAtribuicaoServicoCustoTx(tx,[{id:"a",tipo:"APLICACAO",operacaoServicoId:"op",valor:"19.99"}])).rejects.toMatchObject({code:"CONFLITO"});
  await expect(conferirAtribuicaoServicoCustoTx(tx,[{id:"a",tipo:"APLICACAO",operacaoServicoId:"op",valor:"20.00"}])).resolves.toBeUndefined();
 });
});
