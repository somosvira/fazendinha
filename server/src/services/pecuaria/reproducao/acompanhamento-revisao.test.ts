import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({tx:{politicaAcompanhamentoReprodutivo:{findFirst:vi.fn()},demandaAcompanhamentoReprodutivo:{findMany:vi.fn(),updateMany:vi.fn()},revisaoPrazoAcompanhamento:{create:vi.fn()}},auditar:vi.fn(),travar:vi.fn()}));
vi.mock("../../../db.js",()=>({prisma:{$transaction:async (f:(t:typeof mocks.tx)=>Promise<unknown>)=>f(mocks.tx)}}));
vi.mock("../transacao.js",()=>({transacaoPecuaria:async (f:(t:typeof mocks.tx)=>Promise<unknown>)=>f(mocks.tx)}));
vi.mock("../rebanho/regras.js",async original=>({...await original<typeof import("../rebanho/regras.js")>(),auditar:mocks.auditar,travarAnimais:mocks.travar}));
vi.mock("./operacoes.js",()=>({hashDados:(v:unknown)=>JSON.stringify(v),operacaoIdempotenteTx:async (_t:unknown,_i:unknown,_u:unknown,_a:unknown,f:()=>Promise<unknown>)=>f()}));
import { previaRevisaoPrazos,revisarPrazos } from "./acompanhamento.js";
const dia=(s:string)=>new Date(`${s}T00:00:00Z`);
const regra={finalidade:"DIAGNOSTICO",ocorrencia:1,publico:"TE",referencia:"TE",intervalo:20,unidade:"DIAS",antecedencia:2,tolerancia:1,resolucao:"DIAGNOSTICO_CONCLUSIVO"};
const entrada={propriedadeId:7,politicaId:"nova",demandaIds:["demanda"]};
const demanda=()=>({id:"demanda",animalId:"animal",versao:1,politicaId:"antiga",previstaPara:dia("2026-01-10"),dataReferencia:dia("2026-01-01"),regraSnapshot:{versao:1},estado:"PENDENTE",tarefaId:null,origemAdocao:"FATO_NOVO",tentativaId:"tentativa",tentativa:{tipo:"TE",status:"VALIDO"},gestacaoId:null,gestacao:null,finalidade:"DIAGNOSTICO",ocorrencia:1});
beforeEach(()=>{vi.resetAllMocks();mocks.tx.politicaAcompanhamentoReprodutivo.findFirst.mockResolvedValue({id:"nova",versao:2,parametros:{versao:2,efeito:"ALERTA",regras:[regra]}});mocks.tx.demandaAcompanhamentoReprodutivo.findMany.mockResolvedValue([demanda()]);mocks.tx.demandaAcompanhamentoReprodutivo.updateMany.mockResolvedValue({count:1});});
describe("revisão explícita de prazos",()=>{
 it("mostra antes e depois e grava histórico, prazo e auditoria na mesma operação",async()=>{
  const previa=await previaRevisaoPrazos(entrada);
  expect(previa.propostas[0]).toMatchObject({previstaAnterior:"2026-01-10",proposta:{previstaPara:"2026-01-21"},impedimento:null});
  await revisarPrazos({...entrada,chave:"chave",motivo:"Revisão confirmada",revisao:previa.revisao},1);
  expect(mocks.tx.revisaoPrazoAcompanhamento.create).toHaveBeenCalledWith({data:expect.objectContaining({demandaId:"demanda",versaoAnterior:1,politicaAnteriorId:"antiga",politicaNovaId:"nova"})});
  expect(mocks.tx.demandaAcompanhamentoReprodutivo.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({versao:1,tarefaId:null}),data:expect.objectContaining({previstaPara:dia("2026-01-21")})}));
  expect(mocks.auditar).toHaveBeenCalledOnce();
 });
 it("não altera agendamento individual, fatos concluídos ou regra inexistente",async()=>{
  mocks.tx.demandaAcompanhamentoReprodutivo.findMany.mockResolvedValue([{...demanda(),tarefaId:"tarefa"}]);
  const previa=await previaRevisaoPrazos(entrada);
  expect(previa.propostas[0].impedimento).toBe("AGENDAMENTO_INDIVIDUAL_PRESERVADO");
  await expect(revisarPrazos({...entrada,chave:"chave",motivo:"Revisão confirmada",revisao:previa.revisao},1)).rejects.toThrow();
  expect(mocks.tx.revisaoPrazoAcompanhamento.create).not.toHaveBeenCalled();
 });
 it("rejeita prévia obsoleta antes de escrever",async()=>{
  const previa=await previaRevisaoPrazos(entrada);
  mocks.tx.demandaAcompanhamentoReprodutivo.findMany.mockResolvedValue([{...demanda(),versao:2}]);
  await expect(revisarPrazos({...entrada,chave:"chave",motivo:"Revisão confirmada",revisao:previa.revisao},1)).rejects.toMatchObject({code:"CONFLITO"});
  expect(mocks.tx.revisaoPrazoAcompanhamento.create).not.toHaveBeenCalled();
 });
});
