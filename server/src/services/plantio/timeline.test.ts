import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  talhaoFindUnique: vi.fn(),
  operacaoFindUnique: vi.fn(),
  produtoFindUnique: vi.fn(),
  centroCustoFindFirst: vi.fn(),
  periodoFindUnique: vi.fn(),
  movimentoCreate: vi.fn(),
  movimentoUpdate: vi.fn(),
  movimentoFindUnique: vi.fn(),
  movimentoFindFirst: vi.fn(),
  movimentoFindMany: vi.fn(),
  movimentoGroupBy: vi.fn(),
  auditCreate: vi.fn(),
  queryRaw: vi.fn(),
  operacaoCreate: vi.fn(),
  operacaoUpdate: vi.fn(),
  operacaoDelete: vi.fn(),
  propriedadeFindFirst: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    talhao: { findUnique: mocks.talhaoFindUnique },
    operacaoAgricola: {
      findUnique: mocks.operacaoFindUnique,
      create: mocks.operacaoCreate,
      update: mocks.operacaoUpdate,
      delete: mocks.operacaoDelete,
      findMany: vi.fn().mockResolvedValue([]),
    },
    produto: { findUnique: mocks.produtoFindUnique },
    centroCusto: { findFirst: mocks.centroCustoFindFirst },
    periodoFinanceiro: { findUnique: mocks.periodoFindUnique },
    movimentoEstoque: { create: mocks.movimentoCreate, update: mocks.movimentoUpdate, findUnique: mocks.movimentoFindUnique, findFirst: mocks.movimentoFindFirst, findMany: mocks.movimentoFindMany, groupBy: mocks.movimentoGroupBy },
    propriedade: { findFirst: mocks.propriedadeFindFirst, count: vi.fn().mockResolvedValue(1) },
    inspecaoMIP: { findMany: vi.fn().mockResolvedValue([]) },
    amostraSolo: { findMany: vi.fn().mockResolvedValue([]) },
    amostraFoliar: { findMany: vi.fn().mockResolvedValue([]) },
    passadaColheita: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: mocks.transaction,
  },
}));

import { criarOperacao, editarOperacao, excluirOperacao, PlantioEventoError } from "./timeline.js";

const talhaoBase = {
  id: 1,
  codigo: "T1",
  propriedadeId: 5,
  areaHa: new Prisma.Decimal(10),
};

// Movimento APLICACAO já existente (SAIDA 20 kg de Ureia em 10/01, sem centro).
const movimentoExistente = {
  id: 88, produtoId: 3, tipo: "SAIDA", origem: "APLICACAO", status: "CONFIRMADO", data: new Date("2026-01-10"),
  quantidade: new Prisma.Decimal(20), custoUnitario: new Prisma.Decimal(2), valorTotal: new Prisma.Decimal(40),
  propriedadeId: 5, operacaoId: null, reversaoDeId: null, revertidoPor: null, centroCustoId: null, consumoPeriodoId: null,
};

const produtoUreia = { id: 3, nome: "Ureia", unidade: "KG", ativo: true, centrosCusto: [] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({
      produto: { findUnique: mocks.produtoFindUnique },
      centroCusto: { findFirst: mocks.centroCustoFindFirst },
      movimentoEstoque: { create: mocks.movimentoCreate, update: mocks.movimentoUpdate, findUnique: mocks.movimentoFindUnique, findFirst: mocks.movimentoFindFirst, findMany: mocks.movimentoFindMany, groupBy: mocks.movimentoGroupBy },
      operacaoAgricola: { create: mocks.operacaoCreate, update: mocks.operacaoUpdate, delete: mocks.operacaoDelete },
      periodoFinanceiro: { findUnique: mocks.periodoFindUnique },
      auditoriaFinanceira: { create: mocks.auditCreate },
      $queryRaw: mocks.queryRaw,
    }),
  );
  mocks.movimentoFindUnique.mockResolvedValue(movimentoExistente);
  mocks.movimentoFindFirst.mockResolvedValue(movimentoExistente);
  // Base do custo médio (agregada no banco): 100 kg por R$ 200,00 (custo médio 2).
  mocks.movimentoGroupBy.mockImplementation(async ({ where }: { where: { produtoId: { in: number[] } } }) => where.produtoId.in.map((produtoId) => ({
    produtoId, _sum: { quantidade: new Prisma.Decimal(100), valorTotal: new Prisma.Decimal(200) },
  })));
  mocks.movimentoCreate.mockResolvedValue({ id: 89, quantidade: new Prisma.Decimal(20) });
  mocks.queryRaw.mockResolvedValue([]);
  mocks.periodoFindUnique.mockResolvedValue(null);
  mocks.propriedadeFindFirst.mockResolvedValue({ id: 5 });
  mocks.centroCustoFindFirst.mockResolvedValue({ id: 9, ativo: true });
});

