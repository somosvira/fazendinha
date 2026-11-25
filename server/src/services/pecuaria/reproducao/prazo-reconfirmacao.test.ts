import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { reconciliarPrevisoesReconfirmacaoTx } from "./acompanhamento.js";

const dia = (s: string) => new Date(`${s}T00:00:00Z`);
function fixture(resultado: string, participacao = "p") {
 const origem = { id:"exame", animalId:"a", data:dia("2026-02-01"), status:"VALIDO", realizacao:"REALIZADO", interpretacao:{gestacaoId:"g"}, resultados:[{valor:resultado}] };
 const gestacao={id:"g",tentativaId:"t",status:"VALIDO",encerradaEm:null};
 const demanda={id:"d",participacaoAcompanhamentoId:"p",animalId:"a",gestacaoId:"g",finalidade:"RECONFIRMACAO",ocorrencia:1,exameOrigemId:"exame",exameOrigem:origem,dataReferencia:origem.data,origemAdocao:"MODELO",previstaPara:dia("2026-02-21"),estado:"PENDENTE",gestacao,tarefaId:null,regraSnapshot:{},decisaoOperacional:null};
 const tarefa={id:"task",execucaoId:"p",execucao:{propriedadeId:7,acompanhamentoSnapshot:{versao:1,protocoloId:"modelo",protocoloVersao:1,diagnosticoIndividualEm:null,sitio:null,modelo:{versao:2,efeito:"ALERTA",regras:[{finalidade:"RECONFIRMACAO",ocorrencia:1,publico:"GESTACAO",referencia:"PRIMEIRO_DG_POSITIVO",intervalo:20,unidade:"DIAS",antecedencia:0,tolerancia:0,resolucao:"RECONFIRMACAO_CONCLUSIVA"}]}},inicio:dia("2026-01-01"),precisaoTemporal:"DIA"},demandaAcompanhamento:null,previsaoPendente:true,previsaoOriginal:null,previstaPara:dia("2026-01-01"),parametros:{},historicoReprogramacao:[],eventos:[]};
 const tx={tarefaProtocolo:{findMany:vi.fn().mockResolvedValue([tarefa]),update:vi.fn(async ({data})=>({...tarefa,...data}))},tentativaReprodutiva:{findFirst:vi.fn().mockResolvedValue({id:"t",data:dia("2026-01-10"),propriedadeId:7,tarefa:{execucaoId:participacao},participacoesExplicitas:[]})},partoAnimal:{findFirst:vi.fn().mockResolvedValue(null)},demandaAcompanhamentoReprodutivo:{findMany:vi.fn().mockResolvedValue([demanda]),update:vi.fn(async ({data})=>({...demanda,...data}))},auditoriaPecuaria:{create:vi.fn(async ({data})=>data)}};
 return {tx,tarefa,demanda};
}
describe("tarefa de reconfirmação por primeiro DG positivo",()=>{
 it("vincula a demanda congelada e usa o prazo do DG separado",async()=>{
  const f=fixture("POSITIVO"); await reconciliarPrevisoesReconfirmacaoTx(f.tx as unknown as Prisma.TransactionClient,"a",3);
  expect(f.tx.demandaAcompanhamentoReprodutivo.update).toHaveBeenCalledWith(expect.objectContaining({where:{id:"d"},data:expect.objectContaining({tarefaId:"task"})}));
  expect(f.tx.tarefaProtocolo.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({previstaPara:dia("2026-02-21"),previsaoPendente:false})}));
 });
 it.each(["NEGATIVO","INCONCLUSIVO"])("não atribui data para resultado %s",async resultado=>{
  const f=fixture(resultado); await reconciliarPrevisoesReconfirmacaoTx(f.tx as unknown as Prisma.TransactionClient,"a",3);
  expect(f.tx.demandaAcompanhamentoReprodutivo.update).not.toHaveBeenCalled();
  expect(f.tx.tarefaProtocolo.update.mock.calls.every(([v])=>v.data.previsaoPendente)).toBe(true);
 });
 it("aproveita demanda livre apenas se prazo congelado e origem forem compatíveis",async()=>{
  const f=fixture("POSITIVO"); Object.assign(f.demanda,{participacaoAcompanhamentoId:null});
  await reconciliarPrevisoesReconfirmacaoTx(f.tx as unknown as Prisma.TransactionClient,"a",3);
  expect(f.tx.demandaAcompanhamentoReprodutivo.update).toHaveBeenCalledTimes(1);
  const divergente=fixture("POSITIVO"); Object.assign(divergente.demanda,{participacaoAcompanhamentoId:null,previstaPara:dia("2026-03-01")});
  await reconciliarPrevisoesReconfirmacaoTx(divergente.tx as unknown as Prisma.TransactionClient,"a",3);
  expect(divergente.tx.demandaAcompanhamentoReprodutivo.update).not.toHaveBeenCalled();
 });
 it("recusa vínculo externo quando fato corrigido diverge do snapshot revisto",async()=>{
  const f=fixture("POSITIVO");
  f.tx.tentativaReprodutiva.findFirst.mockResolvedValue({id:"t",animalId:"a",status:"VALIDO",tipo:"COBERTURA",tarefaId:null,data:dia("2026-01-10"),propriedadeId:7,tarefa:null,participacoesExplicitas:[{participacaoId:"p",propriedadeId:7,snapshot:{animalId:"a",propriedadeId:7,data:"2026-01-10",tipo:"IA"}}]});
  await reconciliarPrevisoesReconfirmacaoTx(f.tx as unknown as Prisma.TransactionClient,"a",3);
  expect(f.tx.demandaAcompanhamentoReprodutivo.update).not.toHaveBeenCalled();
 });
 it("não usa tentativa de outra participação",async()=>{
  const f=fixture("POSITIVO","outra"); await reconciliarPrevisoesReconfirmacaoTx(f.tx as unknown as Prisma.TransactionClient,"a",3);
  expect(f.tx.demandaAcompanhamentoReprodutivo.update).not.toHaveBeenCalled();
  expect(f.tx.tarefaProtocolo.update.mock.calls.every(([v])=>v.data.previsaoPendente)).toBe(true);
 });
});
