import { Prisma, type FornecimentoNutricionalLeite } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ tx: { $executeRaw: vi.fn(), fornecimentoNutricionalLeite: { findFirst: vi.fn() }, fechamentoOperacaoLeite: { findMany: vi.fn() }, referenciaGerencialLeite: { findFirst: vi.fn(), create: vi.fn() }, requisicaoPecuaria: { findUnique: vi.fn(), create: vi.fn() }, auditoriaPecuaria: { create: vi.fn() } }, periodo: vi.fn(), referencias: [] as Record<string,unknown>[], requisicoes: new Map<string,unknown>() }));
vi.mock("../../../db.js", () => ({ prisma: { ...m.tx, $transaction: (fn: (tx: typeof m.tx) => unknown) => fn(m.tx) } }));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: (fn: (tx: typeof m.tx) => unknown) => fn(m.tx) }));
vi.mock("../../financeiro/regras.js", async original => ({ ...await original<typeof import("../../financeiro/regras.js")>(), exigirPeriodoAberto: m.periodo }));
import { aplicarReferenciaProvisoriaTx, candidatosReferenciaTx, revisarReferenciaLeite } from "./referencias.js";
const d = (v: string) => new Prisma.Decimal(v);
const f: FornecimentoNutricionalLeite = { id:"f",itemId:"i",propriedadeId:1,data:new Date("2026-10-01"),quantidadeLitros:d("60"),status:"CONFIRMADO",criadoEm:new Date(),criadoPorId:1 };
const tx = m.tx as unknown as Prisma.TransactionClient;
const fechamento = (id="fechamento", data="2026-10-01", preco="2.70") => ({id,versao:1,precoUnitario:d(preco),comercial:{id:"comercial",propriedadeId:1,parceiroId:"comprador",inicio:new Date(data),fim:new Date(data.slice(0,7)+"-20"),parceiro:{nome:"Comprador"},fechamentos:[{id}]}});
const input = {chave:"chave",propriedadeId:1,fechamentoId:"fechamento",versaoEsperada:0,motivo:"Revisão com preço do período"};
beforeEach(() => {
 vi.resetAllMocks();m.referencias.length=0;m.requisicoes.clear();
 m.tx.fornecimentoNutricionalLeite.findFirst.mockResolvedValue(f);
 m.tx.fechamentoOperacaoLeite.findMany.mockImplementation(async ({where}) => where.comercial.inicio.gte.getUTCMonth()===9 ? [fechamento()] : []);
 m.tx.referenciaGerencialLeite.findFirst.mockImplementation(async ({where}) => where.fechamentoId ? m.referencias.find(r=>r.fechamentoId===where.fechamentoId)??null:m.referencias.at(-1)??null);
 m.tx.referenciaGerencialLeite.create.mockImplementation(async ({data}) => {const r={id:`r${data.versao}`,...data};m.referencias.push(r);return r;});
 m.tx.requisicaoPecuaria.findUnique.mockImplementation(async ({where})=>m.requisicoes.get(where.chave)??null);
 m.tx.requisicaoPecuaria.create.mockImplementation(async ({data})=>{m.requisicoes.set(data.chave,data);return data;});
});
describe("referência gerencial versionada", () => {
 it("sem preço comprovado ou com múltiplas referências não inventa média ou zero", async()=>{
  await aplicarReferenciaProvisoriaTx(tx,f,1);expect(m.tx.referenciaGerencialLeite.create).not.toHaveBeenCalled();
  m.tx.fechamentoOperacaoLeite.findMany.mockResolvedValue([fechamento("a","2026-09-01","2.50"),fechamento("b","2026-09-01","2.60")]);
  await aplicarReferenciaProvisoriaTx(tx,f,1);expect(m.tx.referenciaGerencialLeite.create).not.toHaveBeenCalled();
 });
 it("grava 150 provisórios com único preço anterior e revisa para 162 explicitamente, sem movimento físico",async()=>{
  m.tx.fechamentoOperacaoLeite.findMany.mockResolvedValueOnce([fechamento("anterior","2026-09-01","2.50")]);
  await aplicarReferenciaProvisoriaTx(tx,f,1);
  expect(m.referencias[0]).toMatchObject({versao:1,provisoria:true,valorTotal:d("150")});
  const r=await revisarReferenciaLeite("f",{...input,versaoEsperada:1},1);
  expect(r).toMatchObject({versao:2,provisoria:false,valorTotal:"162.00"});expect(m.referencias).toHaveLength(2);
  expect(m.referencias[0].valorTotal).toEqual(d("150"));
  await revisarReferenciaLeite("f",{...input,versaoEsperada:1},1);expect(m.referencias).toHaveLength(2);
  expect(m.tx.auditoriaPecuaria.create).toHaveBeenCalledTimes(2);
 });
 it("filtra sítio e mês anterior corretamente na fronteira de ano",async()=>{
  await candidatosReferenciaTx(tx,{...f,data:new Date("2027-01-01")},true);
  expect(m.tx.fechamentoOperacaoLeite.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({comercial:{propriedadeId:1,inicio:{gte:new Date("2026-12-01")},fim:{lte:new Date("2026-12-31")}},operacao:{status:"CONFIRMADA"}})}));
 });
 it("recusa fonte retificada, escopo ausente, versão desatualizada e período fechado",async()=>{
  m.tx.fechamentoOperacaoLeite.findMany.mockResolvedValue([{...fechamento(),comercial:{...fechamento().comercial,fechamentos:[{id:"nova-versao"}]}}]);
  await expect(revisarReferenciaLeite("f",input,1)).rejects.toThrow("vigente");
  m.tx.fornecimentoNutricionalLeite.findFirst.mockResolvedValue(null);
  await expect(revisarReferenciaLeite("f",input,1)).rejects.toThrow("neste sítio");
  m.tx.fornecimentoNutricionalLeite.findFirst.mockResolvedValue(f);
  await expect(revisarReferenciaLeite("f",{...input,versaoEsperada:8},1)).rejects.toThrow("versão atual");
  m.periodo.mockRejectedValue(new Error("Período fechado"));
  await expect(revisarReferenciaLeite("f",input,1)).rejects.toThrow("Período fechado");
  expect(m.tx.referenciaGerencialLeite.create).not.toHaveBeenCalled();
 });
});
