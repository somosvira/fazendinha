import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const mocks=vi.hoisted(()=>({transacao:vi.fn(),executar:vi.fn()}));
vi.mock("../db.js",()=>({prisma:{$transaction:mocks.transacao}}));
import { concluirTransacaoValidadaTx,transacaoValidada } from "./transacao-validada.js";
import { transacaoEstoque } from "../services/estoque/transacao.js";
import { transacaoPecuaria } from "../services/pecuaria/transacao.js";
const tx={ $executeRaw:mocks.executar } as unknown as Prisma.TransactionClient;
beforeEach(()=>{vi.clearAllMocks();mocks.executar.mockResolvedValue(0);mocks.transacao.mockImplementation(async fn=>fn(tx));});
describe("transação valida garantias diferidas antes do COMMIT",()=>{
 it("conclui o callback inteiro antes de forçar a validação",async()=>{const passos:string[]=[];mocks.executar.mockImplementation(async strings=>{expect(strings.join("")).toBe("SET CONSTRAINTS ALL IMMEDIATE");passos.push("constraints");});const resultado=await concluirTransacaoValidadaTx(tx,async()=>{passos.push("movimento");await Promise.resolve();passos.push("parcelas");passos.push("auditoria");return{id:"confirmado"};});expect(passos).toEqual(["movimento","parcelas","auditoria","constraints"]);expect(resultado).toEqual({id:"confirmado"});});
 it("falha diferida permanece dentro do callback e a transação faz rollback",async()=>{const passos:string[]=[];const erro=new Error("parcelas não conciliam");mocks.executar.mockRejectedValue(erro);mocks.transacao.mockImplementation(async fn=>{passos.push("begin");try{const r=await fn(tx);passos.push("commit");return r;}catch(e){passos.push("rollback");throw e;}});await expect(transacaoValidada(async()=>{passos.push("callback-completo");return"resultado";})).rejects.toBe(erro);expect(passos).toEqual(["begin","callback-completo","rollback"]);});
 it("erro no domínio não força validação de um trabalho incompleto",async()=>{const erro=new Error("origem sem lastro");await expect(transacaoValidada(async()=>{throw erro;})).rejects.toBe(erro);expect(mocks.executar).not.toHaveBeenCalled();});
 it.each([["estoque",transacaoEstoque],["pecuária",transacaoPecuaria]] as const)("preserva retry Serializable de %s e reexecuta todos os fatos",async(_nome,wrapper)=>{const conflito=new Prisma.PrismaClientKnownRequestError("conflito",{code:"P2034",clientVersion:"teste"});mocks.executar.mockRejectedValueOnce(conflito).mockResolvedValue(0);const callback=vi.fn().mockResolvedValue("ok");await expect(wrapper(callback)).resolves.toBe("ok");expect(callback).toHaveBeenCalledTimes(2);expect(mocks.executar).toHaveBeenCalledTimes(2);expect(mocks.transacao).toHaveBeenCalledWith(expect.any(Function),{isolationLevel:"Serializable",timeout:30000});});
});
