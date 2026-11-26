import { expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { referenciaGuiadaValidaTx } from "./acompanhamento.js";

it("confere a referência factual sem depender da data manual ou de demanda para DG", async () => {
 const tentativa={id:"t",animalId:"a",status:"VALIDO",tipo:"IA",tarefaId:"origem",data:new Date("2026-01-01Z"),propriedadeId:7,tarefa:{execucaoId:"p"},participacoesExplicitas:[]};
 const tx={tentativaReprodutiva:{findFirst:vi.fn().mockResolvedValue(tentativa)},partoAnimal:{findFirst:vi.fn().mockResolvedValue(null)}};
 const verifica=()=>referenciaGuiadaValidaTx(tx as unknown as Prisma.TransactionClient,"task","a","p",7,false);
 expect(await verifica()).toBeTruthy();
 tx.tentativaReprodutiva.findFirst.mockResolvedValue(null); expect(await verifica()).toBe(false);
 tx.tentativaReprodutiva.findFirst.mockResolvedValue(tentativa); expect(await verifica()).toBeTruthy();
 tx.partoAnimal.findFirst.mockResolvedValue({id:"parto"}); expect(await verifica()).toBe(false);
});

it("reconfirmação exige demanda e primeiro positivo válido da gestação ligada", async () => {
 const data=new Date("2026-02-01Z");
 const origem={id:"e",animalId:"a",data,status:"VALIDO",realizacao:"REALIZADO",interpretacao:{gestacaoId:"g"},resultados:[{valor:"POSITIVO"}]};
 const demanda={finalidade:"RECONFIRMACAO",ocorrencia:1,estado:"PENDENTE",previstaPara:data,decisaoOperacional:null,gestacao:{tentativaId:"t",status:"VALIDO",encerradaEm:null},gestacaoId:"g",exameOrigemId:"e",exameOrigem:origem,animalId:"a",dataReferencia:data,origemAdocao:"MODELO",regraSnapshot:{}};
 const tx={tentativaReprodutiva:{findFirst:vi.fn().mockResolvedValue({id:"t",propriedadeId:7,data,tarefa:{execucaoId:"p"},participacoesExplicitas:[]})},partoAnimal:{findFirst:vi.fn().mockResolvedValue(null)},demandaAcompanhamentoReprodutivo:{findUnique:vi.fn().mockResolvedValue(demanda)},exameAnimal:{findFirst:vi.fn().mockResolvedValue({id:"e"})}};
 const verifica=()=>referenciaGuiadaValidaTx(tx as unknown as Prisma.TransactionClient,"task","a","p",7,true);
 expect(await verifica()).toBeTruthy();
 tx.demandaAcompanhamentoReprodutivo.findUnique.mockResolvedValue(null); expect(await verifica()).toBe(false);
 tx.demandaAcompanhamentoReprodutivo.findUnique.mockResolvedValue(demanda); expect(await verifica()).toBeTruthy();
 origem.resultados[0].valor="NEGATIVO"; expect(await verifica()).toBe(false);
 origem.resultados[0].valor="POSITIVO"; tx.exameAnimal.findFirst.mockResolvedValue({id:"anterior"}); expect(await verifica()).toBe(false);
});

it("preserva agendamento manual de DG ao perder e recuperar sua tentativa", async () => {
 const { reconciliarPrevisoesDiagnosticoTx } = await import("./acompanhamento.js");
 const data = new Date("2026-01-01Z");
 const tentativa = {id:"t",animalId:"a",status:"VALIDO",tipo:"IA",tarefaId:"origem",data,propriedadeId:7,tarefa:{execucaoId:"p"},participacoesExplicitas:[]};
 const tarefa = {id:"task",execucaoId:"p",etapa:{configuracao:{referenciaPrazoDiagnostico:true,planoAvaliacao:{tipo:"DIAGNOSTICO"}}},execucao:{id:"p",propriedadeId:7,inicio:data,precisaoTemporal:"DIA"},demandaAcompanhamento:null,eventos:[{id:"adiamento"}],historicoReprogramacao:[],previsaoPendente:false,previsaoOriginal:data,previstaPara:new Date("2026-02-01Z"),parametros:{}};
 const tx={tarefaProtocolo:{findMany:vi.fn().mockResolvedValue([tarefa]),update:vi.fn()},tentativaReprodutiva:{findFirst:vi.fn().mockResolvedValue(null)},partoAnimal:{findFirst:vi.fn().mockResolvedValue(null)},demandaAcompanhamentoReprodutivo:{findMany:vi.fn().mockResolvedValue([]),update:vi.fn()},auditoriaPecuaria:{create:vi.fn()}};
 await reconciliarPrevisoesDiagnosticoTx(tx as unknown as Prisma.TransactionClient,"a",7);
 tx.tentativaReprodutiva.findFirst.mockResolvedValue(tentativa);
 await reconciliarPrevisoesDiagnosticoTx(tx as unknown as Prisma.TransactionClient,"a",7);
 expect(tx.tarefaProtocolo.update).not.toHaveBeenCalled();
 expect(tarefa.previstaPara).toEqual(new Date("2026-02-01Z"));
});
