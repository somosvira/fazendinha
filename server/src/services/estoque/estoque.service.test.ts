import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  produtoFindUnique: vi.fn(),
  produtoFindFirst: vi.fn(),
  centroFindFirst: vi.fn(),
  periodoFindUnique: vi.fn(),
  movFindMany: vi.fn(),
  movCount: vi.fn(),
  movGroupBy: vi.fn(),
  produtoFindMany: vi.fn(),
  movFindFirst: vi.fn(),
  movCreate: vi.fn(),
  movUpdate: vi.fn(),
  opCreate: vi.fn(),
  auditCreate: vi.fn(),
  queryRaw: vi.fn(),
  transaction: vi.fn(),
  propriedadePrincipalId: vi.fn(),
}));

vi.mock("../../db.js", () => ({ prisma: {
  $transaction: mocks.transaction,
  produto: { findMany: mocks.produtoFindMany },
  movimentoEstoque: { groupBy: mocks.movGroupBy, findMany: mocks.movFindMany, count: mocks.movCount },
} }));
vi.mock("../propriedade.js", () => ({ propriedadePrincipalId: mocks.propriedadePrincipalId, escopoPadraoLeitura: vi.fn().mockResolvedValue(1) }));

import { ajustarContagem, estornarMovimentoTx, listarMovimentos, listarSaldos, produtosComEstoque, produtoTemEstoque, registrarMovimento } from "./estoque.js";

const tx = () => ({
  produto: { findUnique: mocks.produtoFindUnique, findFirst: mocks.produtoFindFirst },
  centroCusto: { findFirst: mocks.centroFindFirst },
  periodoFinanceiro: { findUnique: mocks.periodoFindUnique },
  movimentoEstoque: { findMany: mocks.movFindMany, groupBy: mocks.movGroupBy, findFirst: mocks.movFindFirst, create: mocks.movCreate, update: mocks.movUpdate },
  operacao: { create: mocks.opCreate },
  auditoriaFinanceira: { create: mocks.auditCreate },
  $queryRaw: mocks.queryRaw,
});

const produto = { id: 3, nome: "Ureia", unidade: "KG", ativo: true, centrosCusto: [{ centroCustoId: 9 }, { centroCustoId: 11 }] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx()));
  mocks.produtoFindUnique.mockResolvedValue(produto);
  mocks.produtoFindFirst.mockResolvedValue(produto);
  mocks.centroFindFirst.mockResolvedValue({ id: 11, ativo: true });
  mocks.periodoFindUnique.mockResolvedValue(null);
  mocks.opCreate.mockResolvedValue({ id: 50, itens: [{ id: 51 }] });
  mocks.movCreate.mockResolvedValue({ id: 100, quantidade: new Prisma.Decimal(1) });
  mocks.movUpdate.mockResolvedValue({});
  mocks.auditCreate.mockResolvedValue({});
  mocks.queryRaw.mockResolvedValue([]);
  mocks.propriedadePrincipalId.mockResolvedValue(1);
  mocks.movGroupBy.mockResolvedValue([]);
  mocks.movFindFirst.mockResolvedValue({ id: 1 }); // por padrão o produto tem estoque no sítio
});

