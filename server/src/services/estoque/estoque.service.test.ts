import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { uid } from "../../lib/uid.fixture.js";

const mocks = vi.hoisted(() => ({
  tentativaFindMany: vi.fn(), baseFindMany: vi.fn(), saldosValor: vi.fn(), planoValor: vi.fn(), registrarEntradaValor: vi.fn(), registrarSaidaValor: vi.fn(),
  tentativaFindFirst: vi.fn(),
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

vi.mock("./valorizacao.js", async original => ({ ...await original<typeof import("./valorizacao.js")>(), travarValorizacaoTx: vi.fn(), saldosBasesTx: mocks.saldosValor, planejarSaidaTx: mocks.planoValor, registrarEntradaValorizadaTx: mocks.registrarEntradaValor, registrarSaidaValorizadaTx: mocks.registrarSaidaValor, registrarInversoValorizadoTx: vi.fn() }));
vi.mock("../../db.js", () => ({ prisma: {
  $transaction: mocks.transaction,
  $queryRaw: mocks.queryRaw,
  tentativaReprodutiva: { findMany: mocks.tentativaFindMany },
  produto: { findMany: mocks.produtoFindMany },
  movimentoEstoque: { groupBy: mocks.movGroupBy, findMany: mocks.movFindMany, count: mocks.movCount },
} }));
vi.mock("../propriedade.js", () => ({ propriedadePrincipalId: mocks.propriedadePrincipalId, escopoPadraoLeitura: vi.fn().mockResolvedValue(1) }));

import { obterCustosMedios, ajustarContagem, estornarMovimentoTx, listarMovimentos, listarSaldos, produtosComEstoque, produtoTemEstoque, registrarMovimento } from "./estoque.js";

const tx = () => ({
  $executeRaw: vi.fn().mockResolvedValue(0),
  tentativaReprodutiva: { findFirst: mocks.tentativaFindFirst },
  produto: { findUnique: mocks.produtoFindUnique, findFirst: mocks.produtoFindFirst },
  centroCusto: { findFirst: mocks.centroFindFirst },
  periodoFinanceiro: { findUnique: mocks.periodoFindUnique },
  movimentoEstoque: { findMany: mocks.movFindMany, groupBy: mocks.movGroupBy, findFirst: mocks.movFindFirst, create: mocks.movCreate, update: mocks.movUpdate },
  operacao: { create: mocks.opCreate },
  auditoriaFinanceira: { create: mocks.auditCreate },
  $queryRaw: mocks.queryRaw,
});

const produto = { id: uid(3), nome: "Ureia", unidade: "KG", ativo: true, centrosCusto: [{ centroCustoId: uid(9) }, { centroCustoId: uid(11) }] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.baseFindMany.mockResolvedValue([]);
  mocks.saldosValor.mockResolvedValue([{ id: "base", quantidade: new Prisma.Decimal(20), valor: new Prisma.Decimal(120) }]);
  mocks.planoValor.mockResolvedValue({ metodo: "FIFO_AQUISICAO_V1", parcelas: [], valorTotal: new Prisma.Decimal(12), custoUnitario: new Prisma.Decimal(6) });
  mocks.tentativaFindMany.mockResolvedValue([]);
  mocks.tentativaFindFirst.mockResolvedValue(null);
  mocks.transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx()));
  mocks.produtoFindUnique.mockResolvedValue(produto);
  mocks.produtoFindFirst.mockResolvedValue(produto);
  mocks.centroFindFirst.mockResolvedValue({ id: uid(11), ativo: true });
  mocks.periodoFindUnique.mockResolvedValue(null);
  mocks.opCreate.mockResolvedValue({ id: uid(50), itens: [{ id: uid(51) }] });
  mocks.movCreate.mockResolvedValue({ id: uid(100), quantidade: new Prisma.Decimal(1) });
  mocks.movUpdate.mockResolvedValue({});
  mocks.auditCreate.mockResolvedValue({});
  mocks.queryRaw.mockResolvedValue([]);
  mocks.propriedadePrincipalId.mockResolvedValue(1);
  mocks.movGroupBy.mockResolvedValue([]);
  mocks.movFindFirst.mockResolvedValue({ id: uid(1) }); // por padrão o produto tem estoque no sítio
});

