import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  tx: { aplicacaoProduto: { findFirst: vi.fn(), update: vi.fn() }, produto: { findUnique: vi.fn() }, operacao: { findFirst: vi.fn() }, $executeRaw: vi.fn() },
  conferir: vi.fn(), travar: vi.fn(), auditar: vi.fn(),
}));
vi.mock("../../../db.js", () => ({ prisma: { $transaction: async (fn: (tx: typeof mocks.tx) => unknown) => fn(mocks.tx) } }));
vi.mock("../rebanho/regras.js", async (original) => ({ ...await original<typeof import("../rebanho/regras.js")>(), travarAnimais: mocks.travar, auditar: mocks.auditar }));
vi.mock("../fatos.js", () => ({ conferirAnimalNoFato: mocks.conferir }));

import { reconciliarOrigem } from "./aplicacoes.js";

const antes = { id: "aplicacao", animalId: "animal", propriedadeId: 2, status: "VALIDO", origemInsumo: "SEM_ORIGEM_JUSTIFICADA", produtoId: null, nomeProdutoAplicado: "Medicamento anotado", dose: new Prisma.Decimal("0.5"), unidadeDose: "ML", data: new Date("2026-09-01"), aplicadaEm: new Date("2026-09-01T12:00:00Z"), justificativaSemOrigem: "Nota ainda não localizada" };
const input = { origemInsumo: "INCLUSO_SERVICO" as const, produtoId: "produto", operacaoServicoId: "servico", motivo: "Veterinário conferiu embalagem e prontuário" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.tx.aplicacaoProduto.findFirst.mockResolvedValue(antes);
  mocks.tx.aplicacaoProduto.update.mockImplementation(({ data }) => ({ ...antes, ...data }));
  mocks.tx.produto.findUnique.mockResolvedValue({ id: "produto", nome: "Medicamento cadastrado", ativo: true, usoSanitario: true, unidade: "ML" });
  mocks.tx.operacao.findFirst.mockResolvedValue({ id: "servico" });
});

describe("equivalência na reconciliação de origem", () => {
  it("exige ciência quando o primeiro Produto tem nome diferente e preserva o nome histórico", async () => {
    await expect(reconciliarOrigem("aplicacao", 2, input, 7)).rejects.toMatchObject({ code: "VALIDACAO", campo: "confirmarEquivalencia" });
    expect(mocks.tx.aplicacaoProduto.update).not.toHaveBeenCalled();
    const salva = await reconciliarOrigem("aplicacao", 2, { ...input, confirmarEquivalencia: true }, 7);
    expect(salva.nomeProdutoAplicado).toBe(antes.nomeProdutoAplicado);
    expect(salva.justificativaSemOrigem).toBe(antes.justificativaSemOrigem);
    expect(mocks.conferir).toHaveBeenCalledWith(mocks.tx, "animal", 2, antes.data);
    expect(mocks.auditar).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({ antes, depois: expect.objectContaining({ confirmarEquivalencia: true, motivo: input.motivo }) }));
  });

  it("nome equivalente ignora caixa e espaços sem exigir ciência adicional", async () => {
    mocks.tx.produto.findUnique.mockResolvedValue({ id: "produto", nome: "  MEDICAMENTO ANOTADO  ", ativo: true, usoSanitario: true, unidade: "ML" });
    await expect(reconciliarOrigem("aplicacao", 2, input, 7)).resolves.toMatchObject({ produtoId: "produto" });
  });

  it("Produto previamente vinculado pode ter sido renomeado, mas não pode ser trocado", async () => {
    mocks.tx.aplicacaoProduto.findFirst.mockResolvedValue({ ...antes, produtoId: "produto" });
    await expect(reconciliarOrigem("aplicacao", 2, input, 7)).resolves.toMatchObject({ produtoId: "produto" });
    await expect(reconciliarOrigem("aplicacao", 2, { ...input, produtoId: "outro", confirmarEquivalencia: true }, 7)).rejects.toMatchObject({ campo: "produtoId" });
  });

  it.each([{ ativo: false, usoSanitario: true }, { ativo: true, usoSanitario: false }])("recusa Produto sem uso sanitário ativo %j", async (uso) => {
    mocks.tx.produto.findUnique.mockResolvedValue({ id: "produto", nome: antes.nomeProdutoAplicado, unidade: "ML", ...uso });
    await expect(reconciliarOrigem("aplicacao", 2, input, 7)).rejects.toMatchObject({ campo: "produtoId" });
    expect(mocks.tx.aplicacaoProduto.update).not.toHaveBeenCalled();
  });

  it("ciência não autoriza converter volume em massa", async () => {
    mocks.tx.produto.findUnique.mockResolvedValue({ id: "produto", nome: "Medicamento", ativo: true, usoSanitario: true, unidade: "KG" });
    await expect(reconciliarOrigem("aplicacao", 2, { ...input, confirmarEquivalencia: true }, 7)).rejects.toMatchObject({ campo: "produtoId" });
  });

  it("revalida estado depois da trava e não grava aplicação já reconciliada", async () => {
    mocks.tx.aplicacaoProduto.findFirst.mockResolvedValueOnce(antes).mockResolvedValueOnce(null);
    await expect(reconciliarOrigem("aplicacao", 2, { ...input, confirmarEquivalencia: true }, 7)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(mocks.tx.aplicacaoProduto.findFirst.mock.invocationCallOrder[1]).toBeGreaterThan(mocks.travar.mock.invocationCallOrder[0]);
    expect(mocks.tx.aplicacaoProduto.update).not.toHaveBeenCalled();
  });

  it("recusa a alteração quando o histórico já não confirma o sítio do fato", async () => {
    mocks.conferir.mockRejectedValue(new Error("O animal não estava neste sítio na data informada"));
    await expect(reconciliarOrigem("aplicacao", 2, { ...input, confirmarEquivalencia: true }, 7)).rejects.toThrow("não estava");
    expect(mocks.tx.produto.findUnique).not.toHaveBeenCalled();
    expect(mocks.tx.aplicacaoProduto.update).not.toHaveBeenCalled();
  });
});
