import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({ operacao: vi.fn(), aplicacoes: vi.fn(), exames: vi.fn(), execucoes: vi.fn() }));
vi.mock("../../../db.js", () => ({ prisma: {
  operacao: { findFirst: mocks.operacao }, aplicacaoProduto: { findMany: mocks.aplicacoes },
  exameAnimal: { findMany: mocks.exames }, execucaoProtocoloSanitario: { findMany: mocks.execucoes },
} }));
import { listarOrigemFinanceira } from "./origem-financeira.js";

beforeEach(() => { vi.clearAllMocks(); mocks.exames.mockResolvedValue([]); mocks.execucoes.mockResolvedValue([]); });

describe("origem financeira dos fatos sanitários", () => {
  it("distingue destinação válida da anulada sem criar nova despesa", async () => {
    mocks.operacao.mockResolvedValue({ id: "op", tipo: "COMPRA_CONSUMO_DIRETO", propriedadeId: 1, valorTotal: new Prisma.Decimal(100),
      itens: [{ id: "item", descricao: "Vacina", quantidade: new Prisma.Decimal(50), unidade: "ML", produtoId: "produto", estocavel: false }] });
    const base = { animalId: "animal", animal: { brinco: "RN01" }, data: new Date("2026-09-10"), nomeProdutoAplicado: "Vacina", origemInsumo: "COMPRA_CONSUMO_DIRETO", itemCompraDiretaId: "item", valorProdutoAtribuido: new Prisma.Decimal(20), valorServicoAtribuido: null, operacaoServicoId: null };
    mocks.aplicacoes.mockResolvedValue([
      { ...base, id: "aplicacao", status: "VALIDO", quantidadeCompraDireta: new Prisma.Decimal(10) },
      { ...base, id: "anulada", status: "ANULADO", quantidadeCompraDireta: new Prisma.Decimal(5) },
    ]);
    const resultado = await listarOrigemFinanceira("op", 1);
    expect(resultado.itensDiretos).toEqual([{ id: "item", descricao: "Vacina", unidade: "ML", quantidadeComprada: "50", quantidadeDestinada: "10", quantidadeDisponivel: "40" }]);
    expect(resultado.fatos[0]).toMatchObject({ id: "aplicacao", animalBrinco: "RN01", custoProduto: "20", rateioServico: null });
    expect(mocks.operacao).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "op", propriedadeId: 1 } }));
  });

  it("não mistura outra operação nem outro sítio", async () => {
    mocks.operacao.mockResolvedValue(null);
    await expect(listarOrigemFinanceira("op", 2)).rejects.toThrow(/não encontrada neste sítio/);
    expect(mocks.aplicacoes).not.toHaveBeenCalled();
  });
});