describe("ajustarContagem", () => {
  it("propaga o centro de custo escolhido ao movimento e audita", async () => {
    mocks.movFindMany.mockResolvedValue([{ tipo: "ENTRADA", quantidade: new Prisma.Decimal(10) }]);
    await ajustarContagem({ produtoId: 3, quantidadeContada: 8, saldoEsperado: 10, observacao: "Contagem física", propriedadeId: 1, centroCustoId: 11, usuarioId: 7 });
    expect(mocks.movCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ tipo: "AJUSTE", origem: "AJUSTE_INVENTARIO", centroCustoId: 11, quantidade: -2, criadoPorId: 7, propriedadeId: 1 }) });
    expect(mocks.opCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tipo: "AJUSTE_ESTOQUE", criadoPorId: 7 }) }));
    expect(mocks.auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ entidade: "Operacao", entidadeId: "50", acao: "AJUSTE_CONTAGEM", usuarioId: 7 }) });
  });

  it("saldo real de 1,005 (3 casas) casa com saldoEsperado: 1.005 informado pelo client — antes dava CONFLITO por arredondar a 2 casas", async () => {
    mocks.movFindMany.mockResolvedValue([{ tipo: "ENTRADA", quantidade: new Prisma.Decimal("1.005") }]);
    await expect(
      ajustarContagem({ produtoId: 3, quantidadeContada: 2.005, saldoEsperado: 1.005, observacao: "Contagem física", propriedadeId: 1, usuarioId: 7 }),
    ).resolves.toMatchObject({ saldoAnterior: 1.005, diferenca: 1 });
    expect(mocks.movCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ quantidade: 1 }) });
  });

  it("saldoEsperado divergente do saldo real (mesmo em 3 casas) continua CONFLITO", async () => {
    mocks.movFindMany.mockResolvedValue([{ tipo: "ENTRADA", quantidade: new Prisma.Decimal("1.005") }]);
    await expect(
      ajustarContagem({ produtoId: 3, quantidadeContada: 2, saldoEsperado: 1.01, observacao: "Contagem física", propriedadeId: 1, usuarioId: 7 }),
    ).rejects.toMatchObject({ code: "CONFLITO" });
  });
});

