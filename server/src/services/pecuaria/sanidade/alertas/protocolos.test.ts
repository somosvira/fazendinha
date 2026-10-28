import { beforeEach,describe,expect,it,vi } from "vitest";
import type { Prisma } from "@prisma/client";
const m=vi.hoisted(()=>({publicar:vi.fn(),auditar:vi.fn(),obter:vi.fn(),tx:{necessidadeSanitaria:{findMany:vi.fn(),update:vi.fn()},participacaoProtocolo:{findUnique:vi.fn()},tarefaProtocolo:{findUnique:vi.fn()},vinculoTarefaProtocolo:{findMany:vi.fn()}}}));
vi.mock("./produtor.js",()=>({publicarNecessidadeTx:m.publicar}));
vi.mock("./atendimento.js",()=>({conferirDestinoAtivoTx:vi.fn(),exigirAutorDecisao:vi.fn(),obterNecessidadeAtendimentoTx:m.obter}));
vi.mock("../../rebanho/regras.js",async original=>({...await original<typeof import("../../rebanho/regras.js")>(),auditar:m.auditar}));
import { vincularParticipacaoAlertaTx,reconciliarParticipacaoAlertaTx,reconciliarExameProtocoladoTx } from "./protocolos.js";
const n={id:"necessidade",animalId:"animal",propriedadeId:1,situacao:"PENDENTE",participacaoId:"participacao",alerta:{ciclo:"ABERTO"},regra:{protocoloId:"protocolo"}};
const tx=()=>m.tx as unknown as Prisma.TransactionClient;
beforeEach(()=>{vi.clearAllMocks();m.obter.mockResolvedValue({...n,participacaoId:null});m.tx.necessidadeSanitaria.findMany.mockResolvedValue([n]);m.tx.participacaoProtocolo.findUnique.mockResolvedValue({id:"participacao",animalId:"animal",propriedadeId:1,protocoloId:"protocolo",canceladaEm:null,tarefas:[]});});
describe("atendimento protocolar da necessidade",()=>{
 it("programar vincula participação existente sem declarar realizado",async()=>{await vincularParticipacaoAlertaTx(tx(),{alertaId:"alerta",alertaRevisao:1,confirmarCuidadoAlerta:true},{id:"participacao",animalId:"animal",propriedadeId:1,protocoloId:"protocolo"},7);expect(m.tx.necessidadeSanitaria.update).toHaveBeenCalledWith({where:{id:n.id},data:expect.objectContaining({participacaoId:"participacao",situacao:"PROGRAMADO"})});expect(m.publicar).toHaveBeenCalledWith(m.tx,n.id,{usuarioId:7},"PUBLICAR");});
 it("cancelamento nunca comprova realização e põe o mesmo alerta em revisão",async()=>{m.tx.participacaoProtocolo.findUnique.mockResolvedValue({id:"participacao",canceladaEm:new Date(),tarefas:[]});await reconciliarParticipacaoAlertaTx(tx(),"participacao",7);expect(m.tx.necessidadeSanitaria.update).toHaveBeenCalledWith({where:{id:n.id},data:expect.objectContaining({situacao:"NECESSITA_REVISAO"})});});
 it("somente tarefas realmente realizadas concluem, sem equiparar dispensa",async()=>{m.tx.participacaoProtocolo.findUnique.mockResolvedValue({id:"participacao",canceladaEm:null,tarefas:[{dispensadaEm:new Date(),regularizacaoPendente:false,realizadaEm:null,aplicacoes:[],exames:[],tentativas:[],manejos:[],vinculos:[],historicoRegularizacao:[]}]});await reconciliarParticipacaoAlertaTx(tx(),"participacao",7);expect(m.tx.necessidadeSanitaria.update).toHaveBeenCalledWith({where:{id:n.id},data:expect.objectContaining({situacao:"NECESSITA_REVISAO"})});});
});

it("só encerra após todas as tarefas possuírem fatos válidos",async()=>{
 m.tx.participacaoProtocolo.findUnique.mockResolvedValue({id:"participacao",canceladaEm:null,tarefas:[{dispensadaEm:null,regularizacaoPendente:false,realizadaEm:new Date(),aplicacoes:[{status:"VALIDO"}],exames:[],tentativas:[],manejos:[],vinculos:[],historicoRegularizacao:[]}]});
 await reconciliarParticipacaoAlertaTx(tx(),"participacao",7);
 expect(m.tx.necessidadeSanitaria.update).toHaveBeenCalledWith({where:{id:n.id},data:expect.objectContaining({situacao:"REALIZADO"})});expect(m.publicar).toHaveBeenCalledWith(m.tx,n.id,{usuarioId:7},"ENCERRAR");
});
it("regularização prevalece sobre data de realização preservada",async()=>{
 m.tx.participacaoProtocolo.findUnique.mockResolvedValue({id:"participacao",canceladaEm:null,tarefas:[{dispensadaEm:null,regularizacaoPendente:true,realizadaEm:new Date(),aplicacoes:[{status:"ANULADO"}],exames:[],tentativas:[],manejos:[],vinculos:[],historicoRegularizacao:[]}]});
 await reconciliarParticipacaoAlertaTx(tx(),"participacao",7);
 expect(m.tx.necessidadeSanitaria.update).toHaveBeenCalledWith({where:{id:n.id},data:expect.objectContaining({situacao:"NECESSITA_REVISAO"})});
});