describe("ajustarContagem", () => {
  it("propaga o centro de custo escolhido ao movimento e audita", async () => {
    mocks.movFindMany.mockResolvedValue([{ tipo: "ENTRADA", quantidade: new Prisma.Decimal(10) }]);
    await ajustarContagem({ produtoId: uid(3), quantidadeContada: 8, saldoEsperado: 10, observacao: "Contagem física", propriedadeId: 1, centroCustoId: uid(11), usuarioId: 7 });
    expect(mocks.movCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ tipo: "AJUSTE", origem: "AJUSTE_INVENTARIO", centroCustoId: uid(11), quantidade: -2, criadoPorId: 7, propriedadeId: 1 }) });
    expect(mocks.opCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tipo: "AJUSTE_ESTOQUE", criadoPorId: 7 }) }));
    expect(mocks.auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ entidade: "Operacao", entidadeId: uid(50), acao: "AJUSTE_CONTAGEM", usuarioId: 7 }) });
  });

  it("saldo real de 1,005 (3 casas) casa com saldoEsperado: 1.005 informado pelo client — antes dava CONFLITO por arredondar a 2 casas", async () => {
    mocks.movFindMany.mockResolvedValue([{ tipo: "ENTRADA", quantidade: new Prisma.Decimal("1.005") }]);
    await expect(
      ajustarContagem({ produtoId: uid(3), quantidadeContada: 2.005, saldoEsperado: 1.005, observacao: "Contagem física", propriedadeId: 1, usuarioId: 7 }),
    ).resolves.toMatchObject({ saldoAnterior: 1.005, diferenca: 1 });
    expect(mocks.movCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ quantidade: 1 }) });
  });

  it("saldoEsperado divergente do saldo real (mesmo em 3 casas) continua CONFLITO", async () => {
    mocks.movFindMany.mockResolvedValue([{ tipo: "ENTRADA", quantidade: new Prisma.Decimal("1.005") }]);
    await expect(
      ajustarContagem({ produtoId: uid(3), quantidadeContada: 2, saldoEsperado: 1.01, observacao: "Contagem física", propriedadeId: 1, usuarioId: 7 }),
    ).rejects.toMatchObject({ code: "CONFLITO" });
  });
});

