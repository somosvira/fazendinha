import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ tx: {
  ocorrenciaSanitaria: { findFirst: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  aplicacaoProduto: { count: vi.fn() }, exameAnimal: { count: vi.fn() }, execucaoProtocoloSanitario: { count: vi.fn() }, baixaAnimal: { findFirst: vi.fn() },
}, auditar: vi.fn(), travar: vi.fn() }));
vi.mock("../../../db.js", () => ({ prisma: {} }));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: async (fn: (tx: typeof mocks.tx) => unknown) => fn(mocks.tx) }));
vi.mock("../rebanho/regras.js", async (original) => ({ ...await original<typeof import("../rebanho/regras.js")>(), auditar: mocks.auditar, travarAnimais: mocks.travar }));
import { anularOcorrencia, encerrarOcorrencia } from "./ocorrencias.js";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.tx.ocorrenciaSanitaria.findFirst.mockResolvedValue({ id: "ocorrencia", animalId: "animal", status: "VALIDO" });
  mocks.tx.ocorrenciaSanitaria.findUniqueOrThrow.mockResolvedValue({ id: "ocorrencia", animalId: "animal", status: "ANULADO" });
});
describe("ocorrências revalidam o fato após o bloqueio", () => {
  it("não encerra uma ocorrência anulada enquanto aguardava a confirmação", async () => {
    await expect(encerrarOcorrencia("ocorrencia", 1, { fim: "2026-09-12", desfecho: "Recuperado" }, 7)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(mocks.tx.ocorrenciaSanitaria.update).not.toHaveBeenCalled();
    expect(mocks.auditar).not.toHaveBeenCalled();
  });
  it("não duplica a anulação nem substitui motivo/auditoria de outra confirmação", async () => {
    await expect(anularOcorrencia("ocorrencia", 1, "Lançamento incorreto", 7)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(mocks.tx.ocorrenciaSanitaria.findUniqueOrThrow.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.travar.mock.invocationCallOrder[0]);
    expect(mocks.tx.ocorrenciaSanitaria.update).not.toHaveBeenCalled();
    expect(mocks.auditar).not.toHaveBeenCalled();
  });
});