describe("registrarMovimento", () => {
  it("grava criadoPorId e audita AJUSTE_MANUAL", async () => {
    await registrarMovimento({ produtoId: 3, tipo: "AJUSTE", data: "2026-01-10", quantidade: 5, observacao: "Sobrou no galpão", propriedadeId: 1, usuarioId: 7 });
    expect(mocks.opCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ criadoPorId: 7 }) }));
    expect(mocks.movCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ criadoPorId: 7, operacaoId: 50 }) });
    expect(mocks.auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ entidade: "Operacao", entidadeId: "50", acao: "AJUSTE_MANUAL", usuarioId: 7 }) });
  });
  it("sem custo informado, valoriza o ajuste pela base do custo médio do sítio (groupBy no banco)", async () => {
    // Duas compras 10×5 + 10×7 agregadas pelo banco → base 20 / R$ 120.
    mocks.movGroupBy.mockResolvedValue([{ produtoId: 3, _sum: { quantidade: new Prisma.Decimal(20), valorTotal: new Prisma.Decimal(120) } }]);
    await registrarMovimento({ produtoId: 3, tipo: "AJUSTE", data: "2026-01-10", quantidade: 5, observacao: "Sobrou no galpão", propriedadeId: 1 });
    const args = mocks.movGroupBy.mock.calls[0][0];
    expect(args.by).toEqual(["produtoId"]);
    expect(args._sum).toEqual({ quantidade: true, valorTotal: true });
    // Filtro espelha entraNoCustoMedio: confirmados, sem estorno, quantidade e valor > 0.
    expect(args.where).toEqual(expect.objectContaining({ produtoId: { in: [3] }, status: "CONFIRMADO", reversaoDeId: null, quantidade: { gt: 0 }, valorTotal: { gt: 0 } }));
    // propriedade 1 é a principal → inclui movimentos legados sem propriedade.
    expect(args.where.AND[0]).toEqual({ OR: [{ propriedadeId: 1 }, { propriedadeId: null }] });
    expect(args.where.AND[1]).toEqual({ OR: [{ tipo: "ENTRADA", origem: { in: ["COMPRA", "BONIFICACAO", "PRODUCAO", "INVENTARIO_INICIAL"] } }, { tipo: "AJUSTE" }] });
    expect(mocks.movFindMany).not.toHaveBeenCalled();
    const data = mocks.movCreate.mock.calls[0][0].data;
    expect(Number(data.custoUnitario)).toBe(6);
    expect(Number(data.valorTotal)).toBe(30);
  });
  it("ajuste negativo em produto por grama não infla o valor pelo custo arredondado", async () => {
    // 25.000 g por R$ 11,25: custo real 0,00045/g (exibido como 0,0005).
    mocks.movGroupBy.mockResolvedValue([{ produtoId: 3, _sum: { quantidade: new Prisma.Decimal(25000), valorTotal: new Prisma.Decimal("11.25") } }]);
    await registrarMovimento({ produtoId: 3, tipo: "AJUSTE", data: "2026-01-10", quantidade: -10000, observacao: "Perda no galpão", propriedadeId: 1 });
    const data = mocks.movCreate.mock.calls[0][0].data;
    expect(data.valorTotal.toString()).toBe("-4.5");
  });
  it("custo informado prevalece sobre o médio", async () => {
    mocks.movFindMany.mockResolvedValue([]);
    await registrarMovimento({ produtoId: 3, tipo: "AJUSTE", data: "2026-01-10", quantidade: 2, custoUnitario: 4, observacao: "Sobrou no galpão", propriedadeId: 1 });
    expect(Number(mocks.movCreate.mock.calls[0][0].data.valorTotal)).toBe(8);
    expect(mocks.movFindMany).not.toHaveBeenCalled();
    expect(mocks.movGroupBy).not.toHaveBeenCalled();
  });
  it("baixa manual (AJUSTE negativo) de produto sem estoque no sítio é recusada", async () => {
    mocks.movFindFirst.mockResolvedValue(null); // nenhuma ENTRADA/AJUSTE positivo no sítio
    await expect(registrarMovimento({ produtoId: 3, tipo: "AJUSTE", data: "2026-01-10", quantidade: -2, observacao: "Perda no galpão", propriedadeId: 1 }))
      .rejects.toMatchObject({ code: "VALIDACAO", message: "Este produto não tem estoque neste sítio — registre uma compra ou um inventário antes de dar baixa" });
    expect(mocks.movFindFirst.mock.calls[0][0].where).toMatchObject({ produtoId: 3, status: "CONFIRMADO", reversaoDeId: null });
    expect(mocks.opCreate).not.toHaveBeenCalled();
    expect(mocks.movCreate).not.toHaveBeenCalled();
  });
  it("baixa manual de produto com estoque no sítio é aceita", async () => {
    await registrarMovimento({ produtoId: 3, tipo: "AJUSTE", data: "2026-01-10", quantidade: -2, observacao: "Perda no galpão", propriedadeId: 1 });
    expect(mocks.movCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ quantidade: -2 }) });
  });
  it("AJUSTE positivo não exige estoque prévio (é ele que põe o produto no estoque)", async () => {
    mocks.movFindFirst.mockResolvedValue(null);
    await registrarMovimento({ produtoId: 3, tipo: "AJUSTE", data: "2026-01-10", quantidade: 2, observacao: "Achado no galpão", propriedadeId: 1 });
    expect(mocks.movFindFirst).not.toHaveBeenCalled();
    expect(mocks.movCreate).toHaveBeenCalled();
  });
  it("sem usuário grava criadoPorId null", async () => {
    await registrarMovimento({ produtoId: 3, tipo: "AJUSTE", data: "2026-01-10", quantidade: 5, observacao: "Sobrou no galpão", propriedadeId: 1 });
    expect(mocks.movCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ criadoPorId: null }) });
  });
});

const movBase = {
  id: 40, produtoId: 3, tipo: "ENTRADA", origem: "AJUSTE_INVENTARIO", status: "CONFIRMADO", data: new Date("2026-01-10"),
  quantidade: new Prisma.Decimal(5), custoUnitario: new Prisma.Decimal(2), valorTotal: new Prisma.Decimal(10),
  propriedadeId: 1, operacaoId: 50, reversaoDeId: null, revertidoPor: null, centroCustoId: 11,
};