describe("registrarMovimento", () => {
  it("grava criadoPorId e audita AJUSTE_MANUAL", async () => {
    await registrarMovimento({ produtoId: uid(3), tipo: "AJUSTE", data: "2026-01-10", quantidade: 5, observacao: "Sobrou no galpão", propriedadeId: 1, usuarioId: 7 });
    expect(mocks.opCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ criadoPorId: 7 }) }));
    expect(mocks.movCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ criadoPorId: 7, operacaoId: uid(50) }) });
    expect(mocks.auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ entidade: "Operacao", entidadeId: uid(50), acao: "AJUSTE_MANUAL", usuarioId: 7 }) });
  });
  it("ajuste positivo conserva a base residual e delega a entrada valorizada", async () => {
    await registrarMovimento({ produtoId: uid(3), tipo: "AJUSTE", data: "2026-01-10", quantidade: 5, observacao: "Sobrou no galpão", propriedadeId: 1 });
    expect(mocks.saldosValor).toHaveBeenCalledWith(expect.anything(), uid(3), 1);
    const data = mocks.movCreate.mock.calls[0][0].data;
    expect(Number(data.custoUnitario)).toBe(6);
    expect(Number(data.valorTotal)).toBe(30);
    expect(mocks.registrarEntradaValor).toHaveBeenCalled();
  });
  it("ajuste negativo em produto por grama não infla o valor pelo custo arredondado", async () => {
    // 25.000 g por R$ 11,25: custo real 0,00045/g (exibido como 0,0005).
    mocks.planoValor.mockResolvedValue({ metodo: "FIFO_AQUISICAO_V1", parcelas: [], valorTotal: new Prisma.Decimal("4.5"), custoUnitario: new Prisma.Decimal("0.0005") });
    await registrarMovimento({ produtoId: uid(3), tipo: "AJUSTE", data: "2026-01-10", quantidade: -10000, observacao: "Perda no galpão", propriedadeId: 1 });
    const data = mocks.movCreate.mock.calls[0][0].data;
    expect(data.valorTotal.toString()).toBe("-4.5");
  });
  it("custo informado documenta base nova quando não há valor residual", async () => {
    mocks.saldosValor.mockResolvedValue([]);
    mocks.movFindMany.mockResolvedValue([]);
    await registrarMovimento({ produtoId: uid(3), tipo: "AJUSTE", data: "2026-01-10", quantidade: 2, custoUnitario: 4, referenciaValor: "Inventário", evidenciaValor: "Documento conferido", observacao: "Sobrou no galpão", propriedadeId: 1 });
    expect(Number(mocks.movCreate.mock.calls[0][0].data.valorTotal)).toBe(8);
    expect(mocks.movFindMany).not.toHaveBeenCalled();
    expect(mocks.movGroupBy).not.toHaveBeenCalled();
  });
  it("baixa manual (AJUSTE negativo) de produto sem estoque no sítio é recusada", async () => {
    mocks.movFindFirst.mockResolvedValue(null); // nenhuma ENTRADA/AJUSTE positivo no sítio
    await expect(registrarMovimento({ produtoId: uid(3), tipo: "AJUSTE", data: "2026-01-10", quantidade: -2, observacao: "Perda no galpão", propriedadeId: 1 }))
      .rejects.toMatchObject({ code: "VALIDACAO", message: "Este produto não tem estoque neste sítio — registre uma compra ou um inventário antes de dar baixa" });
    expect(mocks.movFindFirst.mock.calls[0][0].where).toMatchObject({ produtoId: uid(3), status: "CONFIRMADO", reversaoDeId: null });
    expect(mocks.opCreate).not.toHaveBeenCalled();
    expect(mocks.movCreate).not.toHaveBeenCalled();
  });
  it("baixa manual de produto com estoque no sítio é aceita", async () => {
    await registrarMovimento({ produtoId: uid(3), tipo: "AJUSTE", data: "2026-01-10", quantidade: -2, observacao: "Perda no galpão", propriedadeId: 1 });
    expect(mocks.movCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ quantidade: -2 }) });
  });
  it("AJUSTE positivo não exige estoque prévio (é ele que põe o produto no estoque)", async () => {
    mocks.movFindFirst.mockResolvedValue(null);
    await registrarMovimento({ produtoId: uid(3), tipo: "AJUSTE", data: "2026-01-10", quantidade: 2, observacao: "Achado no galpão", propriedadeId: 1 });
    expect(mocks.movFindFirst).not.toHaveBeenCalled();
    expect(mocks.movCreate).toHaveBeenCalled();
  });
  it("sem usuário grava criadoPorId null", async () => {
    await registrarMovimento({ produtoId: uid(3), tipo: "AJUSTE", data: "2026-01-10", quantidade: 5, observacao: "Sobrou no galpão", propriedadeId: 1 });
    expect(mocks.movCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ criadoPorId: null }) });
  });
});

const movBase = {
  id: uid(40), seq: 40, produtoId: uid(3), tipo: "ENTRADA", origem: "AJUSTE_INVENTARIO", status: "CONFIRMADO", data: new Date("2026-01-10"),
  quantidade: new Prisma.Decimal(5), custoUnitario: new Prisma.Decimal(2), valorTotal: new Prisma.Decimal(10),
  propriedadeId: 1, operacaoId: uid(50), reversaoDeId: null, revertidoPor: null, centroCustoId: uid(11),
};

