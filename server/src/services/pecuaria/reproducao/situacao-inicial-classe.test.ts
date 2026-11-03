import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
const mocks = vi.hoisted(() => ({
  animal: { id: "animal", sexo: "F", dataEntrada: new Date("2025-01-01"), partosAntesDaEntrada: 0 },
  partos: vi.fn(), iniciais: vi.fn(), criar: vi.fn(), auditar: vi.fn(),
}));
vi.mock("../fatos.js", async original => ({ ...await original<typeof import("../fatos.js")>(), conferirAnimalNoFato: vi.fn(async () => mocks.animal) }));
vi.mock("../rebanho/regras.js", async original => ({ ...await original<typeof import("../rebanho/regras.js")>(), auditar: mocks.auditar }));
vi.mock("../idempotencia.js", () => ({ confirmarFato: async (input: unknown, autor: number, _operacao: string, criar: (tx: Prisma.TransactionClient, input: unknown, autor: number) => unknown) => criar({
  partoAnimal: { findMany: mocks.partos }, situacaoInicialReprodutiva: { findMany: mocks.iniciais, create: mocks.criar },
} as unknown as Prisma.TransactionClient, input, autor) }));
import { criarSituacaoInicial } from "./registros.js";
import { situacaoInicialSchema } from "./schemas.js";
const input = { chave: "10000000-0000-4000-8000-000000000001", animalId: "10000000-0000-4000-8000-000000000002", propriedadeId: 1, data: "2026-10-29", situacao: "DESCONHECIDA" as const };
beforeEach(() => {
  vi.clearAllMocks(); mocks.animal.partosAntesDaEntrada = 0;
  mocks.partos.mockResolvedValue([]); mocks.iniciais.mockResolvedValue([]);
  mocks.criar.mockImplementation(async ({ data }) => ({ id: "inicial", ...data }));
});
describe("classe explícita no fato inicial", () => {
  it("conserva omissão sem inferir classe e exige descrição da evidência declarada", () => {
    expect(situacaoInicialSchema.parse(input)).not.toHaveProperty("classeReprodutiva");
    expect(situacaoInicialSchema.safeParse({ ...input, classeReprodutiva: "NOVILHA" }).success).toBe(false);
    expect(situacaoInicialSchema.safeParse({ ...input, classeReprodutiva: "NOVILHA", observacao: "Confirmado no cadastro de origem" }).success).toBe(true);
    expect(situacaoInicialSchema.safeParse({ ...input, classeReprodutiva: "OUTRA", observacao: "Confirmado na fonte" }).success).toBe(false);
  });
  it("grava classe, descrição, data e autoria no fato auditado sem criar liberação", async () => {
    const resultado = await criarSituacaoInicial(situacaoInicialSchema.parse({ ...input, classeReprodutiva: "NOVILHA", observacao: "Nuliparidade conferida pelo responsável" }), 7);
    expect(resultado).toMatchObject({ classeReprodutiva: "NOVILHA", observacao: "Nuliparidade conferida pelo responsável", criadoPorId: 7, aptaDesde: null, situacao: "DESCONHECIDA" });
    expect(mocks.auditar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ depois: expect.objectContaining({ classeReprodutiva: "NOVILHA" }) }));
  });
  it.each(["saldo", "parto", "declaracao-vaca"])("recusa novilha incompatível com %s antes de gravar", async tipo => {
    if (tipo === "saldo") mocks.animal.partosAntesDaEntrada = 1;
    if (tipo === "parto") mocks.partos.mockResolvedValue([{ id: "p", data: new Date("2026-01-01"), status: "VALIDO" }]);
    if (tipo === "declaracao-vaca") mocks.iniciais.mockResolvedValue([{ id: "v", data: new Date("2026-01-01"), criadoEm: new Date("2026-01-01"), status: "VALIDO", classeReprodutiva: "VACA" }]);
    await expect(criarSituacaoInicial(situacaoInicialSchema.parse({ ...input, classeReprodutiva: "NOVILHA", observacao: "Classe declarada na ficha" }), 7)).rejects.toMatchObject({ code: "VALIDACAO", campo: "classeReprodutiva" });
    expect(mocks.criar).not.toHaveBeenCalled(); expect(mocks.auditar).not.toHaveBeenCalled();
  });
  it("classe vaca não exige nem inventa data de parto", async () => {
    expect(await criarSituacaoInicial(situacaoInicialSchema.parse({ ...input, classeReprodutiva: "VACA", observacao: "Matriz histórica com parto confirmado sem data" }), 7))
      .toMatchObject({ classeReprodutiva: "VACA", aptaDesde: null });
  });
});
