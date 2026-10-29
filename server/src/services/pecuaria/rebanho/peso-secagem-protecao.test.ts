import type { Prisma } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ db: {} as Prisma.TransactionClient, peso: vi.fn(), animal: vi.fn(), ativo: vi.fn(), historico: vi.fn(), atualizar: vi.fn(), excluir: vi.fn() }));
vi.mock("../../../db.js", () => ({ prisma: {
  pesagem: { findUnique: m.peso }, animal: { findUnique: m.animal },
  $transaction: async (fn:(tx:Prisma.TransactionClient)=>unknown) => fn(m.db),
} }));
import { editarPesagemTx, excluirPesagem } from "./animais.js";
beforeEach(() => {
  vi.clearAllMocks();
  m.peso.mockResolvedValue({ id:"p",animalId:"a",referenciaHistorica:null });m.animal.mockResolvedValue({id:"a"});m.ativo.mockResolvedValue({id:"v"});m.historico.mockResolvedValue(1);
  m.db={ $executeRaw:vi.fn(), pesagem:{findUnique:m.peso,update:m.atualizar,delete:m.excluir}, vinculoPesagemSecagem:{findFirst:m.ativo,count:m.historico} } as unknown as Prisma.TransactionClient;
});
it("edição genérica de peso associado exige a revisão explícita da lactação",async()=>{
  await expect(editarPesagemTx(m.db,"p",{pesoKg:510},7)).rejects.toMatchObject({code:"CONFLITO",campo:"id"});
  expect(m.atualizar).not.toHaveBeenCalled();
});
it("exclusão conserva pesagem mesmo depois de revogar o vínculo de secagem",async()=>{
  m.ativo.mockResolvedValue(null);
  await expect(excluirPesagem("p",7)).rejects.toThrow("histórico de secagem");
  expect(m.historico).toHaveBeenCalledWith({where:{pesagemId:"p"}});expect(m.excluir).not.toHaveBeenCalled();
});