describe("estornarMovimentoTx", () => {
  it("não checa origem — estorna APLICACAO quando chamado pelo domínio dono, invertendo SAIDA em ENTRADA", async () => {
    mocks.movFindFirst.mockResolvedValue({ ...movBase, tipo: "SAIDA", origem: "APLICACAO", operacaoId: null });
    const r = await estornarMovimentoTx(tx() as never, uid(40), { observacao: "Estorno: operação agrícola #9 excluída" });
    expect(mocks.movCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ tipo: "ENTRADA", reversaoDeId: uid(40), observacao: "Estorno: operação agrícola #9 excluída", criadoPorId: null }) });
    expect(r.inverso.id).toBe(uid(100));
    expect(mocks.movUpdate).toHaveBeenCalledWith({ where: { id: uid(40) }, data: { status: "REVERTIDO" } });
  });
  it("não devolve litros de retirada de leite por estorno genérico", async () => {
    mocks.movFindFirst.mockResolvedValue({ ...movBase, tipo: "SAIDA", origem: "RETIRADA_LEITE", operacaoId: null });
    await expect(estornarMovimentoTx(tx() as never, uid(40))).rejects.toMatchObject({ code: "ORIGEM_AUTOMATICA" });
    expect(mocks.movCreate).not.toHaveBeenCalled();
    expect(mocks.movUpdate).not.toHaveBeenCalled();
  });
  it("exige estorno pela Nutrição para leite atribuído ao fechamento", async () => {
    mocks.movFindFirst.mockResolvedValue({ ...movBase, tipo: "SAIDA", origem: "NUTRICAO", metodoValorizacao: "LEITE_FIFO_V1", operacaoId: null });
    const db = { ...tx(), movimentoFornecimentoNutricionalLeite: { findUnique: vi.fn().mockResolvedValue({ id: uid(81) }) } };
    await expect(estornarMovimentoTx(db as never, uid(40))).rejects.toMatchObject({ code: "ORIGEM_AUTOMATICA" });
    expect(mocks.movCreate).not.toHaveBeenCalled();
    expect(mocks.movUpdate).not.toHaveBeenCalled();
  });
  it("bloqueia consumo reprodutivo enquanto a tentativa permanece válida", async () => {
    mocks.movFindFirst.mockResolvedValue({ ...movBase, tipo: "SAIDA", origem: "REPRODUCAO", operacaoId: null });
    mocks.tentativaFindFirst.mockResolvedValue({ id: uid(80) });
    await expect(estornarMovimentoTx(tx() as never, uid(40))).rejects.toMatchObject({ code: "CONFLITO" });
    expect(mocks.movCreate).not.toHaveBeenCalled(); expect(mocks.movUpdate).not.toHaveBeenCalled();
  });
  it("permite o domínio estornar após anular a tentativa na mesma transação", async () => {
    mocks.movFindFirst.mockResolvedValue({ ...movBase, tipo: "SAIDA", origem: "REPRODUCAO", operacaoId: null });
    await estornarMovimentoTx(tx() as never, uid(40));
    expect(mocks.movCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ tipo: "ENTRADA", reversaoDeId: uid(40) }) });
  });
  it("AJUSTE é invertido negando a quantidade", async () => {
    mocks.movFindFirst.mockResolvedValue({ ...movBase, tipo: "AJUSTE", quantidade: new Prisma.Decimal(-3), valorTotal: new Prisma.Decimal(-6) });
    await estornarMovimentoTx(tx() as never, uid(40));
    const data = mocks.movCreate.mock.calls[0][0].data;
    expect(data.tipo).toBe("AJUSTE");
    expect(Number(data.quantidade)).toBe(3);
    expect(Number(data.valorTotal)).toBe(6);
  });
  it("observação padrão do estorno cita o número sequencial do movimento, não o uuid", async () => {
    mocks.movFindFirst.mockResolvedValue({ ...movBase, tipo: "AJUSTE", quantidade: new Prisma.Decimal(-3), valorTotal: new Prisma.Decimal(-6) });
    await estornarMovimentoTx(tx() as never, uid(40));
    const data = mocks.movCreate.mock.calls[0][0].data;
    expect(data.observacao).toBe("Estorno do movimento #40");
  });
});

