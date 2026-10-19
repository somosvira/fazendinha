import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const mocks=vi.hoisted(()=>({transacao:vi.fn(),executar:vi.fn()}));
vi.mock("../db.js",()=>({prisma:{$transaction:mocks.transacao}}));
import { concluirTransacaoValidadaTx,conflitoTransacaoValidada,transacaoValidada } from "./transacao-validada.js";
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

const erroSqlAdapter = (codigo: string) => new Prisma.PrismaClientKnownRequestError("Raw query failed", {
 code: "P2010", clientVersion: "6.19.3", meta: { driverAdapterError: { name: "DriverAdapterError", cause: { originalCode: codigo, kind: codigo === "40001" ? "TransactionWriteConflict" : "postgres" } } },
});
describe("SQLSTATE transitório durante conferência diferida", () => {
 it.each([ ["estoque", transacaoEstoque, "40001"], ["pecuária", transacaoPecuaria, "40001"], ["estoque", transacaoEstoque, "40P01"], ["pecuária", transacaoPecuaria, "40P01"] ] as const)("repete o callback completo de %s em falha SQL transitória", async (_nome, wrapper, codigo) => {
  mocks.executar.mockRejectedValueOnce(erroSqlAdapter(codigo)).mockResolvedValue(0);
  const fatos = vi.fn().mockResolvedValue("confirmado");
  await expect(wrapper(fatos)).resolves.toBe("confirmado");
  expect(fatos).toHaveBeenCalledTimes(2); expect(mocks.transacao).toHaveBeenCalledTimes(2);
 });
 it.each([["estoque",transacaoEstoque],["pecuária",transacaoPecuaria]] as const)("%s não repete P2010 de constraint23514", async (_nome,wrapper) => {
  const erro = erroSqlAdapter("23514"); mocks.executar.mockRejectedValue(erro); const fatos = vi.fn().mockResolvedValue("resultado");
  await expect(wrapper(fatos)).rejects.toBe(erro); expect(fatos).toHaveBeenCalledTimes(1); expect(mocks.transacao).toHaveBeenCalledTimes(1);
 });
 it("limita conflito SQL transitório a três tentativas e não reconhece texto como SQLSTATE", async () => {
  mocks.executar.mockRejectedValue(erroSqlAdapter("40001")); const fatos = vi.fn().mockResolvedValue("resultado");
  await expect(transacaoPecuaria(fatos)).rejects.toMatchObject({code:"P2010"}); expect(fatos).toHaveBeenCalledTimes(3);
  expect(conflitoTransacaoValidada(new Error("40001"))).toBe(false);
  expect(conflitoTransacaoValidada(new Prisma.PrismaClientKnownRequestError("SQL inválido",{code:"P2010",clientVersion:"6",meta:{code:"42601"}}))).toBe(false);
  expect(conflitoTransacaoValidada(new Prisma.PrismaClientKnownRequestError("serialização",{code:"P2010",clientVersion:"6",meta:{code:"40001"}}))).toBe(true);
 });
});