describe("criarOperacao", () => {
  it("cria SAIDA de estoque com quantidade = dose × área e grava movimentoEstoqueId", async () => {
    mocks.talhaoFindUnique.mockResolvedValue(talhaoBase);
    mocks.produtoFindUnique.mockResolvedValue({
      id: 3, nome: "Ureia", unidade: "KG", ativo: true, centrosCusto: [],
    });
    mocks.movimentoCreate.mockResolvedValue({ id: 88, quantidade: new Prisma.Decimal(20) });
    mocks.operacaoCreate.mockResolvedValue({
      id: 1, talhaoId: 1, tipo: "ADUBACAO_SOLO", data: new Date("2026-01-10"),
      produto: "Ureia", observacao: null, responsavel: null,
    });

    await criarOperacao(1, {
      dominio: "NUTRICAO", tipo: "ADUBACAO_SOLO", data: "2026-01-10",
      doseValor: 2, doseUnidade: "kg/ha", produtoId: 3,
    } as any);

    expect(mocks.movimentoCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tipo: "SAIDA", origem: "APLICACAO", propriedadeId: 5, talhaoId: 1, // vínculo sobrevive à exclusão da operação
        quantidade: expect.objectContaining({ toString: expect.any(Function) }),
      }),
    }));
    const criado = mocks.movimentoCreate.mock.calls[0][0].data;
    expect(Number(criado.quantidade)).toBe(20); // 2 kg/ha × 10 ha
    expect(mocks.operacaoCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ movimentoEstoqueId: 88 }),
    }));
  });

  it("usa a propriedade principal quando o talhão não tem propriedadeId", async () => {
    mocks.talhaoFindUnique.mockResolvedValue({ ...talhaoBase, propriedadeId: null });
    mocks.operacaoCreate.mockResolvedValue({ id: 2, talhaoId: 1, tipo: "PODA_DECOTE", data: new Date("2026-01-10") });

    await criarOperacao(1, { dominio: "FENOLOGIA", tipo: "PODA_DECOTE", data: "2026-01-10" } as any);

    // Principal (id 5, possivelmente já em cache) resolve o sítio do talhão sem propriedade.
    expect(mocks.periodoFindUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { propriedadeId_ano_mes: expect.objectContaining({ propriedadeId: 5 }) },
    }));
  });

  it("valoriza a SAIDA pelo custo médio das entradas do sítio do talhão", async () => {
    mocks.talhaoFindUnique.mockResolvedValue(talhaoBase);
    mocks.produtoFindUnique.mockResolvedValue(produtoUreia);
    // Compras 10×5 + 10×7 agregadas → base 20 kg / R$ 120.
    mocks.movimentoGroupBy.mockResolvedValue([{ produtoId: 3, _sum: { quantidade: new Prisma.Decimal(20), valorTotal: new Prisma.Decimal(120) } }]);
    mocks.operacaoCreate.mockResolvedValue({ id: 1, talhaoId: 1, tipo: "ADUBACAO_SOLO", data: new Date("2026-01-10") });

    await criarOperacao(1, { dominio: "NUTRICAO", tipo: "ADUBACAO_SOLO", data: "2026-01-10", doseValor: 2, doseUnidade: "kg/ha", produtoId: 3 } as any);

    const criado = mocks.movimentoCreate.mock.calls[0][0].data;
    expect(Number(criado.custoUnitario)).toBe(6);
    expect(Number(criado.valorTotal)).toBe(120); // 20 kg × 6
  });

  it("produto sem estoque no sítio do talhão → registra a operação sem SAIDA", async () => {
    mocks.talhaoFindUnique.mockResolvedValue(talhaoBase);
    mocks.produtoFindUnique.mockResolvedValue(produtoUreia);
    mocks.movimentoFindFirst.mockResolvedValue(null); // nenhuma entrada/ajuste confirmado no sítio
    mocks.operacaoCreate.mockResolvedValue({ id: 1, talhaoId: 1, tipo: "ADUBACAO_SOLO", data: new Date("2026-01-10") });

    await criarOperacao(1, { dominio: "NUTRICAO", tipo: "ADUBACAO_SOLO", data: "2026-01-10", doseValor: 2, doseUnidade: "kg/ha", produtoId: 3 } as any);

    expect(mocks.movimentoFindFirst).toHaveBeenCalledWith({
      where: {
        produtoId: 3, status: "CONFIRMADO", reversaoDeId: null,
        AND: [{ OR: [{ tipo: "ENTRADA" }, { tipo: "AJUSTE", quantidade: { gt: 0 } }] }, { OR: [{ propriedadeId: 5 }, { propriedadeId: null }] }],
      },
      select: { id: true },
    });
    expect(mocks.movimentoCreate).not.toHaveBeenCalled();
    expect(mocks.operacaoCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ produtoId: 3 }) }));
  });

  it("produto sem estoque no sítio → devolve aviso; com baixa não devolve", async () => {
    mocks.talhaoFindUnique.mockResolvedValue(talhaoBase);
    mocks.produtoFindUnique.mockResolvedValue(produtoUreia);
    mocks.operacaoCreate.mockResolvedValue({ id: 1, talhaoId: 1, tipo: "ADUBACAO_SOLO", data: new Date("2026-01-10") });
    const op = { dominio: "NUTRICAO", tipo: "ADUBACAO_SOLO", data: "2026-01-10", doseValor: 2, doseUnidade: "kg/ha", produtoId: 3 } as any;

    mocks.movimentoFindFirst.mockResolvedValue(null);
    expect(await criarOperacao(1, op)).toEqual(expect.objectContaining({ aviso: expect.stringMatching(/sem baixa de estoque/i) }));

    mocks.movimentoFindFirst.mockResolvedValue(movimentoExistente);
    expect(await criarOperacao(1, op)).not.toHaveProperty("aviso");
  });

  it("sem quantidade (dose sem unidade) não avisa falta de estoque", async () => {
    mocks.talhaoFindUnique.mockResolvedValue(talhaoBase);
    mocks.produtoFindUnique.mockResolvedValue(produtoUreia);
    mocks.movimentoFindFirst.mockResolvedValue(null);
    mocks.operacaoCreate.mockResolvedValue({ id: 1, talhaoId: 1, tipo: "ADUBACAO_SOLO", data: new Date("2026-01-10") });
    expect(await criarOperacao(1, { dominio: "NUTRICAO", tipo: "ADUBACAO_SOLO", data: "2026-01-10", doseValor: 2, produtoId: 3 } as any)).not.toHaveProperty("aviso");
  });

  it("sem base de custo, a SAIDA sai com custo 0", async () => {
    mocks.talhaoFindUnique.mockResolvedValue(talhaoBase);
    mocks.produtoFindUnique.mockResolvedValue(produtoUreia);
    mocks.movimentoGroupBy.mockResolvedValue([]);
    mocks.operacaoCreate.mockResolvedValue({ id: 1, talhaoId: 1, tipo: "ADUBACAO_SOLO", data: new Date("2026-01-10") });

    await criarOperacao(1, { dominio: "NUTRICAO", tipo: "ADUBACAO_SOLO", data: "2026-01-10", doseValor: 2, doseUnidade: "kg/ha", produtoId: 3 } as any);

    const criado = mocks.movimentoCreate.mock.calls[0][0].data;
    expect(Number(criado.custoUnitario)).toBe(0);
    expect(Number(criado.valorTotal)).toBe(0);
  });

  it("rejeita centroCustoId inexistente", async () => {
    mocks.talhaoFindUnique.mockResolvedValue(talhaoBase);
    mocks.produtoFindUnique.mockResolvedValue({
      id: 3, nome: "Ureia", unidade: "KG", ativo: true, centrosCusto: [],
    });
    mocks.centroCustoFindFirst.mockResolvedValue(null);

    await expect(
      criarOperacao(1, {
        dominio: "NUTRICAO", tipo: "ADUBACAO_SOLO", data: "2026-01-10",
        doseValor: 2, doseUnidade: "kg/ha", produtoId: 3, centroCustoId: 999,
      } as any),
    ).rejects.toEqual(expect.objectContaining({ code: "NAO_ENCONTRADO" }));
  });

  it("dose com unidade legada não reconhecida rejeita em vez de salvar sem baixa", async () => {
    mocks.talhaoFindUnique.mockResolvedValue(talhaoBase);
    mocks.produtoFindUnique.mockResolvedValue(produtoUreia);

    await expect(
      criarOperacao(1, { dominio: "NUTRICAO", tipo: "ADUBACAO_SOLO", data: "2026-01-10", doseValor: 2, doseUnidade: "lt/ha", produtoId: 3 } as any),
    ).rejects.toEqual(expect.objectContaining({ code: "VALIDACAO" }));
    expect(mocks.movimentoCreate).not.toHaveBeenCalled();
    expect(mocks.operacaoCreate).not.toHaveBeenCalled();
  });

  it("dose com unidade legada reconhecida continua funcionando normalmente", async () => {
    mocks.talhaoFindUnique.mockResolvedValue(talhaoBase);
    mocks.produtoFindUnique.mockResolvedValue(produtoUreia);
    mocks.operacaoCreate.mockResolvedValue({ id: 1, talhaoId: 1, tipo: "ADUBACAO_SOLO", data: new Date("2026-01-10") });

    await criarOperacao(1, { dominio: "NUTRICAO", tipo: "ADUBACAO_SOLO", data: "2026-01-10", doseValor: 2, doseUnidade: "kg/ha", produtoId: 3 } as any);

    expect(mocks.movimentoCreate).toHaveBeenCalled();
    expect(mocks.operacaoCreate).toHaveBeenCalled();
  });

  it("sem doseUnidade nenhuma continua sem baixar e sem erro", async () => {
    mocks.talhaoFindUnique.mockResolvedValue(talhaoBase);
    mocks.produtoFindUnique.mockResolvedValue(produtoUreia);
    mocks.operacaoCreate.mockResolvedValue({ id: 1, talhaoId: 1, tipo: "ADUBACAO_SOLO", data: new Date("2026-01-10") });

    await criarOperacao(1, { dominio: "NUTRICAO", tipo: "ADUBACAO_SOLO", data: "2026-01-10", doseValor: 2, produtoId: 3 } as any);

    expect(mocks.movimentoCreate).not.toHaveBeenCalled();
    expect(mocks.operacaoCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ movimentoEstoqueId: null }),
    }));
  });

  it("preserva quantidadeTotal informado quando não há baixa de estoque", async () => {
    mocks.talhaoFindUnique.mockResolvedValue(talhaoBase);
    mocks.operacaoCreate.mockResolvedValue({ id: 4, talhaoId: 1, tipo: "IRRIGACAO", data: new Date("2026-01-10") });

    await criarOperacao(1, {
      dominio: "FENOLOGIA", tipo: "IRRIGACAO", data: "2026-01-10", quantidadeTotal: 40,
    } as any);

    expect(mocks.operacaoCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ quantidadeTotal: 40, movimentoEstoqueId: null }),
    }));
  });
});