describe("estornarMovimentoTx", () => {
  it("não checa origem — estorna APLICACAO quando chamado pelo domínio dono, invertendo SAIDA em ENTRADA", async () => {
    mocks.movFindFirst.mockResolvedValue({ ...movBase, tipo: "SAIDA", origem: "APLICACAO", operacaoId: null });
    const r = await estornarMovimentoTx(tx() as never, 40, { observacao: "Estorno: operação agrícola #9 excluída" });
    expect(mocks.movCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ tipo: "ENTRADA", reversaoDeId: 40, observacao: "Estorno: operação agrícola #9 excluída", criadoPorId: null }) });
    expect(r.inverso.id).toBe(100);
    expect(mocks.movUpdate).toHaveBeenCalledWith({ where: { id: 40 }, data: { status: "REVERTIDO" } });
  });
  it("AJUSTE é invertido negando a quantidade", async () => {
    mocks.movFindFirst.mockResolvedValue({ ...movBase, tipo: "AJUSTE", quantidade: new Prisma.Decimal(-3), valorTotal: new Prisma.Decimal(-6) });
    await estornarMovimentoTx(tx() as never, 40);
    const data = mocks.movCreate.mock.calls[0][0].data;
    expect(data.tipo).toBe("AJUSTE");
    expect(Number(data.quantidade)).toBe(3);
    expect(Number(data.valorTotal)).toBe(6);
  });
});

describe("ajustarContagem — produto sem atributo de estoque", () => {
  it("aceita qualquer produto ativo e lê o saldo no escopo do sítio (principal inclui movimento sem propriedade)", async () => {
    mocks.movFindMany.mockResolvedValue([{ tipo: "ENTRADA", quantidade: new Prisma.Decimal(10) }]);
    await ajustarContagem({ produtoId: 3, quantidadeContada: 8, saldoEsperado: 10, observacao: "Contagem física", propriedadeId: 1, usuarioId: 7 });
    expect(mocks.produtoFindFirst).toHaveBeenCalledWith({ where: { id: 3, ativo: true } });
    expect(mocks.movFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { produtoId: 3, status: { in: ["CONFIRMADO", "REVERTIDO"] }, OR: [{ propriedadeId: 1 }, { propriedadeId: null }] },
    }));
  });
});

