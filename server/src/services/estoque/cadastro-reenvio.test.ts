import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../db.js";
import { comReenvioCadastro } from "./cadastro-reenvio.js";
import { uid } from "../../lib/uid.fixture.js";

const registro = { id: uid(1), autor: "usuario:7", operacao: "produto:criar", chave: uid(2), hashPayload: "0".repeat(64), resultado: { id: uid(3) }, criadoEm: new Date("2026-11-08T00:00:00Z") };
const executar=vi.fn(async()=>({id:uid(3)}));
beforeEach(()=>{
  vi.spyOn(prisma,"$executeRaw").mockResolvedValue(0);
  vi.spyOn(prisma.reenvioCadastroEstoque,"findUnique").mockResolvedValue(null);
  vi.spyOn(prisma.reenvioCadastroEstoque,"create").mockResolvedValue(registro);
  executar.mockClear();
});
afterEach(()=>vi.restoreAllMocks());
describe("reenvio atômico de cadastros",()=>{
  it("reconhece reenvio idêntico antes de executar novamente",async()=>{
    const input={nome:"Produto",referencia:null};
    const primeiro=await comReenvioCadastro(prisma,"produto:criar",7,uid(2),input,executar);
    const hashPayload=vi.mocked(prisma.reenvioCadastroEstoque.create).mock.calls[0][0].data.hashPayload;
    vi.mocked(prisma.reenvioCadastroEstoque.findUnique).mockResolvedValue({...registro,hashPayload});
    const segundo=await comReenvioCadastro(prisma,"produto:criar",7,uid(2),{referencia:null,nome:"Produto"},executar);
    expect(segundo).toEqual(primeiro);
    expect(executar).toHaveBeenCalledTimes(1);
    expect(prisma.reenvioCadastroEstoque.create).toHaveBeenCalledTimes(1);
  });
  it("impede reaproveitar a chave com payload diferente",async()=>{
    vi.mocked(prisma.reenvioCadastroEstoque.findUnique).mockResolvedValue(registro);
    await expect(comReenvioCadastro(prisma,"produto:criar",7,uid(2),{nome:"Outro"},executar)).rejects.toMatchObject({code:"CONFLITO",campo:"chaveReenvio"});
    expect(executar).not.toHaveBeenCalled();
  });
  it("mantém clientes antigos sem ledger e não grava resultado quando a escrita falha",async()=>{
    await comReenvioCadastro(prisma,"produto:criar",null,undefined,{nome:"Antigo"},executar);
    expect(prisma.reenvioCadastroEstoque.findUnique).not.toHaveBeenCalled();
    expect(prisma.reenvioCadastroEstoque.create).not.toHaveBeenCalled();
    await expect(comReenvioCadastro(prisma,"produto:criar",7,uid(2),{},async()=>{throw new Error("Escrita recusada");})).rejects.toThrow("Escrita recusada");
    expect(prisma.reenvioCadastroEstoque.create).not.toHaveBeenCalled();
  });
});
