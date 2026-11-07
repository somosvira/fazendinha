import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
const m = vi.hoisted(() => ({ tx: {} as Prisma.TransactionClient, corrigir: vi.fn(), registrar: vi.fn(), idempotente: vi.fn() }));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: async (fn: (tx: Prisma.TransactionClient) => unknown) => fn(m.tx) }));
vi.mock("./operacoes.js", () => ({ operacaoIdempotenteTx: m.idempotente }));
vi.mock("../fatos.js", () => ({ conferirAnimalNoFato: vi.fn(async () => ({ sexo: "F" })) }));
vi.mock("../rebanho/regras.js", async original => ({ ...(await original<typeof import("../rebanho/regras.js")>()), travarAnimais: vi.fn(), auditar: vi.fn() }));
vi.mock("../sanidade/exames.js", () => ({ corrigirExameTx: m.corrigir, registrarExameTx: m.registrar, criarTipoExameTx: vi.fn() }));
import { corrigirToqueAptidao, registrarToqueAptidaoTx } from "./toque-aptidao.js";
beforeEach(() => { vi.clearAllMocks(); m.idempotente.mockImplementation(async (_tx, _input, _autor, _operacao, fn) => fn()); });
describe("toque usa o núcleo comum e preserva a revisão", () => {
  it("corrige apenas aptidão com autorização interna explícita ao núcleo", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "e", animalId: "a", status: "VALIDO", finalidadePrincipal: "APTIDAO_REPRODUTIVA", data: new Date("2026-10-20") });
    const update = vi.fn(); m.tx = { exameAnimal: { findFirst }, interpretacaoReprodutiva: { update } } as unknown as Prisma.TransactionClient;
    m.corrigir.mockResolvedValue({ id: "e", resultadoOpcao: "NAO_APTO" });
    await corrigirToqueAptidao("e", { chave: "k", propriedadeId: 1, motivo: "Corrigir laudo", resultado: "NAO_APTO", retornoEm: "2026-11-01" }, 7);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "e", propriedadeId: 1 }) }));
    expect(m.corrigir).toHaveBeenCalledWith(m.tx, "e", 1, { motivo: "Corrigir laudo", resultadoOpcao: "NAO_APTO", anular: undefined }, 7, undefined, true);
    expect(update).toHaveBeenCalledWith({ where: { exameId: "e" }, data: { retornoEm: new Date("2026-11-01") } });
  });
  it("não concede exceção para DG ou exame de outro sítio", async () => {
    m.tx = { exameAnimal: { findFirst: vi.fn().mockResolvedValue(null) } } as unknown as Prisma.TransactionClient;
    await expect(corrigirToqueAptidao("dg", { chave: "k", propriedadeId: 1, motivo: "Corrigir laudo", anular: true }, 7)).rejects.toThrow("não encontrado");
    expect(m.corrigir).not.toHaveBeenCalled();
  });
  it("registrar exame não cria decisão e mantém retorno na mesma evidência", async () => {
    const update = vi.fn().mockResolvedValue({ id: "e" });
    m.tx = { $executeRaw: vi.fn(), tipoExame: { findUnique: vi.fn().mockResolvedValue({ id: "tipo" }) }, exameAnimal: { update } } as unknown as Prisma.TransactionClient;
    m.registrar.mockResolvedValue({ id: "e" });
    await registrarToqueAptidaoTx(m.tx, { animalId: "a", propriedadeId: 1, data: "2026-10-20", resultado: "INCONCLUSIVO", retornoEm: "2026-11-01", responsavel: "Veterinária" }, 7);
    expect(m.registrar).toHaveBeenCalledWith(m.tx, expect.objectContaining({ resultadoOpcao: "INCONCLUSIVO", tipoExameId: "tipo" }), 7);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ finalidadePrincipal: "APTIDAO_REPRODUTIVA", interpretacao: { create: { retornoEm: new Date("2026-11-01") } } }) }));
  });
});

it("corrige só aptidão do exame combinado, preservando DG e vínculos", async () => {
 const origem = { id: "e", animalId: "a", status: "VALIDO", finalidadePrincipal: "DIAGNOSTICO", data: new Date("2026-10-20"), interpretacao: { id: "dg", resultadoAptidao: "APTO", tentativaId: "t" } };
 const update = vi.fn().mockResolvedValue(origem);
 m.tx = { exameAnimal: { findFirst: vi.fn().mockResolvedValue(origem), update }, avaliacaoReprodutiva: { findUniqueOrThrow: vi.fn().mockResolvedValue({ resultado: "NEGATIVO" }) } } as unknown as Prisma.TransactionClient;
 await corrigirToqueAptidao("e", { chave: "k", propriedadeId: 1, motivo: "Conferência do laudo", resultado: "NAO_APTO", retornoEm: "2026-11-01" }, 7);
 expect(update).toHaveBeenCalledWith({ where: { id: "e" }, data: { atualizadoEm: expect.any(Date), interpretacao: { update: { resultadoAptidao: "NAO_APTO", retornoAptidaoEm: new Date("2026-11-01") } } }, include: { interpretacao: true } });
 expect(m.corrigir).not.toHaveBeenCalled();
 await expect(corrigirToqueAptidao("e", { chave: "k2", propriedadeId: 1, motivo: "Conferência do laudo", anular: true }, 7)).rejects.toThrow(/vínculos gestacionais/);
});

it("reenvio da anulação devolve a operação anterior mesmo com exame já anulado", async () => {
 m.tx = { exameAnimal: { findFirst: vi.fn().mockResolvedValue({ id: "e", animalId: "a", status: "ANULADO", finalidadePrincipal: "APTIDAO_REPRODUTIVA", data: new Date("2026-10-20") }) } } as unknown as Prisma.TransactionClient;
 m.idempotente.mockResolvedValueOnce({ id: "e", status: "ANULADO" });
 await expect(corrigirToqueAptidao("e", { chave: "mesma-chave", propriedadeId: 1, motivo: "Lançamento incorreto", anular: true }, 7)).resolves.toMatchObject({ id: "e", status: "ANULADO" });
 expect(m.corrigir).not.toHaveBeenCalled();
});