describe("produtoTemEstoque / produtosComEstoque", () => {
  // ENTRADA ou AJUSTE positivo; o escopo do sítio vai num AND (a principal também é um OR).
  const where = (sitio: object) => ({
    status: "CONFIRMADO", reversaoDeId: null,
    AND: [{ OR: [{ tipo: "ENTRADA" }, { tipo: "AJUSTE", quantidade: { gt: 0 } }] }, sitio],
  });

  it("com entrada/ajuste confirmado no sítio → true; a consulta é um findFirst enxuto", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 10 });
    expect(await produtoTemEstoque({ movimentoEstoque: { findFirst } } as never, 3, 2)).toBe(true);
    expect(findFirst).toHaveBeenCalledWith({ where: { produtoId: 3, ...where({ propriedadeId: 2 }) }, select: { id: true } });
  });

  it("sem entrada no sítio → false", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    expect(await produtoTemEstoque({ movimentoEstoque: { findFirst } } as never, 3, 2)).toBe(false);
  });

  it("sítio principal também conta movimento sem propriedade; null = consolidado (qualquer sítio)", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    await produtoTemEstoque({ movimentoEstoque: { findFirst } } as never, 3, 1);
    expect(findFirst.mock.calls[0][0].where).toEqual({ produtoId: 3, ...where({ OR: [{ propriedadeId: 1 }, { propriedadeId: null }] }) });
    await produtoTemEstoque({ movimentoEstoque: { findFirst } } as never, 3, null);
    expect(findFirst.mock.calls[1][0].where).toEqual({ produtoId: 3, ...where({}) });
  });

  // Avaliador mínimo do `where` sobre linhas em memória — prova o filtro, não só a forma.
  type Linha = { produtoId: number; tipo: string; quantidade: number; status: string; reversaoDeId: number | null; propriedadeId: number | null };
  const casa = (w: any, m: Linha): boolean => Object.entries(w).every(([k, v]: [string, any]) => {
    if (k === "AND") return v.every((x: any) => casa(x, m));
    if (k === "OR") return v.some((x: any) => casa(x, m));
    if (v && typeof v === "object" && "gt" in v) return (m as any)[k] > v.gt;
    if (v && typeof v === "object" && "in" in v) return v.in.includes((m as any)[k]);
    return (m as any)[k] === v;
  });
  const bancoCom = (linhas: Linha[]) => ({
    findFirst: vi.fn(async ({ where: w }: any) => linhas.find((m) => casa(w, m)) ?? null),
    groupBy: vi.fn(async ({ where: w }: any) => [...new Set(linhas.filter((m) => casa(w, m)).map((m) => m.produtoId))].map((produtoId) => ({ produtoId }))),
  });
  const linha = (tipo: string, quantidade: number, extra: Partial<Linha> = {}): Linha => ({ produtoId: 3, tipo, quantidade, status: "CONFIRMADO", reversaoDeId: null, propriedadeId: 2, ...extra });

  it("AJUSTE negativo isolado (baixa manual) NÃO faz o produto ter estoque", async () => {
    const db = bancoCom([linha("AJUSTE", -5)]);
    expect(await produtoTemEstoque({ movimentoEstoque: db } as never, 3, 2)).toBe(false);
    expect([...await produtosComEstoque({ movimentoEstoque: db } as never, [3], 2)]).toEqual([]);
  });

  it("AJUSTE positivo (inventário) faz o produto ter estoque", async () => {
    const db = bancoCom([linha("AJUSTE", 5)]);
    expect(await produtoTemEstoque({ movimentoEstoque: db } as never, 3, 2)).toBe(true);
    expect([...await produtosComEstoque({ movimentoEstoque: db } as never, [3], 2)]).toEqual([3]);
  });

  it("ENTRADA estornada, estorno e SAIDA não contam; entrada de outro sítio também não", async () => {
    const db = bancoCom([
      linha("ENTRADA", 5, { status: "REVERTIDO" }),
      linha("SAIDA", 5, { reversaoDeId: 1 }),
      linha("ENTRADA", 5, { reversaoDeId: 2 }),
      linha("SAIDA", 3),
      linha("ENTRADA", 5, { propriedadeId: 9 }),
    ]);
    expect(await produtoTemEstoque({ movimentoEstoque: db } as never, 3, 2)).toBe(false);
  });

  it("em lote devolve só os produtos com entrada no sítio", async () => {
    const groupBy = vi.fn().mockResolvedValue([{ produtoId: 4 }]);
    const r = await produtosComEstoque({ movimentoEstoque: { groupBy } } as never, [3, 4, 4], 2);
    expect([...r]).toEqual([4]);
    expect(groupBy).toHaveBeenCalledWith({ by: ["produtoId"], where: { produtoId: { in: [3, 4] }, ...where({ propriedadeId: 2 }) } });
    expect(await produtosComEstoque({ movimentoEstoque: { groupBy } } as never, [], 2)).toEqual(new Set());
    expect(groupBy).toHaveBeenCalledTimes(1);
  });
});

