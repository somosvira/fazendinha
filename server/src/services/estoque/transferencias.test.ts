import { beforeEach, describe, expect, it, vi } from "vitest";
import { uid } from "../../lib/uid.fixture.js";
import { perdaEstoqueSchema } from "./transferencias.schemas.js";

const mocks = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("../../db.js", () => ({ prisma: { $transaction: mocks.transaction } }));
import { transferirEstoque } from "./transferencias.js";

const entrada = { chave: uid(1), produtoId: uid(2), origemId: 1, destinoId: 1, modo: "PERDA" as const, quantidade: "2", data: "2026-10-04", motivo: "Embalagem danificada" };
const { modo, destinoId, ...payload } = entrada;
beforeEach(() => { vi.clearAllMocks(); });
describe("motivo da perda", () => {
  it.each([undefined, null, "", "    ", " abcd ", "x".repeat(201)])("recusa %s antes de entrar na transação", async (motivo) => {
    expect(perdaEstoqueSchema.safeParse({ ...payload, motivo }).success).toBe(false);
    await expect(transferirEstoque({ ...entrada, motivo: motivo as string }, null)).rejects.toMatchObject({ code: "VALIDACAO", campo: "motivo" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it.each([" abcde ", ` ${"x".repeat(200)} `])("valida os limites depois de retirar espaços", (motivo) => {
    expect(perdaEstoqueSchema.parse({ ...payload, motivo }).motivo).toBe(motivo.trim());
  });
});
