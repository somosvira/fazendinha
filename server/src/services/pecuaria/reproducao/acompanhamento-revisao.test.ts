import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({tx:{politicaAcompanhamentoReprodutivo:{findFirst:vi.fn()},demandaAcompanhamentoReprodutivo:{findMany:vi.fn(),updateMany:vi.fn(),update:vi.fn()},revisaoPrazoAcompanhamento:{create:vi.fn()},tarefaProtocolo:{updateMany:vi.fn()},participanteVisita:{findFirst:vi.fn()},exameAnimal:{findMany:vi.fn()},partoAnimal:{findMany:vi.fn()},tentativaReprodutiva:{findMany:vi.fn()}},alertas:vi.fn(),auditar:vi.fn(),travar:vi.fn()}));
vi.mock("../../../db.js",()=>({prisma:{$transaction:async (f:(t:typeof mocks.tx)=>Promise<unknown>)=>f(mocks.tx)}}));
vi.mock("../transacao.js",()=>({transacaoPecuaria:async (f:(t:typeof mocks.tx)=>Promise<unknown>)=>f(mocks.tx)}));
vi.mock("../rebanho/regras.js",async original=>({...await original<typeof import("../rebanho/regras.js")>(),auditar:mocks.auditar,travarAnimais:mocks.travar}));
vi.mock("./alertas/produtor.js",()=>({reconciliarAlertasReprodutivosAnimalTx:mocks.alertas}));
vi.mock("./operacoes.js",()=>({hashDados:(v:unknown)=>JSON.stringify(v),operacaoIdempotenteTx:async (_t:unknown,_i:unknown,_u:unknown,_a:unknown,f:()=>Promise<unknown>)=>f()}));
import { previaRevisaoPrazos,revisarPrazos } from "./acompanhamento.js";
const dia=(s:string)=>new Date(`${s}T00:00:00Z`);
const regra={finalidade:"DIAGNOSTICO",ocorrencia:1,publico:"TE",referencia:"TE",intervalo:20,unidade:"DIAS",antecedencia:2,tolerancia:1,resolucao:"DIAGNOSTICO_CONCLUSIVO"};
const entrada={propriedadeId:7,politicaId:"nova",demandaIds:["demanda"]};
const demanda=()=>({id:"demanda",animalId:"animal",versao:1,politicaId:"antiga",previstaPara:dia("2026-01-10"),dataReferencia:dia("2026-01-01"),regraSnapshot:{versao:1},estado:"PENDENTE",tarefaId:null,origemAdocao:"FATO_NOVO",tentativaId:"tentativa",tentativa:{tipo:"TE",status:"VALIDO"},gestacaoId:null,gestacao:null,finalidade:"DIAGNOSTICO",ocorrencia:1});
beforeEach(()=>{vi.resetAllMocks();mocks.tx.participanteVisita.findFirst.mockResolvedValue(null);mocks.tx.politicaAcompanhamentoReprodutivo.findFirst.mockResolvedValue({id:"nova",versao:2,parametros:{versao:2,efeito:"ALERTA",regras:[regra]}});mocks.tx.demandaAcompanhamentoReprodutivo.findMany.mockImplementation(async ({where})=>where.animalId?[]:[demanda()]);mocks.tx.demandaAcompanhamentoReprodutivo.updateMany.mockResolvedValue({count:1});mocks.tx.revisaoPrazoAcompanhamento.create.mockResolvedValue({id:"revisao"});mocks.tx.tarefaProtocolo.updateMany.mockResolvedValue({count:1});});
describe("revisão explícita de prazos",()=>{
 it("mostra antes e depois e grava histórico, prazo e auditoria na mesma operação",async()=>{
  const previa=await previaRevisaoPrazos(entrada);
  expect(previa.propostas[0]).toMatchObject({previstaAnterior:"2026-01-10",proposta:{previstaPara:"2026-01-21"},impedimento:null});
  await revisarPrazos({...entrada,chave:"chave",motivo:"Revisão confirmada",revisao:previa.revisao},1);
  expect(mocks.tx.revisaoPrazoAcompanhamento.create).toHaveBeenCalledWith({data:expect.objectContaining({demandaId:"demanda",versaoAnterior:1,politicaAnteriorId:"antiga",politicaNovaId:"nova"})});
  expect(mocks.tx.demandaAcompanhamentoReprodutivo.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({versao:1,tarefaId:null}),data:expect.objectContaining({previstaPara:dia("2026-01-21")})}));
  expect(mocks.auditar).toHaveBeenCalledOnce();
  expect(mocks.alertas).toHaveBeenCalledOnce();
  expect(mocks.alertas).toHaveBeenCalledWith(mocks.tx,"animal",1);
 });
 it("não altera agendamento individual, fatos concluídos ou regra inexistente",async()=>{
  mocks.tx.demandaAcompanhamentoReprodutivo.findMany.mockResolvedValue([{...demanda(),tarefaId:"tarefa"}]);
  const previa=await previaRevisaoPrazos(entrada);
  expect(previa.propostas[0].impedimento).toBe("AGENDAMENTO_INDIVIDUAL_PRESERVADO");
  await expect(revisarPrazos({...entrada,chave:"chave",motivo:"Revisão confirmada",revisao:previa.revisao},1)).rejects.toThrow();
  expect(mocks.tx.revisaoPrazoAcompanhamento.create).not.toHaveBeenCalled();
 });
 it("revisa tarefa cujo prazo herdado é comprovado, com histórico atômico",async()=>{
  const tarefa={id:"tarefa",previstaPara:dia("2026-01-10"),previsaoOriginal:dia("2026-01-10"),precisaoTemporal:"DIA",previsaoPendente:false,realizadaEm:null,dispensadaEm:null,regularizacaoPendente:false,parametros:{previsaoOriginal:"2026-01-10"},historicoReprogramacao:[],eventos:[],_count:{aplicacoes:0,exames:0,tentativas:0,manejos:0,vinculos:0},execucao:{canceladaEm:null,rodada:{status:"ABERTA"}}};
  mocks.tx.demandaAcompanhamentoReprodutivo.findMany.mockImplementation(async ({where})=>where.animalId?[]:[{...demanda(),tarefaId:"tarefa",tarefa}]);
  const previa=await previaRevisaoPrazos(entrada);
  expect(previa.propostas[0]).toMatchObject({impedimento:null,tarefaHerdada:{id:"tarefa"}});
  await revisarPrazos({...entrada,chave:"chave",motivo:"Adoção conferida",revisao:previa.revisao},1);
  expect(mocks.tx.revisaoPrazoAcompanhamento.create).toHaveBeenCalledWith({data:expect.objectContaining({tarefaId:"tarefa",tarefaPrevistaAnterior:dia("2026-01-10"),tarefaPrevistaNova:dia("2026-01-21")})});
  expect(mocks.tx.tarefaProtocolo.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({previstaPara:dia("2026-01-21"),historicoReprogramacao:[expect.objectContaining({acao:"REVISAO_REGRA_ACOMPANHAMENTO",revisaoId:"revisao"})]})}));
  mocks.tx.demandaAcompanhamentoReprodutivo.findMany.mockResolvedValue([{...demanda(),tarefaId:"tarefa",tarefa:{...tarefa,eventos:[{id:"adiamento"}]}}]);
  expect((await previaRevisaoPrazos(entrada)).propostas[0].impedimento).toBe("AGENDAMENTO_INDIVIDUAL_PRESERVADO");
 });
 it("preserva visita aberta vinculada mesmo sem tarefa",async()=>{
  mocks.tx.participanteVisita.findFirst.mockResolvedValue({id:"visita"});
  const previa=await previaRevisaoPrazos(entrada);
  expect(previa.propostas[0]).toMatchObject({impedimento:"AGENDAMENTO_VISITA_PRESERVADO",visitaAgendadaId:"visita"});
  await expect(revisarPrazos({...entrada,chave:"chave",motivo:"Revisão confirmada",revisao:previa.revisao},1)).rejects.toThrow();
  expect(mocks.tx.revisaoPrazoAcompanhamento.create).not.toHaveBeenCalled();
 });
 it("adota regra em necessidade sem prazo preservando a evidência anterior",async()=>{
  mocks.tx.demandaAcompanhamentoReprodutivo.findMany.mockImplementation(async ({where})=>where.animalId?[]:[{...demanda(),politicaId:null,previstaPara:null,origemAdocao:"SEM_REGRA",regraSnapshot:{motivo:"REGRA_NAO_CONFIGURADA"}}]);
  const previa=await previaRevisaoPrazos(entrada);
  expect(previa.propostas[0]).toMatchObject({previstaAnterior:null,impedimento:null});
  await revisarPrazos({...entrada,chave:"chave",motivo:"Configuração adotada",revisao:previa.revisao},1);
  expect(mocks.tx.revisaoPrazoAcompanhamento.create).toHaveBeenCalledWith({data:expect.objectContaining({politicaAnteriorId:null,previstaAnterior:null})});
  expect(mocks.tx.demandaAcompanhamentoReprodutivo.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({origemAdocao:"ADOCAO_EXPLICITA"})}));
 });
 it("preserva data individual anterior à tentativa para revisão consciente",async()=>{
  mocks.tx.demandaAcompanhamentoReprodutivo.findMany.mockResolvedValue([{...demanda(),politicaId:null,previstaPara:null,origemAdocao:"SEM_REGRA",regraSnapshot:{motivo:"AGENDAMENTO_ANTERIOR_A_TENTATIVA"}}]);
  expect((await previaRevisaoPrazos(entrada)).propostas[0].impedimento).toBe("AGENDAMENTO_INDIVIDUAL_PRESERVADO");
 });
 it("publica o novo prazo na mesma transação sem selecionar conclusão clínica",async()=>{
  const estado={...demanda()};
  mocks.tx.demandaAcompanhamentoReprodutivo.findMany.mockResolvedValue([estado]);
  mocks.tx.demandaAcompanhamentoReprodutivo.updateMany.mockImplementation(async ({data})=>{estado.previstaPara=data.previstaPara;return {count:1};});
  mocks.alertas.mockImplementation(async(tx,animal,usuario)=>{expect(tx).toBe(mocks.tx);expect(animal).toBe("animal");expect(usuario).toBe(1);expect(estado).toMatchObject({previstaPara:dia("2026-01-21"),estado:"PENDENTE"});});
  const previa=await previaRevisaoPrazos(entrada);
  await revisarPrazos({...entrada,chave:"chave",motivo:"Revisão confirmada",revisao:previa.revisao},1);
  expect(mocks.alertas).toHaveBeenCalledOnce();
  expect(mocks.tx.exameAnimal.findMany).not.toHaveBeenCalled();
  expect(mocks.tx.demandaAcompanhamentoReprodutivo.update).not.toHaveBeenCalled();
 });
 it("publica uma vez por animal após atualizar todas as demandas",async()=>{
  const dados=[demanda(),{...demanda(),id:"segunda",tentativaId:"outra"}];
  mocks.tx.demandaAcompanhamentoReprodutivo.findMany.mockResolvedValue(dados);
  mocks.alertas.mockImplementation(async()=>expect(mocks.tx.demandaAcompanhamentoReprodutivo.updateMany).toHaveBeenCalledTimes(2));
  const selecao={...entrada,demandaIds:["demanda","segunda"]};
  const previa=await previaRevisaoPrazos(selecao);
  await revisarPrazos({...selecao,chave:"chave",motivo:"Revisão confirmada",revisao:previa.revisao},1);
  expect(mocks.alertas).toHaveBeenCalledOnce();
 });
 it("propaga falha da projeção para impedir confirmação parcial",async()=>{
  const previa=await previaRevisaoPrazos(entrada);
  mocks.alertas.mockRejectedValue(new Error("falha da projeção"));
  await expect(revisarPrazos({...entrada,chave:"chave",motivo:"Revisão confirmada",revisao:previa.revisao},1)).rejects.toThrow("falha da projeção");
 });
 it("rejeita prévia obsoleta antes de escrever",async()=>{
  const previa=await previaRevisaoPrazos(entrada);
  mocks.tx.demandaAcompanhamentoReprodutivo.findMany.mockResolvedValue([{...demanda(),versao:2}]);
  await expect(revisarPrazos({...entrada,chave:"chave",motivo:"Revisão confirmada",revisao:previa.revisao},1)).rejects.toMatchObject({code:"CONFLITO"});
  expect(mocks.tx.revisaoPrazoAcompanhamento.create).not.toHaveBeenCalled();
 });
});
it("revisão de regra preserva o ponteiro da decisão operacional existente", async () => {
 mocks.tx.demandaAcompanhamentoReprodutivo.findMany.mockResolvedValue([{ ...demanda(), decisaoOperacionalId: "agendamento", decisaoOperacional: { id: "agendamento", tipo: "REAGENDAR", data: dia("2026-03-01"), destino: "Visita", motivo: "Agendamento explícito" } }]);
 const previa = await previaRevisaoPrazos(entrada);
 expect(previa.propostas[0].impedimento).toBeNull();
 await revisarPrazos({ ...entrada, chave: "chave", motivo: "Revisão sem apagar agenda", revisao: previa.revisao }, 1);
 const alteracao = mocks.tx.demandaAcompanhamentoReprodutivo.updateMany.mock.calls[0][0];
 expect(alteracao.data).not.toHaveProperty("decisaoOperacionalId");
 expect(alteracao.data.previstaPara).toEqual(dia("2026-01-21"));
});
it("dispensa administrativa não é pendência elegível à revisão de regra", async () => {
 mocks.tx.demandaAcompanhamentoReprodutivo.findMany.mockResolvedValue([{ ...demanda(), decisaoOperacionalId: "dispensa", decisaoOperacional: { id: "dispensa", tipo: "DISPENSAR", data: null, destino: null, motivo: "Dispensa explícita" } }]);
 const previa = await previaRevisaoPrazos(entrada);
 expect(previa.propostas[0].impedimento).toBe("DEMANDA_NAO_PENDENTE");
 await expect(revisarPrazos({ ...entrada, chave: "chave", motivo: "Revisão indevida", revisao: previa.revisao }, 1)).rejects.toMatchObject({ code: "VALIDACAO" });
 expect(mocks.tx.demandaAcompanhamentoReprodutivo.updateMany).not.toHaveBeenCalled();
});
