import { transacaoValidada } from "../../lib/transacao-validada.js";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../db.js";
import { exigirBancoIntegracaoPecuaria } from "../../lib/banco-pecuaria-integration.fixture.js";
import { criarEntradaValorizadaFixture, limparMovimentosValorizadosFixture, limparMovimentosValorizadosFixtureTx } from "../../test/estoque-valorizado.fixture.js";
import { diagnosticarValorizacao, planejarSaidaTx, registrarSaidaValorizadaTx, saldosBasesTx } from "./valorizacao.js";
import { transferirEstoque } from "./transferencias.js";
import { ativarRastreio, previaAtivacaoRastreio } from "./partidas.js";
import { listarMovimentos } from "./estoque.js";
import { origensProduto } from "./ficha-produto.js";

const comBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const D = (valor: Prisma.Decimal.Value) => new Prisma.Decimal(valor);
const produtos: string[] = [], sitios: number[] = [];
async function novoSitio() {
  const sitio = await prisma.propriedade.create({ data: { nome: `Valorização independente ${randomUUID()}` } });
  sitios.push(sitio.id); return sitio.id;
}
async function fixture(quantidade = "5", valor = "50.00") {
  exigirBancoIntegracaoPecuaria();
  const propriedadeId = await novoSitio();
  const produto = await prisma.produto.create({ data: { nome: `Valor ${randomUUID()}`, unidade: "UN" } });
  produtos.push(produto.id);
  const entrada = await criarEntradaValorizadaFixture({ data: { produtoId: produto.id, propriedadeId, tipo: "ENTRADA", origem: "INVENTARIO_INICIAL",
    data: new Date("2026-10-01"), quantidade, custoUnitario: D(valor).div(quantidade).toDecimalPlaces(4), valorTotal: valor } });
  const base = await prisma.baseValorizacaoEstoque.findFirstOrThrow({ where: { origemMovimentoId: entrada.id } });
  return { produtoId: produto.id, propriedadeId, entrada, base };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function saidaSQL(tx: Prisma.TransactionClient, f: Fixture, quantidade: string, valor: string, baseId = f.base.id, propriedadeId = f.propriedadeId, metodo = "FIFO_AQUISICAO_V1", data = new Date("2026-10-02")) {
  return tx.movimentoEstoque.create({ data: { produtoId: f.produtoId, propriedadeId, tipo: "SAIDA", origem: "AJUSTE_INVENTARIO", data,
    quantidade, custoUnitario: D(valor).div(quantidade).toDecimalPlaces(4), valorTotal: valor, metodoValorizacao: metodo,
    parcelasValorizacao: { create: { baseId, ordem: 0, quantidade: D(quantidade).negated(), valorTotal: D(valor).negated() } } } });
}

comBanco("valorização — garantias SQL, transações e concorrência com fixtures próprias", () => {
  beforeAll(() => { exigirBancoIntegracaoPecuaria(); });
  afterEach(async () => {
    if (!produtos.length && !sitios.length) return;
    const operacoes = await prisma.operacao.findMany({ where: { propriedadeId: { in: sitios } }, select: { id: true } });
    const grupos = await prisma.partidaProduto.findMany({ where: { produtoId: { in: produtos } }, select: { id: true } });
    await limparMovimentosValorizadosFixture(produtos);
    await prisma.auditoriaFinanceira.deleteMany({ where: { entidadeId: { in: [...operacoes.map(o => o.id), ...produtos, ...grupos.map(g => g.id)] } } });
    await prisma.operacao.deleteMany({ where: { id: { in: operacoes.map(o => o.id) } } });
    await prisma.produto.updateMany({ where: { id: { in: produtos } }, data: { rastrearPartidas: false } });
    await prisma.partidaProduto.deleteMany({ where: { produtoId: { in: produtos } } });
    await prisma.produto.deleteMany({ where: { id: { in: produtos } } });
    await prisma.propriedade.deleteMany({ where: { id: { in: sitios } } });
    produtos.length = 0; sitios.length = 0;
  });

  it("diagnóstico histórico mantém quantidade e valor no mesmo corte, sem incluir saída posterior", async () => {
    const f = await fixture();
    await transacaoValidada(tx => saidaSQL(tx, f, "1", "10.00"));
    const anterior = await diagnosticarValorizacao(f.produtoId, f.propriedadeId, new Date("2026-10-01"));
    expect(anterior.grupos).toMatchObject([{ quantidade: "5", quantidadeValorizada: "5", valor: "50.00", estadoValor: "CONHECIDO" }]);
    const atual = await diagnosticarValorizacao(f.produtoId, f.propriedadeId, new Date("2026-10-02"));
    expect(atual.grupos).toMatchObject([{ quantidade: "4", quantidadeValorizada: "4", valor: "40.00", estadoValor: "CONHECIDO" }]);
  });

  it("recusa movimento valorizado sem parcelas ao confirmar a transação", async () => {
    const f = await fixture();
    await expect(transacaoValidada(tx => tx.movimentoEstoque.create({ data: { produtoId: f.produtoId, propriedadeId: f.propriedadeId,
      tipo: "SAIDA", origem: "AJUSTE_INVENTARIO", data: new Date("2026-10-02"), quantidade: 1, custoUnitario: 10, valorTotal: 10, metodoValorizacao: "FIFO_AQUISICAO_V1" } })))
      .rejects.toThrow();
    expect(await prisma.movimentoEstoque.count({ where: { produtoId: f.produtoId } })).toBe(1);
  });

  it("permite completar movimento e parcelas antes da conferência final diferida", async () => {
    const f = await fixture();
    const id = await transacaoValidada(async tx => {
      const m = await tx.movimentoEstoque.create({ data: { produtoId:f.produtoId, propriedadeId:f.propriedadeId, tipo:"SAIDA", origem:"AJUSTE_INVENTARIO",data:new Date("2026-10-02"),quantidade:1,custoUnitario:10,valorTotal:10,metodoValorizacao:"FIFO_AQUISICAO_V1" } });
      expect(await tx.parcelaValorizacaoEstoque.count({where:{movimentoEstoqueId:m.id}})).toBe(0);
      await tx.parcelaValorizacaoEstoque.create({data:{movimentoEstoqueId:m.id,baseId:f.base.id,ordem:0,quantidade:-1,valorTotal:-10}});
      return m.id;
    });
    expect(await prisma.parcelaValorizacaoEstoque.count({where:{movimentoEstoqueId:id}})).toBe(1);
  });

  it("parcelas que não fecham o valor do movimento não deixam fato parcial", async () => {
    const f = await fixture();
    await expect(transacaoValidada(async tx => {
      const movimento = await saidaSQL(tx, f, "1", "10.00");
      // Inserção inconsistente na mesma transação testa a conciliação diferida.
      await tx.parcelaValorizacaoEstoque.deleteMany({ where: { movimentoEstoqueId: movimento.id } });
      await tx.parcelaValorizacaoEstoque.create({ data: { movimentoEstoqueId: movimento.id, baseId: f.base.id, ordem: 0, quantidade: -1, valorTotal: -9 } });
    })).rejects.toThrow();
    expect(await prisma.movimentoEstoque.count({ where: { produtoId: f.produtoId, tipo: "SAIDA" } })).toBe(0);
  });

  it("não permite usar base de outro sítio", async () => {
    const f = await fixture(), outro = await novoSitio();
    await expect(transacaoValidada(tx => saidaSQL(tx, f, "1", "10.00", f.base.id, outro))).rejects.toThrow();
  });

  it("não permite usar base de outro produto", async () => {
    const f = await fixture(), outro = await fixture();
    await expect(transacaoValidada(tx => saidaSQL(tx, f, "1", "10.00", outro.base.id))).rejects.toThrow();
  });

  it("recusa método desconhecido no movimento", async () => {
    const f = await fixture();
    await expect(transacaoValidada(tx => saidaSQL(tx, f, "1", "10.00", f.base.id, f.propriedadeId, "INVENTADO"))).rejects.toThrow();
  });

  it("não permite editar base, parcela nem rebaixar movimento confirmado para LEGADO", async () => {
    const f = await fixture();
    await expect(transacaoValidada(tx=>tx.baseValorizacaoEstoque.update({ where: { id: f.base.id }, data: { valorAbertura: 1 } }))).rejects.toThrow();
    const parcela = await prisma.parcelaValorizacaoEstoque.findFirstOrThrow({ where: { movimentoEstoqueId: f.entrada.id } });
    await expect(transacaoValidada(tx=>tx.parcelaValorizacaoEstoque.update({ where: { id: parcela.id }, data: { valorTotal: 49 } }))).rejects.toThrow();
    await expect(transacaoValidada(tx=>tx.movimentoEstoque.update({ where: { id: f.entrada.id }, data: { metodoValorizacao: "LEGADO" } }))).rejects.toThrow();
    expect((await prisma.movimentoEstoque.findUniqueOrThrow({ where: { id: f.entrada.id } })).valorTotal.toString()).toBe("50");
  });

  it("base não pode ficar com quantidade ou valor residual negativos", async () => {
    const f = await fixture("1", "10.00");
    await expect(transacaoValidada(tx => saidaSQL(tx, f, "2", "20.00"))).rejects.toThrow();
  });

  it("esgotar a quantidade exige esgotar exatamente o valor", async () => {
    const f = await fixture();
    await expect(transacaoValidada(tx => saidaSQL(tx, f, "5", "49.99"))).rejects.toThrow();
  });

  it("apagar parcela isolada ou base usada não contorna a história", async () => {
    const f = await fixture();
    await expect(transacaoValidada(tx=>tx.parcelaValorizacaoEstoque.deleteMany({ where: { movimentoEstoqueId: f.entrada.id } }))).rejects.toThrow();
    await expect(transacaoValidada(tx=>tx.baseValorizacaoEstoque.delete({ where: { id: f.base.id } }))).rejects.toThrow();
    expect(await prisma.parcelaValorizacaoEstoque.count({ where: { movimentoEstoqueId: f.entrada.id } })).toBe(1);
  });

  it("abertura não autoriza saída anterior ao corte mesmo quando a origem é mais antiga", async () => {
    const f = await fixture();
    await limparMovimentosValorizadosFixture([f.produtoId]);
    const abertura = await prisma.baseValorizacaoEstoque.create({ data: { produtoId: f.produtoId, propriedadeId: f.propriedadeId,
      metodo: "FIFO_AQUISICAO_V1", disponivelDesde: new Date("2026-09-01"), corteAbertura: new Date("2026-10-01"), quantidadeAbertura: 5, valorAbertura: 50,
      aberturaDocumentada: { chave: randomUUID(), corte: "2026-10-01", referencia: "Compra conferida", motivo: "Saldo residual comprovado", evidencia: "Documento e contagem", usuarioId: null, revisao: "a".repeat(64) } } });
    await expect(transacaoValidada(tx => saidaSQL(tx, f, "1", "10.00", abertura.id, f.propriedadeId, "FIFO_AQUISICAO_V1", new Date("2026-09-30")))).rejects.toThrow();
  });

  it("limpeza administrativa completa remove somente as fixtures na mesma transação", async () => {
    const f = await fixture();
    await transacaoValidada(tx => limparMovimentosValorizadosFixtureTx(tx, [f.produtoId]));
    expect(await prisma.movimentoEstoque.count({ where: { produtoId: f.produtoId } })).toBe(0);
    expect(await prisma.baseValorizacaoEstoque.count({ where: { produtoId: f.produtoId } })).toBe(0);
    expect(await prisma.produto.count({ where: { id: f.produtoId } })).toBe(1);
  });

  it("falha depois da gravação reverte movimento e parcelas atomicamente", async () => {
    const f = await fixture();
    await expect(transacaoValidada(async tx => {
      const plano = await planejarSaidaTx(tx, { produtoId: f.produtoId, propriedadeId: f.propriedadeId, data: new Date("2026-10-02"), quantidade: 1 });
      const movimento = await tx.movimentoEstoque.create({ data: { produtoId: f.produtoId, propriedadeId: f.propriedadeId,
        tipo: "SAIDA", origem: "AJUSTE_INVENTARIO", data: new Date("2026-10-02"), quantidade: 1, custoUnitario: plano.custoUnitario, valorTotal: plano.valorTotal } });
      await registrarSaidaValorizadaTx(tx, movimento.id, plano);
      throw new Error("Falha simulada após registrar o fato");
    })).rejects.toThrow("Falha simulada");
    expect(await prisma.movimentoEstoque.count({ where: { produtoId: f.produtoId, tipo: "SAIDA" } })).toBe(0);
    const saldo = await transacaoValidada(tx => saldosBasesTx(tx, f.produtoId, f.propriedadeId));
    expect(saldo[0].quantidade.toString()).toBe("5"); expect(saldo[0].valor.toString()).toBe("50");
  });

  it("duas confirmações concorrentes da mesma chave geram uma única transferência", async () => {
    const f = await fixture("1", "10.00"), destinoId = await novoSitio();
    const input = { chave: randomUUID(), produtoId: f.produtoId, origemId: f.propriedadeId, destinoId, quantidade: "1", data: "2026-10-02", motivo: "Reposição documentada entre sítios" };
    const [primeira, segunda] = await Promise.all([transferirEstoque(input, null), transferirEstoque(input, null)]);
    expect(segunda).toEqual(primeira);
    expect(await prisma.movimentoEstoque.count({ where: { produtoId: f.produtoId, tipo: "SAIDA" } })).toBe(1);
  });

  it("duas saídas concorrentes disputam a mesma unidade sem saldo negativo", async () => {
    const f = await fixture("1", "10.00"), destinoId = await novoSitio();
    const resultados = await Promise.allSettled([1, 2].map(() => transferirEstoque({ chave: randomUUID(), produtoId: f.produtoId,
      origemId: f.propriedadeId, destinoId, quantidade: "1", data: "2026-10-02", motivo: "Reposição documentada entre sítios" }, null)));
    expect(resultados.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const saldo = await transacaoValidada(tx => saldosBasesTx(tx, f.produtoId, f.propriedadeId));
    expect(saldo[0].quantidade.isZero()).toBe(true); expect(saldo[0].valor.isZero()).toBe(true);
  });

  it("FIFO após transferência conserva as aquisições de R$ 40 e R$ 65", async () => {
    const f = await fixture("1", "40.00"), destinoId = await novoSitio();
    await criarEntradaValorizadaFixture({ data: { produtoId: f.produtoId, propriedadeId: f.propriedadeId, tipo: "ENTRADA", origem: "COMPRA",
      data: new Date("2026-10-02"), quantidade: 1, custoUnitario: 65, valorTotal: 65 } });
    await transferirEstoque({ chave: randomUUID(), produtoId: f.produtoId, origemId: f.propriedadeId, destinoId, quantidade: "2", data: "2026-10-03", motivo: "Transferência das aquisições comprovadas" }, null);
    const proxima = await transferirEstoque({ chave: randomUUID(), produtoId: f.produtoId, origemId: destinoId, destinoId: f.propriedadeId,
      quantidade: "1", data: "2026-10-04", motivo: "Retorno físico de uma unidade" }, null);
    const saida = await prisma.movimentoEstoque.findFirstOrThrow({ where: { operacaoId: proxima.operacaoId, tipo: "SAIDA" } });
    expect(saida.valorTotal.toFixed(2)).toBe("40.00");
  });

  it("ativar rastreio preserva valores FIFO históricos nos leitores filtrados pelo grupo técnico", async () => {
    const f = await fixture("1", "40.00");
    await criarEntradaValorizadaFixture({ data: { produtoId: f.produtoId, propriedadeId: f.propriedadeId, tipo: "ENTRADA", origem: "COMPRA",
      data: new Date("2026-10-02"), quantidade: 1, custoUnitario: 65, valorTotal: 65 } });
    const previa = await previaAtivacaoRastreio(f.produtoId);
    const ativacao = await ativarRastreio(f.produtoId, null, previa.revisao);
    expect(ativacao.partidaLegadaId).toBeTruthy();
    const partidaId = ativacao.partidaLegadaId!;
    const movimentos = await listarMovimentos({ produtoId: f.produtoId, propriedadeId: f.propriedadeId, partidaId });
    expect(movimentos.itens.map(m => m.valorTotal).sort((a,b) => a! - b!)).toEqual([40, 65]);
    const origens = await origensProduto(f.produtoId, f.propriedadeId, { partidaId, pagina: 1, porPagina: 20 }, true, true);
    expect(origens.itens.map(m => m.valorTotal).sort()).toEqual(["40", "65"]);
    const bases = await transacaoValidada(tx => saldosBasesTx(tx, f.produtoId, f.propriedadeId));
    expect(bases).toHaveLength(1);
    expect([bases[0].quantidade.toString(), bases[0].valor.toString()]).toEqual(["2", "105"]);
  });
});