describe("editarOperacao", () => {
  const existenteBase = {
    id: 10,
    talhaoId: 1,
    tipo: "ADUBACAO_SOLO",
    data: new Date("2026-01-10"),
    responsavel: null,
    produto: "Ureia",
    observacao: null,
    doseValor: new Prisma.Decimal(2),
    doseUnidade: "kg/ha",
    pragaAlvo: null,
    produtoId: 3,
    quantidadeTotal: new Prisma.Decimal(20),
    movimentoEstoqueId: 88,
    talhao: talhaoBase,
  };

  const inversoCriado = () => mocks.movimentoCreate.mock.calls.map((c) => c[0].data).find((d) => d.reversaoDeId === 88);
  const novoCriado = () => mocks.movimentoCreate.mock.calls.map((c) => c[0].data).find((d) => d.reversaoDeId === undefined);

  it("estorna o movimento (não apaga) quando a edição remove o produtoId", async () => {
    mocks.operacaoFindUnique.mockResolvedValue(existenteBase);
    mocks.operacaoUpdate.mockResolvedValue({ id: 10, talhaoId: 1, tipo: "ADUBACAO_SOLO", data: new Date("2026-01-10") });

    await editarOperacao(10, { produtoId: null } as any);

    expect(inversoCriado()).toEqual(expect.objectContaining({ tipo: "ENTRADA", reversaoDeId: 88, observacao: "Estorno: operação agrícola #10 editada" }));
    expect(Number(inversoCriado().quantidade)).toBe(20);
    expect(mocks.movimentoUpdate).toHaveBeenCalledWith({ where: { id: 88 }, data: { status: "REVERTIDO" } });
    expect(novoCriado()).toBeUndefined();
    expect(mocks.operacaoUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ movimentoEstoqueId: null }),
    }));
  });

  it("edição que muda a quantidade estorna o antigo e cria um novo movimento", async () => {
    mocks.operacaoFindUnique.mockResolvedValue(existenteBase);
    mocks.produtoFindUnique.mockResolvedValue(produtoUreia);
    mocks.operacaoUpdate.mockResolvedValue({ id: 10, talhaoId: 1, tipo: "ADUBACAO_SOLO", data: new Date("2026-01-10") });
    mocks.movimentoCreate
      .mockResolvedValueOnce({ id: 200, quantidade: new Prisma.Decimal(20) }) // inverso
      .mockResolvedValueOnce({ id: 201, quantidade: new Prisma.Decimal(30) }); // novo

    await editarOperacao(10, { quantidadeTotal: 30 } as any);

    expect(inversoCriado()).toEqual(expect.objectContaining({ reversaoDeId: 88, tipo: "ENTRADA" }));
    expect(mocks.movimentoUpdate).toHaveBeenCalledWith({ where: { id: 88 }, data: { status: "REVERTIDO" } });
    expect(novoCriado()).toEqual(expect.objectContaining({ tipo: "SAIDA", origem: "APLICACAO", produtoId: 3 }));
    expect(Number(novoCriado().quantidade)).toBe(30);
    expect(mocks.operacaoUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ movimentoEstoqueId: 201 }),
    }));
  });

  it("edição que muda só o responsável não mexe no movimento", async () => {
    mocks.operacaoFindUnique.mockResolvedValue(existenteBase);
    mocks.produtoFindUnique.mockResolvedValue(produtoUreia);
    mocks.operacaoUpdate.mockResolvedValue({ id: 10, talhaoId: 1, tipo: "ADUBACAO_SOLO", data: new Date("2026-01-10") });

    await editarOperacao(10, { responsavel: "João" } as any);

    expect(mocks.movimentoCreate).not.toHaveBeenCalled();
    expect(mocks.movimentoUpdate).not.toHaveBeenCalled();
    expect(mocks.operacaoUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ movimentoEstoqueId: 88, responsavel: "João" }),
    }));
  });

  it("rejeita mudar a data para um mês fechado", async () => {
    mocks.operacaoFindUnique.mockResolvedValue(existenteBase);
    mocks.periodoFindUnique.mockImplementation(async ({ where }: any) => {
      return where.propriedadeId_ano_mes.mes === 2 ? { status: "FECHADO" } : null;
    });

    await expect(editarOperacao(10, { data: "2026-02-05" } as any)).rejects.toEqual(
      expect.objectContaining({ code: "MES_FECHADO" }),
    );
  });

  it("rejeita edição quando o mês ORIGINAL da operação está fechado", async () => {
    mocks.operacaoFindUnique.mockResolvedValue(existenteBase);
    mocks.periodoFindUnique.mockImplementation(async ({ where }: any) => {
      return where.propriedadeId_ano_mes.mes === 1 ? { status: "FECHADO" } : null;
    });

    await expect(editarOperacao(10, { data: "2026-02-05" } as any)).rejects.toEqual(
      expect.objectContaining({ code: "MES_FECHADO" }),
    );
  });

  // Produto pertence a 2 centros (ambíguo) — só o centro explícito gravado no
  // movimento anterior (ou no input) deve valer; nunca a inferência do produto.
  describe("centro de custo preservado (produto com múltiplos centros)", () => {
    const movimentoComCentro = {
      id: 88, produtoId: 3, quantidade: new Prisma.Decimal(20), custoUnitario: new Prisma.Decimal(2), valorTotal: new Prisma.Decimal(40),
      data: new Date("2026-01-10"), centroCustoId: 5, propriedadeId: 5, tipo: "SAIDA", origem: "APLICACAO", status: "CONFIRMADO",
      operacaoId: null, reversaoDeId: null, revertidoPor: null, consumoPeriodoId: null,
    };
    const produtoDoisCentros = {
      id: 3, nome: "Ureia", unidade: "KG", ativo: true,
      centrosCusto: [{ centroCustoId: 10 }, { centroCustoId: 20 }],
    };

    beforeEach(() => {
      mocks.movimentoFindUnique.mockResolvedValue(movimentoComCentro);
      mocks.movimentoFindFirst.mockResolvedValue(movimentoComCentro);
      mocks.produtoFindUnique.mockResolvedValue(produtoDoisCentros);
    });

    it("PATCH só { responsavel } preserva o centro 5 anterior — nenhum estorno nem novo movimento", async () => {
      mocks.operacaoFindUnique.mockResolvedValue(existenteBase);
      mocks.operacaoUpdate.mockResolvedValue({ id: 10, talhaoId: 1, tipo: "ADUBACAO_SOLO", data: new Date("2026-01-10") });

      await editarOperacao(10, { responsavel: "João" } as any);

      expect(mocks.movimentoCreate).not.toHaveBeenCalled();
      expect(mocks.movimentoUpdate).not.toHaveBeenCalled();
      expect(mocks.operacaoUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ movimentoEstoqueId: 88, responsavel: "João" }),
      }));
    });

    it("PATCH { observacao } com centro anterior desativado não falha — centro herdado não é revalidado", async () => {
      mocks.operacaoFindUnique.mockResolvedValue(existenteBase);
      mocks.operacaoUpdate.mockResolvedValue({ id: 10, talhaoId: 1, tipo: "ADUBACAO_SOLO", data: new Date("2026-01-10") });
      mocks.centroCustoFindFirst.mockResolvedValue(null); // centro 5 foi desativado depois

      await editarOperacao(10, { observacao: "nova obs" } as any);

      expect(mocks.centroCustoFindFirst).not.toHaveBeenCalled();
      expect(mocks.movimentoCreate).not.toHaveBeenCalled();
      expect(mocks.movimentoUpdate).not.toHaveBeenCalled();
      expect(mocks.operacaoUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ movimentoEstoqueId: 88, observacao: "nova obs" }),
      }));
    });

    it("PATCH { produtoId: B } sem centroCustoId não herda o centro do produto A — resolve o centro único de B", async () => {
      const produtoB = { id: 7, nome: "Boro", unidade: "KG", ativo: true, centrosCusto: [{ centroCustoId: 42 }] };
      mocks.operacaoFindUnique.mockResolvedValue(existenteBase);
      mocks.produtoFindUnique.mockResolvedValue(produtoB);
      mocks.operacaoUpdate.mockResolvedValue({ id: 10, talhaoId: 1, tipo: "ADUBACAO_SOLO", data: new Date("2026-01-10") });
      mocks.movimentoCreate
        .mockResolvedValueOnce({ id: 400, quantidade: new Prisma.Decimal(20) }) // inverso
        .mockResolvedValueOnce({ id: 401, quantidade: new Prisma.Decimal(20) }); // novo, produto B

      await editarOperacao(10, { produtoId: 7 } as any);

      expect(mocks.centroCustoFindFirst).not.toHaveBeenCalled(); // centro não veio do input, não é validado
      const novo = mocks.movimentoCreate.mock.calls.map((c) => c[0].data).find((d) => d.reversaoDeId === undefined);
      expect(novo).toEqual(expect.objectContaining({ produtoId: 7, centroCustoId: 42 }));
    });

    it("PATCH { centroCustoId: null } explícito estorna o movimento com centro 5 e recria sem centro", async () => {
      mocks.operacaoFindUnique.mockResolvedValue(existenteBase);
      mocks.operacaoUpdate.mockResolvedValue({ id: 10, talhaoId: 1, tipo: "ADUBACAO_SOLO", data: new Date("2026-01-10") });
      mocks.movimentoCreate
        .mockResolvedValueOnce({ id: 200, quantidade: new Prisma.Decimal(20) }) // inverso
        .mockResolvedValueOnce({ id: 300, quantidade: new Prisma.Decimal(20) }); // novo, sem centro

      await editarOperacao(10, { centroCustoId: null } as any);

      expect(mocks.movimentoUpdate).toHaveBeenCalledWith({ where: { id: 88 }, data: { status: "REVERTIDO" } });
      const novo = mocks.movimentoCreate.mock.calls.map((c) => c[0].data).find((d) => d.reversaoDeId === undefined);
      expect(novo).toEqual(expect.objectContaining({ centroCustoId: null }));
      expect(mocks.operacaoUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ movimentoEstoqueId: 300 }),
      }));
    });
  });
});