it.each(["direto","vinculo"])("coleta sem resultado via %s não comprova atendimento",async origem=>{
 const exame={status:"VALIDO",realizacao:"COLETA_REGISTRADA"};
 m.tx.participacaoProtocolo.findUnique.mockResolvedValue({id:"participacao",canceladaEm:null,tarefas:[{dispensadaEm:null,regularizacaoPendente:false,previsaoPendente:false,previstaPara:new Date("2099-01-01"),aplicacoes:[],exames:origem==="direto"?[exame]:[],tentativas:[],manejos:[],vinculos:origem==="vinculo"?[{estado:"ATUAL",exame}]:[]}]});
 await reconciliarParticipacaoAlertaTx(tx(),"participacao",7);
 expect(m.tx.necessidadeSanitaria.update).toHaveBeenCalledWith({where:{id:n.id},data:expect.objectContaining({situacao:"PROGRAMADO"})});expect(m.publicar).toHaveBeenCalledWith(m.tx,n.id,{usuarioId:7},"PUBLICAR");
});
it("resultado corrigido reavalia participação por tarefa e vínculo sem duplicar",async()=>{
 m.tx.tarefaProtocolo.findUnique.mockResolvedValue({execucaoId:"participacao"});m.tx.vinculoTarefaProtocolo.findMany.mockResolvedValue([{tarefa:{execucaoId:"participacao"}}]);
 m.tx.participacaoProtocolo.findUnique.mockResolvedValue({id:"participacao",canceladaEm:null,tarefas:[{dispensadaEm:null,regularizacaoPendente:false,aplicacoes:[],exames:[{status:"VALIDO",realizacao:"REALIZADO"}],tentativas:[],manejos:[],vinculos:[]}]});
 await reconciliarExameProtocoladoTx(tx(),"exame","tarefa",7);
 expect(m.tx.participacaoProtocolo.findUnique).toHaveBeenCalledOnce();expect(m.publicar).toHaveBeenCalledWith(m.tx,n.id,{usuarioId:7},"ENCERRAR");
});
it.each([false,true])("preserva revisão de contexto ao reconciliar protocolo com conclusão=%s",async concluido=>{
 m.tx.necessidadeSanitaria.findMany.mockResolvedValue([{...n,situacao:"NECESSITA_REVISAO",motivo:"Animal transferido; conferir o contexto do cuidado no sítio atual"}]);
 m.tx.participacaoProtocolo.findUnique.mockResolvedValue({id:"participacao",canceladaEm:null,tarefas:[{dispensadaEm:null,regularizacaoPendente:false,previsaoPendente:false,previstaPara:new Date("2099-01-01"),aplicacoes:concluido?[{status:"VALIDO"}]:[],exames:[],tentativas:[],manejos:[],vinculos:[]}]});
 await reconciliarParticipacaoAlertaTx(tx(),"participacao",7);
 expect(m.tx.necessidadeSanitaria.update).not.toHaveBeenCalled();expect(m.publicar).not.toHaveBeenCalled();expect(m.auditar).not.toHaveBeenCalled();
});
it("regularização factual corrigida pode concluir quando não há revisão de contexto",async()=>{
 m.tx.necessidadeSanitaria.findMany.mockResolvedValue([{...n,situacao:"NECESSITA_REVISAO",motivo:"Protocolo com evidência anulada exige regularização"}]);
 m.tx.participacaoProtocolo.findUnique.mockResolvedValue({id:"participacao",canceladaEm:null,tarefas:[{dispensadaEm:null,regularizacaoPendente:false,aplicacoes:[],exames:[{status:"VALIDO",realizacao:"REALIZADO"}],tentativas:[],manejos:[],vinculos:[]}]});
 await reconciliarParticipacaoAlertaTx(tx(),"participacao",7);
 expect(m.tx.necessidadeSanitaria.update).toHaveBeenCalledWith({where:{id:n.id},data:expect.objectContaining({situacao:"REALIZADO"})});expect(m.publicar).toHaveBeenCalledWith(m.tx,n.id,{usuarioId:7},"ENCERRAR");
});
