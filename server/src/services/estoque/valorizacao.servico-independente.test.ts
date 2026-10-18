import { Prisma, type MovimentoEstoque } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const contexto = vi.hoisted(() => ({ tx: undefined as unknown }));
vi.mock("../../db.js", () => ({ prisma: { $transaction: (executar: (tx: unknown) => Promise<unknown>) => executar(contexto.tx) } }));
vi.mock("../propriedade.js", () => ({ propriedadePrincipalId: vi.fn(async () => 1) }));
vi.mock("./transacao.js", () => ({ transacaoEstoque: (executar: (tx: unknown) => Promise<unknown>) => executar(contexto.tx) }));
vi.mock("../financeiro/regras.js", async importarOriginal => ({
  ...await importarOriginal<typeof import("../financeiro/regras.js")>(),
  exigirPeriodoAberto: vi.fn(async () => undefined), auditar: vi.fn(async () => undefined),
}));

import { exigirPeriodoAberto } from "../financeiro/regras.js";
import { criarOperacao } from "../financeiro/operacoes.js";
import { operacaoSchema } from "../financeiro/schemas.js";
import {
  abrirValorizacao, diagnosticarValorizacaoTx, planejarSaidaTx, previaRetroatividadeTx,
  registrarEntradaValorizadaTx, registrarInversoValorizadoTx, registrarSaidaValorizadaTx,
  saldosBasesTx, travarValorizacaoTx, type PlanoSaida,
} from "./valorizacao.js";

const D = (valor: Prisma.Decimal.Value) => new Prisma.Decimal(valor);
const data = new Date("2026-10-16");
const criarTx = () => ({
  $executeRaw: vi.fn(async () => 0),
  produto: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "produto", rastrearPartidas: false }) },
  baseValorizacaoEstoque: {
    findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockImplementation(async ({ data: dados }) => ({ id: `destino-${dados.partidaId ?? "fifo"}`, ...dados })),
  },
  movimentoEstoque: {
    findMany: vi.fn().mockResolvedValue([]), findUniqueOrThrow: vi.fn(), update: vi.fn().mockResolvedValue({}),
  },
  parcelaValorizacaoEstoque: { create: vi.fn().mockResolvedValue({}), createMany: vi.fn().mockResolvedValue({ count: 1 }), count: vi.fn().mockResolvedValue(0) },
  partidaProduto: {
    findUniqueOrThrow: vi.fn().mockImplementation(async ({ where }) => ({ id: where.id, lotePrincipalId: null })),
    findFirst: vi.fn().mockImplementation(async ({ where }) => ({ id: where.id, produtoId: "produto", lotePrincipalId: null })),
  },
  auditoriaFinanceira: { findFirst: vi.fn().mockResolvedValue(null) },
});
type TxMock = ReturnType<typeof criarTx>;
const banco = (tx: TxMock) => tx as unknown as Prisma.TransactionClient;
const base = (id: string, quantidade: string, valor: string, partidaId: string | null = null) => ({
  id, produtoId: "produto", propriedadeId: 1, partidaId, metodo: partidaId ? "MEDIA_SALDO_V1" : "FIFO_AQUISICAO_V1",
  quantidadeAbertura: D(quantidade), valorAbertura: D(valor), disponivelDesde: new Date("2026-10-01"), corteAbertura: null, ordem: 1,
  parcelas: [] as Array<{ quantidade: Prisma.Decimal; valorTotal: Prisma.Decimal }>,
});
const movimento = (quantidade: string, alocacoes: Array<{ partidaId: string; quantidade: string }> = []) => ({
  id: "movimento", seq: 1, produtoId: "produto", propriedadeId: 1, tipo: "ENTRADA", origem: "COMPRA", data: new Date("2026-10-01"),
  quantidade: D(quantidade), valorTotal: D(0), custoUnitario: D(0), metodoValorizacao: "LEGADO",
  alocacaoPartidaEstoques: alocacoes.map(a => ({ partidaId: a.partidaId, quantidade: D(a.quantidade), partida: { lotePrincipalId: null } })),
});
function configurarSaldo(tx: TxMock, bases: ReturnType<typeof base>[], fisicos: ReturnType<typeof movimento>[]) {
  tx.baseValorizacaoEstoque.findMany.mockResolvedValue(bases);
  tx.movimentoEstoque.findMany.mockImplementation(async consulta => consulta.select ? [] : fisicos);
}
function plano(parcelas: Array<{ baseId: string; quantidade: string; valor: string }>, metodo: PlanoSaida["metodo"] = "MEDIA_SALDO_V1"): PlanoSaida {
  const valores = parcelas.map(p => ({ baseId: p.baseId, quantidade: D(p.quantidade), valorTotal: D(p.valor) }));
  const valorTotal = valores.reduce((s, p) => s.plus(p.valorTotal), D(0));
  const quantidade = valores.reduce((s, p) => s.plus(p.quantidade), D(0));
  return { metodo, parcelas: valores, valorTotal, custoUnitario: valorTotal.div(quantidade).toDecimalPlaces(4) };
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(exigirPeriodoAberto).mockResolvedValue(undefined); });

