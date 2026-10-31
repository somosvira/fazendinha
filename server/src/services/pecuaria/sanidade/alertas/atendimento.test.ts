import { describe, expect, it } from "vitest";
import { aplicacaoSchema } from "../aplicacoes.schemas.js";
const id="a1000000-0000-4000-8000-000000000001";
const aplicacao={animalId:id,propriedadeId:1,data:"2026-10-28",origemInsumo:"SEM_ORIGEM_JUSTIFICADA",nomeProdutoAplicado:"Produto fictício",dose:"1",unidadeDose:"ML",alertaId:id,alertaRevisao:2,confirmarCuidadoAlerta:true};
describe("aplicação originada em alerta",()=>{
 it("aceita origem explícita e revisão esperada sem substituir validações sanitárias",()=>{expect(aplicacaoSchema.safeParse(aplicacao).success).toBe(true)});
 it("não aceita alerta sem revisão nem ciência do cuidado",()=>{expect(aplicacaoSchema.safeParse({...aplicacao,alertaRevisao:undefined,confirmarCuidadoAlerta:undefined}).success).toBe(false)});
});

import { beforeEach, vi } from "vitest";
import type { Prisma } from "@prisma/client";
const m=vi.hoisted(()=>({publicar:vi.fn(),auditar:vi.fn(),tx:{produto:{findUnique:vi.fn()},protocolo:{findUnique:vi.fn()},vinculoAtendimentoAlerta:{create:vi.fn()},$executeRaw:vi.fn(),necessidadeProgramacaoSanitaria: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) }, necessidadeSanitaria:{findFirst:vi.fn(),update:vi.fn(),findMany:vi.fn()},aplicacaoProduto:{findUnique:vi.fn()}}}));
vi.mock("./produtor.js",()=>({configuracaoNecessidadeTx:async(_tx:unknown,n:{regra:unknown})=>n.regra,publicarNecessidadeTx:m.publicar}));
vi.mock("../../rebanho/regras.js",async original=>({...await original<typeof import("../../rebanho/regras.js")>(),auditar:m.auditar}));
import { vincularAplicacaoAlertaTx, revisarAplicacaoAnuladaTx } from "./atendimento.js";
const necessidade={id:"necessidade",animalId:id,alertaId:id,propriedadeId:1,revisao:2,situacao:"PENDENTE",aplicacaoId:null,participacaoId:null,regra:{produtoId:"produto"},alerta:{ciclo:"ABERTO"}};
const fato={id:"fato",animalId:id,propriedadeId:1,produtoId:"produto",status:"VALIDO",data:new Date("2026-10-28")};
const tx=()=>m.tx as unknown as Prisma.TransactionClient;
beforeEach(()=>{vi.clearAllMocks();m.tx.produto.findUnique.mockResolvedValue({ativo:true,usoSanitario:true});m.tx.necessidadeSanitaria.findFirst.mockResolvedValue(necessidade);m.tx.aplicacaoProduto.findUnique.mockResolvedValue(fato);m.tx.necessidadeSanitaria.update.mockResolvedValue({...necessidade,situacao:"REALIZADO",revisao:3});});
describe("vínculo atômico da aplicação e necessidade",()=>{
 it("atende somente a necessidade selecionada e publica encerramento",async()=>{await vincularAplicacaoAlertaTx(tx(),{alertaId:id,alertaRevisao:2,confirmarCuidadoAlerta:true},fato,7);expect(m.tx.necessidadeSanitaria.update).toHaveBeenCalledWith(expect.objectContaining({where:{id:"necessidade"},data:expect.objectContaining({aplicacaoId:"fato",situacao:"REALIZADO",revisao:{increment:1}})}));expect(m.publicar).toHaveBeenCalledWith(m.tx,"necessidade",{usuarioId:7},"ENCERRAR");});
 it("recusa revisão vencida antes de vincular",async()=>{await expect(vincularAplicacaoAlertaTx(tx(),{alertaId:id,alertaRevisao:1,confirmarCuidadoAlerta:true},fato,7)).rejects.toMatchObject({code:"CONFLITO"});expect(m.tx.necessidadeSanitaria.update).not.toHaveBeenCalled();});
 it("recusa produto coincidente de outro animal",async()=>{await expect(vincularAplicacaoAlertaTx(tx(),{alertaId:id,alertaRevisao:2,confirmarCuidadoAlerta:true},{...fato,animalId:"outro"},7)).rejects.toMatchObject({code:"NAO_ENCONTRADO"});expect(m.publicar).not.toHaveBeenCalled();});
 it("recusa fato anulado na revalidação protegida",async()=>{m.tx.aplicacaoProduto.findUnique.mockResolvedValue({...fato,status:"ANULADO"});await expect(vincularAplicacaoAlertaTx(tx(),{alertaId:id,alertaRevisao:2,confirmarCuidadoAlerta:true},fato,7)).rejects.toMatchObject({code:"CONFLITO"});expect(m.publicar).not.toHaveBeenCalled();});
 it("anulação reabre a mesma necessidade em revisão e conserva vínculo",async()=>{m.tx.necessidadeSanitaria.findMany.mockResolvedValue([{...necessidade,aplicacaoId:"fato",situacao:"REALIZADO"}]);await revisarAplicacaoAnuladaTx(tx(),"fato","Anulação conferida",7);expect(m.tx.necessidadeSanitaria.update).toHaveBeenCalledWith({where:{id:"necessidade"},data:expect.objectContaining({situacao:"NECESSITA_REVISAO",revisao:{increment:1}})});expect(m.tx.necessidadeSanitaria.update.mock.calls[0][0].data).not.toHaveProperty("aplicacaoId");expect(m.publicar).toHaveBeenCalledWith(m.tx,"necessidade",{usuarioId:7},"REABRIR");});
});