describe("editarOperacao — decisão de baixa estável (não segue o estado atual do estoque)", () => {
  const existente = (movimentoEstoqueId: number | null) => ({
    id: 10, talhaoId: 1, tipo: "ADUBACAO_SOLO", data: new Date("2026-01-10"), responsavel: null, produto: "Ureia", observacao: null,
    doseValor: new Prisma.Decimal(2), doseUnidade: "kg/ha", pragaAlvo: null, produtoId: 3,
    quantidadeTotal: movimentoEstoqueId != null ? new Prisma.Decimal(20) : null,
    movimentoEstoqueId, talhao: talhaoBase,
  });
  // findFirst serve a produtoTemEstoque (where com AND) e ao estorno (where com id).
  const estoqueAtual = (tem: boolean) => mocks.movimentoFindFirst.mockImplementation(async ({ where }: any) =>
    where.AND ? (tem ? { id: 1 } : null) : movimentoExistente);
  const consultasEstoque = () => mocks.movimentoFindFirst.mock.calls.filter(([args]) => args.where.AND);

  beforeEach(() => {
    mocks.produtoFindUnique.mockResolvedValue(produtoUreia);
    mocks.operacaoUpdate.mockResolvedValue({ id: 10, talhaoId: 1, tipo: "ADUBACAO_SOLO", data: new Date("2026-01-10") });
  });

  it("(A) operação com baixa, compra estornada depois: editar só a observação mantém a baixa", async () => {
    mocks.operacaoFindUnique.mockResolvedValue(existente(88));
    estoqueAtual(false);

    const r = await editarOperacao(10, { observacao: "reaplicar na bordadura" } as any);

    expect(consultasEstoque()).toHaveLength(0);
    expect(mocks.movimentoCreate).not.toHaveBeenCalled();
    expect(mocks.movimentoUpdate).not.toHaveBeenCalled();
    expect(mocks.operacaoUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ movimentoEstoqueId: 88 }) }));
    expect(r).not.toHaveProperty("aviso");
  });

  it("(A') operação com baixa do mesmo produto: mudar a quantidade refaz a baixa mesmo sem estoque atual", async () => {
    mocks.operacaoFindUnique.mockResolvedValue(existente(88));
    estoqueAtual(false);
    mocks.movimentoCreate
      .mockResolvedValueOnce({ id: 200, quantidade: new Prisma.Decimal(20) }) // inverso
      .mockResolvedValueOnce({ id: 201, quantidade: new Prisma.Decimal(30) }); // novo

    await editarOperacao(10, { quantidadeTotal: 30 } as any);

    expect(consultasEstoque()).toHaveLength(0);
    expect(mocks.movimentoUpdate).toHaveBeenCalledWith({ where: { id: 88 }, data: { status: "REVERTIDO" } });
    const novo = mocks.movimentoCreate.mock.calls.map((c) => c[0].data).find((d) => d.reversaoDeId === undefined);
    expect(Number(novo.quantidade)).toBe(30);
  });

  it("(B) operação sem baixa, compra chega depois: editar só a observação NÃO cria SAIDA retroativa", async () => {
    mocks.operacaoFindUnique.mockResolvedValue(existente(null));
    estoqueAtual(true);

    const r = await editarOperacao(10, { observacao: "nova obs" } as any);

    expect(consultasEstoque()).toHaveLength(0);
    expect(mocks.movimentoCreate).not.toHaveBeenCalled();
    expect(mocks.operacaoUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ movimentoEstoqueId: null }) }));
    expect(r).not.toHaveProperty("aviso");
  });

  it("(B) formulário completo reenviado com os mesmos valores também não cria SAIDA", async () => {
    mocks.operacaoFindUnique.mockResolvedValue(existente(null));
    estoqueAtual(true);

    await editarOperacao(10, { tipo: "ADUBACAO_SOLO", data: "2026-01-10", produtoId: 3, doseValor: 2, doseUnidadeMedida: "KG", dosePorHectare: true, quantidadeTotal: null, observacao: "x" } as any);

    expect(consultasEstoque()).toHaveLength(0);
    expect(mocks.movimentoCreate).not.toHaveBeenCalled();
  });

  it("(B') operação sem baixa: mudar a dose recalcula pelo estoque atual e cria a baixa", async () => {
    mocks.operacaoFindUnique.mockResolvedValue(existente(null));
    estoqueAtual(true);

    await editarOperacao(10, { doseValor: 3 } as any);

    expect(consultasEstoque()).toHaveLength(1);
    expect(mocks.movimentoCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ tipo: "SAIDA", origem: "APLICACAO", produtoId: 3 }) });
  });

  it("trocar para produto sem estoque no sítio estorna a baixa antiga e avisa", async () => {
    mocks.operacaoFindUnique.mockResolvedValue(existente(88));
    mocks.produtoFindUnique.mockResolvedValue({ id: 7, nome: "Boro", unidade: "KG", ativo: true, centrosCusto: [] });
    estoqueAtual(false);

    const r = await editarOperacao(10, { produtoId: 7 } as any);

    expect(consultasEstoque()).toHaveLength(1);
    expect(mocks.movimentoUpdate).toHaveBeenCalledWith({ where: { id: 88 }, data: { status: "REVERTIDO" } });
    expect(mocks.movimentoCreate).toHaveBeenCalledTimes(1); // só o inverso
    expect(r).toEqual(expect.objectContaining({ aviso: expect.stringMatching(/sem baixa de estoque/i) }));
  });
});