describe("listarSaldos", () => {
  it("lista só produtos ativos com algum movimento no sítio (sem filtro de estocável)", async () => {
    mocks.produtoFindMany.mockResolvedValue([]);
    await listarSaldos({ propriedadeId: 2 });
    expect(mocks.produtoFindMany.mock.calls[0][0].where).toEqual({ ativo: true, movimentos: { some: { propriedadeId: 2 } } });
    expect(mocks.produtoFindMany.mock.calls[0][0].include.movimentos.where).toEqual({ status: { in: ["CONFIRMADO", "REVERTIDO"] }, propriedadeId: 2 });
  });

  it("sítio principal inclui movimentos sem propriedade (existência e saldo)", async () => {
    mocks.produtoFindMany.mockResolvedValue([]);
    await listarSaldos({ propriedadeId: 1 });
    const principal = { OR: [{ propriedadeId: 1 }, { propriedadeId: null }] };
    expect(mocks.produtoFindMany.mock.calls[0][0].where).toEqual({ ativo: true, movimentos: { some: principal } });
    expect(mocks.produtoFindMany.mock.calls[0][0].include.movimentos.where).toEqual({ status: { in: ["CONFIRMADO", "REVERTIDO"] }, ...principal });
  });

  it("consolidado lista produto com movimento em qualquer sítio e mantém o filtro de uso", async () => {
    mocks.produtoFindMany.mockResolvedValue([]);
    await listarSaldos({ propriedadeId: null, uso: "agricola" });
    expect(mocks.produtoFindMany.mock.calls[0][0].where).toEqual({ ativo: true, movimentos: { some: {} }, categoria: { usoAgricola: true } });
  });

  const mov = (tipo: string, quantidade: string, valorTotal: string) => ({ tipo, quantidade: new Prisma.Decimal(quantidade), valorTotal: new Prisma.Decimal(valorTotal), data: new Date("2026-01-10") });
  const produtoMl = (movimentos: unknown[]) => ({ id: 3, nome: "Ivermectina", unidade: "ML", minimoEstoque: null, categoria: null, centrosCusto: [], movimentos });

  it("valor do saldo usa a base exata (Σvalor ÷ Σquantidade), não o custo médio arredondado × saldo", async () => {
    // Base 25.000 mL por R$ 11,25 → custo real 0,00045/mL, exibido 0,0005.
    mocks.produtoFindMany.mockResolvedValue([produtoMl([mov("ENTRADA", "25000", "11.25"), mov("AJUSTE", "995", "0")])]);
    mocks.movGroupBy.mockResolvedValue([{ produtoId: 3, _sum: { quantidade: new Prisma.Decimal(25000), valorTotal: new Prisma.Decimal("11.25") } }]);
    const [linha] = await listarSaldos({ propriedadeId: 1 });
    expect(linha.saldo).toBe(25995);
    expect(linha.custoMedio).toBe(0.0005); // só exibição
    expect(linha.valor).toBe(11.7); // 25.995 × 11,25 ÷ 25.000 = 11,698 → 11,70 (não 13,00)
  });

  it("sem base de custo, valor 0 e custoMedio null", async () => {
    mocks.produtoFindMany.mockResolvedValue([produtoMl([mov("AJUSTE", "10", "0")])]);
    mocks.movGroupBy.mockResolvedValue([]);
    const [linha] = await listarSaldos({ propriedadeId: 1 });
    expect(linha).toMatchObject({ saldo: 10, custoMedio: null, valor: 0 });
  });
});

