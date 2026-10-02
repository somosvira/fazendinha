import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { apresentarFechamento, consumoAnimal, detalheFechamento, listarFechamentos } from "./consumo.js";
import { listarVigencias } from "./dietas.js";
import { prisma } from "../../../db.js";
vi.mock("../../../db.js", () => ({ prisma: { $transaction: vi.fn(), fechamentoConsumo: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() }, vigenciaDietaLote: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() }, animal: { findFirst: vi.fn() } } }));
const d = (s: string) => new Prisma.Decimal(s);
const detalhe = { id: "fechamento", loteId: "lote", propriedadeId: 1, vigenciaId: "vigencia", inicio: new Date("2026-09-01"), fim: new Date("2026-09-10"), animalDias: 3,
  centroCustoId: "centro", confirmadoEm: new Date(), status: "CONFIRMADO" as const, motivoEstorno: null, estornadoEm: null,
  lote: { id: "lote", nome: "Recria" }, centroCusto: { nome: "Leite" }, vigencia: { dieta: { nome: "Ração", versao: 1 } },
  participacoes: ["a", "b", "c"].map((animalId) => ({ id: animalId, fechamentoId: "fechamento", animalId, dias: 1, animal: { brinco: animalId } })),
  itens: [{ id: "item", fechamentoId: "fechamento", produtoId: "produto", quantidadePrevista: d("2"), quantidadeConfirmada: d("1"), baseQuantidade: "CONFERIDA", motivoAjuste: "Conferido", unidade: "KG", movimentoEstoqueId: "mov", modoEstoque: "BAIXA_ESTOQUE", justificativaSemBaixa: null, situacaoCusto: "CONHECIDO", produto: { nome: "Ração" }, movimentoEstoque: { id: "mov", quantidade: d("1"), valorTotal: d("0.05"), custoUnitario: d("0.05"), alocacaoPartidaEstoques: [] } }],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
    // O mock executa o mesmo callback de leitura sobre os delegates locais.
    return (fn as unknown as (tx: typeof prisma) => Promise<unknown>)(prisma);
  });
  vi.mocked(prisma.fechamentoConsumo.findMany).mockResolvedValue([detalhe]);
  vi.mocked(prisma.fechamentoConsumo.findFirst).mockResolvedValue(detalhe);
  vi.mocked(prisma.fechamentoConsumo.count).mockResolvedValue(121);
});

describe("consultas nutricionais", () => {
  it("oculta valores em todos os níveis sem permissão financeira, preservando quantidade", () => {
    const resposta = apresentarFechamento(detalhe, false);
    expect(resposta.custoConhecido).toBeNull();
    expect(resposta.itens[0].movimentoEstoque?.valorTotal).toBeNull();
    expect(resposta.itens[0].movimentoEstoque?.custoUnitario).toBeNull();
    expect(resposta.participacoes.every((p) => p.custoConhecido == null && p.custoConhecidoPorDia == null && p.itens.every((i) => i.custoConhecido == null))).toBe(true);
    expect(resposta.participacoes[0].itens[0].quantidadeAtribuida).toBe("0.334");
  });
  it("não interpreta valor zero de movimento sem base como custo conhecido", () => {
    const resposta = apresentarFechamento({ ...detalhe, itens: [{ ...detalhe.itens[0], situacaoCusto: "SEM_BASE", movimentoEstoque: { ...detalhe.itens[0].movimentoEstoque, valorTotal: d("0") } }] }, true);
    expect(resposta.custoConhecido).toBeNull();
    expect(resposta.coberturaCustoCompleta).toBe(false);
    expect(resposta.participacoes[0].custoConhecido).toBeNull();
  });
  it("pagina além de cem fechamentos e aplica sítio ao detalhe e à consulta individual", async () => {
    const lista = await listarFechamentos("lote", 1, { pagina: 6, limite: 25 }, true);
    expect(lista.total).toBe(121);
    expect(prisma.fechamentoConsumo.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 125, take: 25, where: { loteId: "lote", propriedadeId: 1 } }));
    await detalheFechamento("fechamento", 2, false);
    expect(prisma.fechamentoConsumo.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "fechamento", propriedadeId: 2 } }));
    // A autorização usa o histórico no sítio; o fechamento segue filtrado pelo local do fato.
    vi.mocked(prisma.animal.findFirst).mockResolvedValue({ id: "a" } as Awaited<ReturnType<typeof prisma.animal.findFirst>>);
    const animal = await consumoAnimal("a", 1, { pagina: 1, limite: 25 }, true);
    expect(animal.itens[0].custoConhecido).toBe("0.02");
    expect(animal.itens[0].itens[0].nome).toBe("Ração");
    expect(prisma.fechamentoConsumo.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { propriedadeId: 1, participacoes: { some: { animalId: "a" } } } }));
  });
  it("não expõe nutrição para animal fora do sítio e retorna erro recuperável no detalhe ausente", async () => {
    vi.mocked(prisma.animal.findFirst).mockResolvedValue(null);
    await expect(consumoAnimal("animal", 2, { pagina: 1, limite: 25 }, false)).rejects.toThrow(/neste sítio/);
    vi.mocked(prisma.fechamentoConsumo.findFirst).mockResolvedValue(null);
    await expect(detalheFechamento("inexistente", 1, false)).rejects.toThrow(/neste sítio/);
  });
  it("consulta dieta atual pelo intervalo semiaberto e programação pelo menor início futuro, fora da página", async () => {
    vi.mocked(prisma.vigenciaDietaLote.findMany).mockResolvedValue([]);
    vi.mocked(prisma.vigenciaDietaLote.count).mockResolvedValue(130);
    vi.mocked(prisma.vigenciaDietaLote.findFirst).mockResolvedValue(null);
    const pagina = await listarVigencias("lote", 1, { pagina: 6, limite: 25 });
    expect(pagina.total).toBe(130);
    expect(prisma.vigenciaDietaLote.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 125, take: 25 }));
    expect(prisma.vigenciaDietaLote.findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: expect.objectContaining({ desde: { lte: expect.any(Date) }, OR: [{ ate: null }, { ate: { gt: expect.any(Date) } }] }) }));
    expect(prisma.vigenciaDietaLote.findFirst).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: expect.objectContaining({ desde: { gt: expect.any(Date) } }), orderBy: [{ desde: "asc" }, { id: "asc" }] }));
  });
  it.each(["2026-10-31", "2026-11-01", "2026-11-02"])("usa o dia da fazenda antes, no dia e depois da troca: %s", async (data) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(`${data}T12:00:00Z`));
    try {
      vi.mocked(prisma.vigenciaDietaLote.findMany).mockResolvedValue([]);
      vi.mocked(prisma.vigenciaDietaLote.count).mockResolvedValue(2);
      vi.mocked(prisma.vigenciaDietaLote.findFirst).mockResolvedValue(null);
      await listarVigencias("lote", 1);
      expect(prisma.vigenciaDietaLote.findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: expect.objectContaining({ desde: { lte: new Date(data) }, OR: [{ ate: null }, { ate: { gt: new Date(data) } }] }) }));
    } finally { vi.useRealTimers(); }
  });
});