describe("excluirOperacao", () => {
  it("estorna o movimento e apaga a operação agrícola", async () => {
    mocks.operacaoFindUnique.mockResolvedValue({ id: 10, data: new Date("2026-01-10"), movimentoEstoqueId: 88, talhao: { propriedadeId: 5 } });

    await excluirOperacao(10);

    expect(mocks.movimentoCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ reversaoDeId: 88, tipo: "ENTRADA", observacao: "Estorno: operação agrícola #10 excluída" }) });
    expect(mocks.movimentoUpdate).toHaveBeenCalledWith({ where: { id: 88 }, data: { status: "REVERTIDO" } });
    expect(mocks.operacaoDelete).toHaveBeenCalledWith({ where: { id: 10 } });
  });

  it("sem movimento vinculado só apaga a operação", async () => {
    mocks.operacaoFindUnique.mockResolvedValue({ id: 11, data: new Date("2026-01-10"), movimentoEstoqueId: null, talhao: { propriedadeId: 5 } });
    await excluirOperacao(11);
    expect(mocks.movimentoCreate).not.toHaveBeenCalled();
    expect(mocks.operacaoDelete).toHaveBeenCalledWith({ where: { id: 11 } });
  });

  it("recusa em mês fechado", async () => {
    mocks.operacaoFindUnique.mockResolvedValue({ id: 10, data: new Date("2026-01-10"), movimentoEstoqueId: 88, talhao: { propriedadeId: 5 } });
    mocks.periodoFindUnique.mockResolvedValue({ status: "FECHADO" });
    await expect(excluirOperacao(10)).rejects.toEqual(expect.objectContaining({ code: "MES_FECHADO" }));
    expect(mocks.operacaoDelete).not.toHaveBeenCalled();
  });
});