describe("ajustarContagem — produto sem atributo de estoque", () => {
  it("aceita qualquer produto ativo e lê o saldo no escopo do sítio (principal inclui movimento sem propriedade)", async () => {
    mocks.movFindMany.mockResolvedValue([{ tipo: "ENTRADA", quantidade: new Prisma.Decimal(10) }]);
    await ajustarContagem({ produtoId: uid(3), quantidadeContada: 8, saldoEsperado: 10, observacao: "Contagem física", propriedadeId: 1, usuarioId: 7 });
    expect(mocks.produtoFindFirst).toHaveBeenCalledWith({ where: { id: uid(3), ativo: true } });
    expect(mocks.movFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { produtoId: uid(3), status: { in: ["CONFIRMADO", "REVERTIDO"] }, OR: [{ propriedadeId: 1 }, { propriedadeId: null }] },
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
    const findFirst = vi.fn().mockResolvedValue({ id: uid(10) });
    expect(await produtoTemEstoque({ movimentoEstoque: { findFirst } } as never, uid(3), 2)).toBe(true);
    expect(findFirst).toHaveBeenCalledWith({ where: { produtoId: uid(3), ...where({ propriedadeId: 2 }) }, select: { id: true } });
  });

  it("sem entrada no sítio → false", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    expect(await produtoTemEstoque({ movimentoEstoque: { findFirst } } as never, uid(3), 2)).toBe(false);
  });

  it("sítio principal também conta movimento sem propriedade; null = consolidado (qualquer sítio)", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    await produtoTemEstoque({ movimentoEstoque: { findFirst } } as never, uid(3), 1);
    expect(findFirst.mock.calls[0][0].where).toEqual({ produtoId: uid(3), ...where({ OR: [{ propriedadeId: 1 }, { propriedadeId: null }] }) });
    await produtoTemEstoque({ movimentoEstoque: { findFirst } } as never, uid(3), null);
    expect(findFirst.mock.calls[1][0].where).toEqual({ produtoId: uid(3), ...where({}) });
  });

  // Avaliador mínimo do `where` sobre linhas em memória — prova o filtro, não só a forma.
  type Linha = { produtoId: string; tipo: string; quantidade: number; status: string; reversaoDeId: string | null; propriedadeId: number | null };
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
  const linha = (tipo: string, quantidade: number, extra: Partial<Linha> = {}): Linha => ({ produtoId: uid(3), tipo, quantidade, status: "CONFIRMADO", reversaoDeId: null, propriedadeId: 2, ...extra });

  it("AJUSTE negativo isolado (baixa manual) NÃO faz o produto ter estoque", async () => {
    const db = bancoCom([linha("AJUSTE", -5)]);
    expect(await produtoTemEstoque({ movimentoEstoque: db } as never, uid(3), 2)).toBe(false);
    expect([...await produtosComEstoque({ movimentoEstoque: db } as never, [uid(3)], 2)]).toEqual([]);
  });

  it("AJUSTE positivo (inventário) faz o produto ter estoque", async () => {
    const db = bancoCom([linha("AJUSTE", 5)]);
    expect(await produtoTemEstoque({ movimentoEstoque: db } as never, uid(3), 2)).toBe(true);
    expect([...await produtosComEstoque({ movimentoEstoque: db } as never, [uid(3)], 2)]).toEqual([uid(3)]);
  });

  it("ENTRADA estornada, estorno e SAIDA não contam; entrada de outro sítio também não", async () => {
    const db = bancoCom([
      linha("ENTRADA", 5, { status: "REVERTIDO" }),
      linha("SAIDA", 5, { reversaoDeId: uid(1) }),
      linha("ENTRADA", 5, { reversaoDeId: uid(2) }),
      linha("SAIDA", 3),
      linha("ENTRADA", 5, { propriedadeId: 9 }),
    ]);
    expect(await produtoTemEstoque({ movimentoEstoque: db } as never, uid(3), 2)).toBe(false);
  });

  it("em lote devolve só os produtos com entrada no sítio", async () => {
    const groupBy = vi.fn().mockResolvedValue([{ produtoId: uid(4) }]);
    const r = await produtosComEstoque({ movimentoEstoque: { groupBy } } as never, [uid(3), uid(4), uid(4)], 2);
    expect([...r]).toEqual([uid(4)]);
    expect(groupBy).toHaveBeenCalledWith({ by: ["produtoId"], where: { produtoId: { in: [uid(3), uid(4)] }, ...where({ propriedadeId: 2 }) } });
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
    await listarSaldos({ propriedadeId: null, uso: "genetico" });
    expect(mocks.produtoFindMany.mock.calls[0][0].where).toEqual({ ativo: true, movimentos: { some: {} }, usoGenetico: true });
  });

  const mov = (tipo: string, quantidade: string, valorTotal: string) => ({ tipo, quantidade: new Prisma.Decimal(quantidade), valorTotal: new Prisma.Decimal(valorTotal), data: new Date("2026-01-10") });
  const produtoMl = (movimentos: unknown[], materialGenetico: { id: string } | null = null) => ({ id: uid(3), nome: "Ivermectina", unidade: "ML", minimoEstoque: null, categoria: null, centrosCusto: [], materialGenetico, movimentos });

  it("expõe o vínculo do produto com a identidade genética somente quando permitido", async () => {
    mocks.produtoFindMany.mockResolvedValue([produtoMl([], { id: uid(8) })]);
    expect((await listarSaldos({ propriedadeId: 1 }))[0].materialGeneticoId).toBe(uid(8));
    expect((await listarSaldos({ propriedadeId: 1, materialGeneticoVisivel: false }))[0].materialGeneticoId).toBeNull();
  });

  it("valor do saldo usa a base exata (Σvalor ÷ Σquantidade), não o custo médio arredondado × saldo", async () => {
    mocks.produtoFindMany.mockResolvedValue([produtoMl([mov("ENTRADA", "25000", "11.25")])]);
    mocks.queryRaw.mockResolvedValue([{ produtoId: uid(3), quantidade: new Prisma.Decimal(25000), valor: new Prisma.Decimal("11.25") }]);
    const [linha] = await listarSaldos({ propriedadeId: 1 });
    expect(linha.saldo).toBe(25000);
    expect(linha.custoMedio).toBe(0.0005); // só exibição
    expect(linha.valor).toBe(11.25); // 25.995 × 11,25 ÷ 25.000 = 11,698 → 11,70 (não 13,00)
  });

  it("sem base de custo, valor desconhecido e custoMedio null", async () => {
    mocks.produtoFindMany.mockResolvedValue([produtoMl([mov("AJUSTE", "10", "0")])]);
    mocks.movGroupBy.mockResolvedValue([]);
    const [linha] = await listarSaldos({ propriedadeId: 1 });
    expect(linha).toMatchObject({ saldo: 10, custoMedio: null, valor: null });
  });
});