describe("contraprovas independentes do serviço de valorização, sem banco", () => {
  it.each(["INVENTARIO_INICIAL", "BONIFICACAO", "PRODUCAO"] as const)("%s sem comprovação não cria uma base de valor", async origem => {
    const tx = criarTx();
    await expect(registrarEntradaValorizadaTx(banco(tx), { ...movimento("1"), origem } as unknown as MovimentoEstoque, []))
      .rejects.toMatchObject({ code: "VALIDACAO" });
    expect(tx.baseValorizacaoEstoque.create).not.toHaveBeenCalled();
    expect(tx.parcelaValorizacaoEstoque.create).not.toHaveBeenCalled();
  });

  it("endpoint financeiro não aceita reprecificar o saldo por AJUSTE_ESTOQUE", async () => {
    const tx = criarTx(); contexto.tx = tx;
    const input = operacaoSchema.parse({ tipo: "AJUSTE_ESTOQUE", data: "2026-10-16", descricao: "Tentativa de substituir o valor do saldo",
      itens: [{ produtoId: "11111111-1111-4111-8111-111111111111", descricao: "Saldo já valorizado", quantidade: 1, unidade: "un", valorTotal: 999, estocavel: true }],
      financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" },
    });
    await expect(criarOperacao({ ...input, propriedadeId: 1 })).rejects.toMatchObject({ code: "VALIDACAO", campo: "tipo" });
    expect(tx.baseValorizacaoEstoque.create).not.toHaveBeenCalled();
    expect(tx.parcelaValorizacaoEstoque.createMany).not.toHaveBeenCalled();
    expect(tx.movimentoEstoque.update).not.toHaveBeenCalled();
  });

  it("trava cada produto uma única vez em ordem estável", async () => {
    const tx = criarTx();
    await travarValorizacaoTx(banco(tx), ["b", "a", "b"]);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    const chamada = tx.$executeRaw.mock.calls[0] as unknown[];
    expect(chamada[1]).toEqual(expect.arrayContaining(["valorizacao-estoque:a", "valorizacao-estoque:b"]));
    expect(chamada[1]).toHaveLength(2);
    expect((chamada[0] as string[]).join("?")).toMatch(/SELECT DISTINCT hashtext\(k\).*ORDER BY h/);
  });

  it("saldo físico sem abertura documentada impede saída antes de gravar parcelas", async () => {
    const tx = criarTx(); configurarSaldo(tx, [], [movimento("10")]);
    await expect(planejarSaidaTx(banco(tx), { produtoId: "produto", propriedadeId: 1, data, quantidade: "1" }))
      .rejects.toMatchObject({ code: "SEM_LASTRO" });
    expect(tx.parcelaValorizacaoEstoque.createMany).not.toHaveBeenCalled();
    expect(tx.movimentoEstoque.update).not.toHaveBeenCalled();
  });

  it("período fechado é conferido antes do planejamento de valor", async () => {
    const tx = criarTx();
    vi.mocked(exigirPeriodoAberto).mockRejectedValueOnce(new Error("Período fechado"));
    await expect(planejarSaidaTx(banco(tx), { produtoId: "produto", propriedadeId: 1, data, quantidade: "1" })).rejects.toThrow("Período fechado");
    expect(tx.baseValorizacaoEstoque.findMany).not.toHaveBeenCalled();
  });

  it("planeja a saída pela quantidade/valor residuais das parcelas anteriores", async () => {
    const tx = criarTx();
    const origem = base("origem", "20", "1050.00");
    origem.parcelas = [{ quantidade: D(-2), valorTotal: D(-105) }];
    configurarSaldo(tx, [origem], [movimento("18")]);
    const resultado = await planejarSaidaTx(banco(tx), { produtoId: "produto", propriedadeId: 1, data, quantidade: "2" });
    expect(resultado.valorTotal.toFixed(2)).toBe("105.00");
    expect(resultado.parcelas.map(p => [p.baseId, p.quantidade.toString(), p.valorTotal.toFixed(2)])).toEqual([["origem", "2", "105.00"]]);
  });

  it("grupos divergentes não se compensam só porque o saldo total do produto fecha", async () => {
    const tx = criarTx(); tx.produto.findUniqueOrThrow.mockResolvedValue({ id: "produto", rastrearPartidas: true });
    configurarSaldo(tx, [base("a", "6", "60", "grupo-a"), base("b", "4", "40", "grupo-b")],
      [movimento("10", [{ partidaId: "grupo-a", quantidade: "5" }, { partidaId: "grupo-b", quantidade: "5" }])]);
    await expect(planejarSaidaTx(banco(tx), { produtoId: "produto", propriedadeId: 1, data, quantidade: "1", partidas: [{ partidaId: "grupo-a", quantidade: "1" }] }))
      .rejects.toMatchObject({ code: "SEM_LASTRO" });
  });

  it("alias e raiz do mesmo grupo são somados uma vez no planejamento", async () => {
    const tx = criarTx(); tx.produto.findUniqueOrThrow.mockResolvedValue({ id: "produto", rastrearPartidas: true });
    tx.partidaProduto.findUniqueOrThrow.mockImplementation(async ({ where }) => ({ id: where.id, lotePrincipalId: where.id === "alias" ? "raiz" : null }));
    configurarSaldo(tx, [base("base-raiz", "4", "40", "raiz")], [movimento("4", [{ partidaId: "raiz", quantidade: "4" }])]);
    const resultado = await planejarSaidaTx(banco(tx), { produtoId: "produto", propriedadeId: 1, data, quantidade: "2", partidas: [{ partidaId: "alias", quantidade: "1" }, { partidaId: "raiz", quantidade: "1" }] });
    expect(resultado.parcelas).toHaveLength(1);
    expect(resultado.parcelas[0].quantidade.toString()).toBe("2");
    expect(resultado.valorTotal.toFixed(2)).toBe("20.00");
  });

  it("movimentos posteriores produzem prévia de conflito sem recálculo silencioso", async () => {
    const tx = criarTx();
    const posterior = { id: "posterior", seq: 4, data: new Date("2026-10-17"), origem: "REPRODUCAO" };
    tx.movimentoEstoque.findMany.mockResolvedValue([posterior]);
    const resultado = await previaRetroatividadeTx(banco(tx), "produto", 1, data);
    expect(resultado).toMatchObject({ permitido: false, posteriores: [posterior] });
    expect(tx.movimentoEstoque.update).not.toHaveBeenCalled();
    await expect(planejarSaidaTx(banco(tx), { produtoId: "produto", propriedadeId: 1, data, quantidade: "1" })).rejects.toMatchObject({ code: "CONFLITO" });
  });

  it("consulta temporal exige corte da abertura alcançado e filtra as parcelas pelo fato", async () => {
    const tx = criarTx();
    await saldosBasesTx(banco(tx), "produto", 1, data);
    expect(tx.baseValorizacaoEstoque.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ produtoId: "produto", propriedadeId: 1, disponivelDesde: { lte: data }, OR: [{ corteAbertura: null }, { corteAbertura: { lte: data } }] }),
      include: { parcelas: expect.objectContaining({ where: { movimentoEstoque: { data: { lte: data } } } }) },
    }));
  });

  it("grava valores das parcelas com sinal de saída sem reconstruir pelo custo unitário", async () => {
    const tx = criarTx();
    const calculado = plano([{ baseId: "a", quantidade: "1", valor: "3.34" }, { baseId: "b", quantidade: "2", valor: "6.66" }], "FIFO_AQUISICAO_V1");
    await registrarSaidaValorizadaTx(banco(tx), "saida", calculado);
    const gravadas = tx.parcelaValorizacaoEstoque.createMany.mock.calls[0][0].data;
    expect(gravadas.map((p: { baseId: string; quantidade: Prisma.Decimal; valorTotal: Prisma.Decimal }) => [p.baseId, p.quantidade.toString(), p.valorTotal.toFixed(2)]))
      .toEqual([["a", "-1", "-3.34"], ["b", "-2", "-6.66"]]);
    expect(tx.movimentoEstoque.update).toHaveBeenCalledWith({ where: { id: "saida" }, data: { metodoValorizacao: "FIFO_AQUISICAO_V1" } });
  });

  it.each(["ENTRADA", "AJUSTE"] as const)("%s preserva R$ 40/R$ 65 por grupo em vez de dividir R$ 105 ao meio", async tipo => {
    const tx = criarTx(); tx.produto.findUniqueOrThrow.mockResolvedValue({ id: "produto", rastrearPartidas: true });
    tx.baseValorizacaoEstoque.findMany.mockImplementation(async consulta => consulta.where.id
      ? [base("origem-a", "1", "40.00", "grupo-a"), base("origem-b", "1", "65.00", "grupo-b")] : []);
    const recebimento = { ...movimento("2"), tipo, id: "entrada-destino", propriedadeId: 2, data, valorTotal: D(105) } as unknown as MovimentoEstoque;
    await registrarEntradaValorizadaTx(banco(tx), recebimento, [{ partidaId: "grupo-a", quantidade: "1" }, { partidaId: "grupo-b", quantidade: "1" }],
      plano([{ baseId: "origem-a", quantidade: "1", valor: "40.00" }, { baseId: "origem-b", quantidade: "1", valor: "65.00" }]));
    expect(tx.parcelaValorizacaoEstoque.create.mock.calls.map(([arg]) => [arg.data.baseId, arg.data.quantidade.toString(), arg.data.valorTotal.toFixed(2)]))
      .toEqual([["destino-grupo-a", "1", "40.00"], ["destino-grupo-b", "1", "65.00"]]);
  });

  it("transferência FIFO conserva duas aquisições e a próxima unidade sai por R$ 40, sem média de R$ 52,50", async () => {
    const tx = criarTx();
    const destinos: ReturnType<typeof base>[] = [];
    tx.baseValorizacaoEstoque.create.mockImplementation(async ({ data: dados }) => {
      const criada = { ...base(`destino-${destinos.length}`, "0", "0.00"), ...dados, ordem: destinos.length + 1, parcelas: [] };
      destinos.push(criada); return criada;
    });
    tx.parcelaValorizacaoEstoque.create.mockImplementation(async ({ data: parcela }) => {
      destinos.find(b => b.id === parcela.baseId)!.parcelas.push({ quantidade: parcela.quantidade, valorTotal: parcela.valorTotal });
      return parcela;
    });
    const recebido = { ...movimento("2"), id: "transferencia-entrada", propriedadeId: 2, data, valorTotal: D(105) } as unknown as MovimentoEstoque;
    await registrarEntradaValorizadaTx(banco(tx), recebido, [], plano([
      { baseId: "origem-mais-antiga", quantidade: "1", valor: "40.00" }, { baseId: "origem-seguinte", quantidade: "1", valor: "65.00" },
    ], "FIFO_AQUISICAO_V1"));
    expect(tx.baseValorizacaoEstoque.create.mock.calls.map(([arg]) => arg.data.baseOrigemId)).toEqual(["origem-mais-antiga", "origem-seguinte"]);
    expect(destinos).toHaveLength(2);
    configurarSaldo(tx, destinos, [movimento("2")]);
    const proxima = await planejarSaidaTx(banco(tx), { produtoId: "produto", propriedadeId: 2, data, quantidade: "1" });
    expect(proxima.valorTotal.toFixed(2)).toBe("40.00");
  });

  it("nova entrada não esconde saldo legado anterior sem lastro", async () => {
    const tx = criarTx(); configurarSaldo(tx, [], [movimento("10")]);
    const entrada = { ...movimento("2"), id: "nova", data, valorTotal: D(20) } as unknown as MovimentoEstoque;
    await expect(registrarEntradaValorizadaTx(banco(tx), entrada, [])).rejects.toMatchObject({ code: "SEM_LASTRO" });
    expect(tx.baseValorizacaoEstoque.create).not.toHaveBeenCalled();
    expect(tx.parcelaValorizacaoEstoque.create).not.toHaveBeenCalled();
  });

  it("inverso de saída conserva as parcelas originais e não calcula outra média", async () => {
    const tx = criarTx();
    tx.movimentoEstoque.findUniqueOrThrow.mockImplementation(async ({ where }) => where.id === "original" ? {
      ...movimento("1"), id: "original", tipo: "SAIDA", metodoValorizacao: "FIFO_AQUISICAO_V1",
      parcelasValorizacao: [{ baseId: "origem", ordem: 0, quantidade: D(-1), valorTotal: D("-3.34"), base: {} }],
    } : { ...movimento("1"), id: "inverso", data });
    await registrarInversoValorizadoTx(banco(tx), "original", "inverso");
    const parcela = tx.parcelaValorizacaoEstoque.createMany.mock.calls[0][0].data[0];
    expect([parcela.baseId, parcela.quantidade.toString(), parcela.valorTotal.toFixed(2)]).toEqual(["origem", "1", "3.34"]);
    expect(tx.baseValorizacaoEstoque.findMany).not.toHaveBeenCalled();
  });

  it("entrada com consumo posterior impede inverso antes de gravar parcelas", async () => {
    const tx = criarTx();
    tx.movimentoEstoque.findUniqueOrThrow.mockResolvedValue({ ...movimento("2"), metodoValorizacao: "FIFO_AQUISICAO_V1", parcelasValorizacao: [{ baseId: "origem", quantidade: D(2), valorTotal: D(10), ordem: 0 }], data });
    tx.parcelaValorizacaoEstoque.count.mockResolvedValue(1);
    await expect(registrarInversoValorizadoTx(banco(tx), "original", "inverso")).rejects.toMatchObject({ code: "CONFLITO" });
    expect(tx.parcelaValorizacaoEstoque.createMany).not.toHaveBeenCalled();
  });

  it("consumidor já estornado não bloqueia indefinidamente o inverso da entrada", async () => {
    const tx = criarTx();
    tx.movimentoEstoque.findUniqueOrThrow.mockResolvedValue({ ...movimento("2"), metodoValorizacao: "FIFO_AQUISICAO_V1", parcelasValorizacao: [{ baseId: "origem", quantidade: D(2), valorTotal: D(10), ordem: 0 }], data });
    tx.parcelaValorizacaoEstoque.count.mockImplementation(async consulta => consulta.where.movimentoEstoque.status === "CONFIRMADO" && consulta.where.movimentoEstoque.reversaoDeId === null ? 0 : 1);
    await registrarInversoValorizadoTx(banco(tx), "original", "inverso");
    expect(tx.parcelaValorizacaoEstoque.createMany).toHaveBeenCalled();
  });

  it("movimento legado abrangido por abertura exige regularização para estorno", async () => {
    const tx = criarTx();
    tx.movimentoEstoque.findUniqueOrThrow.mockResolvedValue({ ...movimento("2"), parcelasValorizacao: [] });
    tx.baseValorizacaoEstoque.count.mockResolvedValue(1);
    await expect(registrarInversoValorizadoTx(banco(tx), "legado", "inverso")).rejects.toMatchObject({ code: "CONFLITO" });
    expect(tx.parcelaValorizacaoEstoque.createMany).not.toHaveBeenCalled();
  });

  it("diagnóstico separa valor desconhecido de zero comprovado", async () => {
    const tx = criarTx(); configurarSaldo(tx, [], [movimento("10")]);
    expect((await diagnosticarValorizacaoTx(banco(tx), "produto", 1, data)).grupos[0]).toMatchObject({ estadoValor: "DESCONHECIDO", valor: null });
    configurarSaldo(tx, [base("gratuito", "10", "0.00")], [movimento("10")]);
    expect((await diagnosticarValorizacaoTx(banco(tx), "produto", 1, data)).grupos[0]).toMatchObject({ estadoValor: "CONHECIDO", valor: "0.00" });
  });

  it("abertura conserva origem FIFO e corte separado, sem disponibilizar saldo antes do corte", async () => {
    const tx = criarTx(); contexto.tx = tx; configurarSaldo(tx, [], [movimento("3")]);
    const previa = await diagnosticarValorizacaoTx(banco(tx), "produto", 1, data);
    await abrirValorizacao({ chave: "abertura", produtoId: "produto", propriedadeId: 1, data: "2026-10-16", revisao: previa.revisao,
      motivo: "Saldo residual comprovado", evidencia: "Documento de aquisição e contagem", bases: [
        { quantidade: "2", valor: "40.00", disponivelDesde: "2026-10-02", referencia: "segunda compra" },
        { quantidade: "1", valor: "10.00", disponivelDesde: "2026-10-01", referencia: "primeira compra" },
      ] }, 2);
    expect(tx.baseValorizacaoEstoque.create.mock.calls.map(([arg]) => [arg.data.disponivelDesde.toISOString().slice(0, 10), arg.data.corteAbertura.toISOString().slice(0, 10), arg.data.quantidadeAbertura]))
      .toEqual([["2026-10-01", "2026-10-16", "1"], ["2026-10-02", "2026-10-16", "2"]]);
    expect(tx.$executeRaw.mock.calls.map(chamada => (chamada as unknown[])[1])).toContain("abertura-valorizacao:abertura");
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.auditoriaFinanceira.findFirst.mock.invocationCallOrder[0]);
  });
});