describe("produto inativo na aplicação agrícola", () => {
  it("não entra em operação nova", async () => {
    mocks.talhaoFindUnique.mockResolvedValue(talhaoBase);
    mocks.produtoFindUnique.mockResolvedValue({ id: 3, nome: "Ureia", unidade: "KG", ativo: false, centrosCusto: [] });
    await expect(criarOperacao(1, { dominio: "NUTRICAO", tipo: "ADUBACAO_SOLO", data: "2026-01-10", doseValor: 2, doseUnidade: "kg/ha", produtoId: 3 } as any))
      .rejects.toMatchObject({ code: "VALIDACAO", message: expect.stringContaining("inativo") });
    expect(mocks.movimentoCreate).not.toHaveBeenCalled();
  });

  it("a operação que já usava o produto continua editável", async () => {
    mocks.operacaoFindUnique.mockResolvedValue({
      id: 10, talhaoId: 1, tipo: "ADUBACAO_SOLO", data: new Date("2026-01-10"), responsavel: null, produto: "Ureia", observacao: null,
      doseValor: new Prisma.Decimal(2), doseUnidade: "kg/ha", pragaAlvo: null, produtoId: 3, quantidadeTotal: null, movimentoEstoqueId: null, talhao: talhaoBase,
    });
    mocks.produtoFindUnique.mockResolvedValue({ id: 3, nome: "Ureia", unidade: "KG", ativo: false, centrosCusto: [] });
    mocks.operacaoUpdate.mockResolvedValue({ id: 10, talhaoId: 1, tipo: "ADUBACAO_SOLO", data: new Date("2026-01-10") });
    await expect(editarOperacao(10, { observacao: "revisado" } as any)).resolves.toBeTruthy();
  });
});
