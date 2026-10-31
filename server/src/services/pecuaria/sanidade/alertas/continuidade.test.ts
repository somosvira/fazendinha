import {beforeEach,describe,expect,it,vi} from "vitest";
import type {Prisma} from "@prisma/client";
const m=vi.hoisted(()=>({publicar:vi.fn(),avaliar:vi.fn(),auditar:vi.fn(),tx:{necessidadeSanitaria:{findMany:vi.fn(),update:vi.fn()},animal:{findUniqueOrThrow:vi.fn()},regraAlertaSanitario:{findMany:vi.fn()}}}));
vi.mock("./produtor.js",()=>({configuracaoNecessidadeTx:async(_tx:unknown,n:{regra:unknown})=>n.regra,publicarNecessidadeTx:m.publicar,avaliarRegraAnimalTx:m.avaliar}));
vi.mock("../../rebanho/regras.js",async original=>({...await original<typeof import("../../rebanho/regras.js")>(),auditar:m.auditar}));
vi.mock("../programacoes/continuidade.js",()=>({reavaliarContinuidadeProgramaAnimalTx:vi.fn()}));
import {reavaliarContinuidadeAnimalTx} from "./continuidade.js";
const n={id:"necessidade",animalId:"animal",propriedadeId:1,situacao:"PENDENTE",aplicacaoId:null,participacaoId:null,alerta:{ciclo:"ABERTO"},regraId:"regra",regra:{id:"regra",ativo:true,produtoId:null,protocoloId:null,propriedadeIds:[1,2],sexo:null}};
const tx=()=>m.tx as unknown as Prisma.TransactionClient;
beforeEach(()=>{vi.clearAllMocks();m.tx.necessidadeSanitaria.findMany.mockResolvedValue([n]);m.tx.animal.findUniqueOrThrow.mockResolvedValue({id:"animal",sexo:"F",localizacoes:[{propriedadeId:2}],baixas:[]});m.tx.regraAlertaSanitario.findMany.mockResolvedValue([]);});
describe("continuidade de necessidade sanitária",()=>{
 it("transferência entre sítios abrangidos mantém identidade e exige conferir o contexto",async()=>{await reavaliarContinuidadeAnimalTx(tx(),"animal",7,"LOCALIZACAO");expect(m.tx.necessidadeSanitaria.update).toHaveBeenCalledWith({where:{id:n.id},data:expect.objectContaining({propriedadeId:2,situacao:"NECESSITA_REVISAO",revisao:{increment:1}})});});
 it("baixa encerra aberta sem apagar a necessidade",async()=>{m.tx.animal.findUniqueOrThrow.mockResolvedValue({id:"animal",sexo:"F",localizacoes:[],baixas:[{id:"baixa"}]});await reavaliarContinuidadeAnimalTx(tx(),"animal",7,"BAIXA");expect(m.tx.necessidadeSanitaria.update).toHaveBeenCalledWith({where:{id:n.id},data:expect.objectContaining({situacao:"ENCERRADO"})});expect(m.publicar).toHaveBeenCalledWith(m.tx,n.id,{usuarioId:7},"ENCERRAR");});
 it.each(["REALIZADO","DISPENSADO","ENCERRADO","INVALIDADO"])("transfere o histórico %s sem reabrir atendimento nem alterar sua evidência",async situacao=>{
  const ciclo=situacao==="INVALIDADO"?"INVALIDADO":"ENCERRADO";
  m.tx.necessidadeSanitaria.findMany.mockResolvedValue([{...n,situacao,aplicacaoId:"aplicacao",alerta:{ciclo}}]);
  await reavaliarContinuidadeAnimalTx(tx(),"animal",7,"LOCALIZACAO");
  expect(m.tx.necessidadeSanitaria.update).toHaveBeenCalledTimes(1);
  expect(m.tx.necessidadeSanitaria.update).toHaveBeenCalledWith({where:{id:n.id},data:{propriedadeId:2,revisao:{increment:1}}});
  expect(m.publicar).toHaveBeenCalledWith(m.tx,n.id,{usuarioId:7},ciclo==="INVALIDADO"?"INVALIDAR":"ENCERRAR");
  expect(m.avaliar).not.toHaveBeenCalled();
  expect(m.auditar).toHaveBeenCalledWith(m.tx,expect.objectContaining({entidadeId:n.id,propriedadeId:2,acao:"CONTINUIDADE_ANIMAL",depois:expect.objectContaining({situacao,propriedadeId:2})}));
 });
 it("movimentação de lote no mesmo sítio não reabre nem republica o histórico",async()=>{
  m.tx.necessidadeSanitaria.findMany.mockResolvedValue([{...n,situacao:"REALIZADO",aplicacaoId:"aplicacao",alerta:{ciclo:"ENCERRADO"}}]);
  m.tx.animal.findUniqueOrThrow.mockResolvedValue({id:"animal",sexo:"F",localizacoes:[{propriedadeId:1}],baixas:[]});
  await reavaliarContinuidadeAnimalTx(tx(),"animal",7,"LOCALIZACAO");
  expect(m.tx.necessidadeSanitaria.update).not.toHaveBeenCalled();expect(m.publicar).not.toHaveBeenCalled();
 });
 it("transferência entre sítios abrangidos preserva protocolo e pede revisão",async()=>{
  m.tx.necessidadeSanitaria.findMany.mockResolvedValue([{...n,situacao:"PROGRAMADO",participacaoId:"participacao"}]);
  await reavaliarContinuidadeAnimalTx(tx(),"animal",7,"LOCALIZACAO");
  expect(m.tx.necessidadeSanitaria.update).toHaveBeenCalledWith({where:{id:n.id},data:expect.objectContaining({situacao:"NECESSITA_REVISAO",propriedadeId:2})});
  expect(m.tx.necessidadeSanitaria.update.mock.calls[0][0].data).not.toHaveProperty("participacaoId");
 });
 it("fora da abrangência conserva vínculo programado e exige revisão",async()=>{m.tx.animal.findUniqueOrThrow.mockResolvedValue({id:"animal",sexo:"F",localizacoes:[{propriedadeId:3}],baixas:[]});m.tx.necessidadeSanitaria.findMany.mockResolvedValue([{...n,situacao:"PROGRAMADO",participacaoId:"participacao"}]);await reavaliarContinuidadeAnimalTx(tx(),"animal",7,"LOCALIZACAO");expect(m.tx.necessidadeSanitaria.update).toHaveBeenCalledWith({where:{id:n.id},data:expect.objectContaining({situacao:"NECESSITA_REVISAO",propriedadeId:3})});expect(m.tx.necessidadeSanitaria.update.mock.calls[0][0].data).not.toHaveProperty("participacaoId");});
});