describe("listarMovimentos — origem para navegação", () => {
  const base = { seq: 1, produtoId: uid(3), produto: { nome: "Ureia", centrosCusto: [], materialGenetico: null }, tipo: "SAIDA", origem: "APLICACAO", status: "CONFIRMADO", reversaoDeId: null, data: new Date("2026-09-01"), quantidade: new Prisma.Decimal(2), custoUnitario: new Prisma.Decimal(3), valorTotal: new Prisma.Decimal(6), operacao: null, observacao: null, operacaoId: null, operacaoAgricola: null };

  it("liga procedimento reprodutivo e estorno ao animal no sítio histórico, sem expor pecuária a leitor financeiro", async () => {
    mocks.movFindMany.mockResolvedValue([{ ...base, id: uid(81), propriedadeId: 7, origem: "REPRODUCAO", observacao: "Tentativa IA animal 1" }, { ...base, id: uid(82), propriedadeId: 7, origem: "AJUSTE_INVENTARIO", reversaoDeId: uid(81), observacao: "Anulação IA animal 1" }]);
    mocks.tentativaFindMany.mockResolvedValue([{ id: uid(90), animalId: uid(91), movimentoEstoqueId: uid(81) }]);
    const r = await listarMovimentos({ propriedadeId: 7 });
    for (const m of r.itens) expect(m).toMatchObject({ propriedadeId: 7, vinculo: { tipo: "TENTATIVA_REPRODUTIVA", id: uid(90), animalId: uid(91) } });
    expect(mocks.tentativaFindMany).toHaveBeenCalledWith({ where: { movimentoEstoqueId: { in: [uid(81)] } }, select: { id: true, animalId: true, movimentoEstoqueId: true } });
    const oculto = await listarMovimentos({ propriedadeId: 7, vinculosVisiveis: { pecuaria: false } });
    for (const m of oculto.itens) expect(m).toMatchObject({ vinculo: null, observacao: null });
  });
  it("consulta pelo ID preserva o movimento revertido e aponta para seu inverso", async () => {
    mocks.movFindMany.mockResolvedValue([{ ...base, id: uid(1), status: "REVERTIDO", revertidoPor: { id: uid(2) } }]);
    expect((await listarMovimentos({ movimentoId: uid(1), propriedadeId: 2 })).itens[0]).toMatchObject({ id: uid(1), status: "REVERTIDO", estorno: { id: uid(2) } });
    expect(mocks.movFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: uid(1), status: { in: ["CONFIRMADO", "REVERTIDO"] }, AND: [{ propriedadeId: 2 }] } }));
  });

  it("expõe o vínculo genético no movimento apenas para quem pode ver pecuária", async () => {
    mocks.movFindMany.mockResolvedValue([{ ...base, id: uid(4), produto: { ...base.produto, materialGenetico: { id: uid(8) } } }]);
    expect((await listarMovimentos()).itens[0].materialGeneticoId).toBe(uid(8));
    expect((await listarMovimentos({ vinculosVisiveis: { pecuaria: false } })).itens[0].materialGeneticoId).toBeNull();
  });

  it("usa o mesmo escopo de sítio de listarSaldos (principal inclui movimento sem propriedade)", async () => {
    mocks.movFindMany.mockResolvedValue([]);
    await listarMovimentos({ propriedadeId: 1 });
    expect(mocks.movFindMany.mock.calls[0][0].where).toEqual({ status: { in: ["CONFIRMADO", "REVERTIDO"] }, AND: [{ OR: [{ propriedadeId: 1 }, { propriedadeId: null }] }] });
    await listarMovimentos({ propriedadeId: 2, produtoId: uid(3) });
    expect(mocks.movFindMany.mock.calls[1][0].where).toEqual({ status: { in: ["CONFIRMADO", "REVERTIDO"] }, produtoId: uid(3), AND: [{ propriedadeId: 2 }] });
    await listarMovimentos({ propriedadeId: null });
    expect(mocks.movFindMany.mock.calls[2][0].where).toEqual({ status: { in: ["CONFIRMADO", "REVERTIDO"] }, AND: [{}] });
  });

  it("expõe operacaoId e nenhum vínculo quando o movimento nasceu de uma operação", async () => {
    mocks.movFindMany.mockResolvedValue([{ ...base, id: uid(1), tipo: "ENTRADA", origem: "COMPRA", operacaoId: uid(42), operacao: { numero: 42, parceiro: { nome: "Agro" } } }]);
    const { itens: [m] } = await listarMovimentos();
    expect(m.operacaoId).toBe(uid(42));
    expect(m.operacaoNumero).toBe(42);
    expect(m.vinculo).toBeNull();
    expect(m.fornecedor).toBe("Agro");
  });



  it("filtra por busca (produto, fornecedor e operação), origem, centro e período, e pagina no servidor", async () => {
    mocks.movFindMany.mockResolvedValue([]);
    mocks.movCount.mockResolvedValue(31);
    const r = await listarMovimentos({ propriedadeId: null, q: "OP-0011", origem: "COMPRA", centroCustoId: "sem", de: "2026-09-01", ate: "2026-09-30", pagina: 3, porPagina: 15 });
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
        { operacao: { numero: 11 } },
      ] },
    ]));
    expect(mocks.movCount.mock.calls.at(-1)![0].where).toBe(chamada.where);
  });

  it("centro específico filtra pelo vínculo do produto; busca comum não procura operação", async () => {
    mocks.movFindMany.mockResolvedValue([]);
    await listarMovimentos({ propriedadeId: null, centroCustoId: uid(4), q: "Ração" });
    const { where } = mocks.movFindMany.mock.calls.at(-1)![0];
    expect(where.AND).toEqual(expect.arrayContaining([{ produto: { centrosCusto: { some: { centroCustoId: uid(4) } } } }]));
    const busca = where.AND.find((c: any) => c.OR);
    expect(busca.OR).toHaveLength(2);
  });
});


it("custo médio não considera completa uma base com leite remanescente pendente — contrato SQL estrutural", async () => {
  mocks.queryRaw.mockResolvedValueOnce([]);
  const custos = await obterCustosMedios({ $queryRaw: mocks.queryRaw }, [uid(3)], 7);
  expect(custos.has(uid(3))).toBe(false);
  const sql = mocks.queryRaw.mock.calls[0][0].strings.join("?");
  expect(sql).toContain('WHERE NOT EXISTS');
  expect(sql).toContain('mp."produtoId"=valor_base."produtoId"');
  expect(sql).toContain('mp."propriedadeId" =');
  expect(sql).toContain('NOT EXISTS (SELECT 1 FROM pecuaria."ApuracaoValorLeite"');
  expect(sql).toContain('mp.quantidade > COALESCE');
});