describe("listarMovimentos — origem para navegação", () => {
  const base = { produtoId: 3, produto: { nome: "Ureia", centrosCusto: [] }, tipo: "SAIDA", origem: "APLICACAO", status: "CONFIRMADO", reversaoDeId: null, data: new Date("2026-09-01"), quantidade: new Prisma.Decimal(2), custoUnitario: new Prisma.Decimal(3), valorTotal: new Prisma.Decimal(6), operacao: null, observacao: null, operacaoId: null, operacaoAgricola: null };

  it("usa o mesmo escopo de sítio de listarSaldos (principal inclui movimento sem propriedade)", async () => {
    mocks.movFindMany.mockResolvedValue([]);
    await listarMovimentos({ propriedadeId: 1 });
    expect(mocks.movFindMany.mock.calls[0][0].where).toEqual({ status: { in: ["CONFIRMADO", "REVERTIDO"] }, AND: [{ OR: [{ propriedadeId: 1 }, { propriedadeId: null }] }] });
    await listarMovimentos({ propriedadeId: 2, produtoId: 3 });
    expect(mocks.movFindMany.mock.calls[1][0].where).toEqual({ status: { in: ["CONFIRMADO", "REVERTIDO"] }, produtoId: 3, AND: [{ propriedadeId: 2 }] });
    await listarMovimentos({ propriedadeId: null });
    expect(mocks.movFindMany.mock.calls[2][0].where).toEqual({ status: { in: ["CONFIRMADO", "REVERTIDO"] }, AND: [{}] });
  });

  it("expõe operacaoId e nenhum vínculo quando o movimento nasceu de uma operação", async () => {
    mocks.movFindMany.mockResolvedValue([{ ...base, id: 1, tipo: "ENTRADA", origem: "COMPRA", operacaoId: 42, operacao: { parceiro: { nome: "Agro" } } }]);
    const { itens: [m] } = await listarMovimentos();
    expect(m.operacaoId).toBe(42);
    expect(m.vinculo).toBeNull();
    expect(m.fornecedor).toBe("Agro");
  });

  it("resolve o talhão das saídas automáticas com uma única consulta", async () => {
    mocks.movFindMany.mockResolvedValue([
      { ...base, id: 4, origem: "APLICACAO", operacaoAgricola: { talhaoId: 5, talhao: { codigo: "T-05" } } },
    ]);
    const { itens: ms } = await listarMovimentos();
    expect(ms.map((m) => m.operacaoId)).toEqual([null]);
    expect(ms[0].vinculo).toEqual({ tipo: "TALHAO", id: 5, codigo: "T-05" });
    expect(mocks.movFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.movFindMany.mock.calls[0][0].include).toMatchObject({ operacaoAgricola: expect.anything() });
  });

  it("omite vínculo e observação automática de área que o leitor não tem", async () => {
    const linhas = [
      { ...base, id: 4, origem: "APLICACAO", observacao: "Aplicação em T-05", operacaoAgricola: { talhaoId: 5, talhao: { codigo: "T-05" } } },
    ];
    mocks.movFindMany.mockResolvedValue(linhas);
    const { itens: soFinanceiro } = await listarMovimentos({ vinculosVisiveis: { agricultura: false } });
    expect(soFinanceiro.map((m) => [m.vinculo, m.observacao])).toEqual([[null, null]]);

    const { itens: soAgricultura } = await listarMovimentos({ vinculosVisiveis: { agricultura: true } });
    expect(soAgricultura.map((m) => m.vinculo?.tipo ?? null)).toEqual(["TALHAO"]);
    expect(soAgricultura[0].observacao).toBe("Aplicação em T-05");
  });
  it("filtra por busca (produto, fornecedor e operação), origem, centro e período, e pagina no servidor", async () => {
    mocks.movFindMany.mockResolvedValue([]);
    mocks.movCount.mockResolvedValue(31);
    const r = await listarMovimentos({ propriedadeId: null, q: "OP-0011", origem: "COMPRA", centroCustoId: 0, de: "2026-09-01", ate: "2026-09-30", pagina: 3, porPagina: 15 });
    expect(r.total).toBe(31);
    const chamada = mocks.movFindMany.mock.calls.at(-1)![0];
    expect(chamada.skip).toBe(30);
    expect(chamada.take).toBe(15);
    expect(chamada.where.origem).toBe("COMPRA");
    expect(chamada.where.AND).toEqual(expect.arrayContaining([
      { produto: { centrosCusto: { none: {} } } },
      { data: { gte: new Date("2026-09-01T00:00:00.000Z"), lte: new Date("2026-09-30T23:59:59.999Z") } },
      { OR: [
        { produto: { nome: { contains: "OP-0011", mode: "insensitive" } } },
        { operacao: { parceiro: { nome: { contains: "OP-0011", mode: "insensitive" } } } },
        { operacaoId: 11 },
      ] },
    ]));
    expect(mocks.movCount.mock.calls.at(-1)![0].where).toBe(chamada.where);
  });

  it("centro específico filtra pelo vínculo do produto; busca comum não procura operação", async () => {
    mocks.movFindMany.mockResolvedValue([]);
    await listarMovimentos({ propriedadeId: null, centroCustoId: 4, q: "Ração" });
    const { where } = mocks.movFindMany.mock.calls.at(-1)![0];
    expect(where.AND).toEqual(expect.arrayContaining([{ produto: { centrosCusto: { some: { centroCustoId: 4 } } } }]));
    const busca = where.AND.find((c: any) => c.OR);
    expect(busca.OR).toHaveLength(2);
  });
});
