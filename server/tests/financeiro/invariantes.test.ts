import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";
import type { PrismaClient } from "@prisma/client";
import { SEM_VINCULO } from "../../src/lib/ids.js";
import { uid } from "../../src/lib/uid.fixture.js";
import { preverEfeitosOperacao, type ContextoOperacao } from "@rionovo/shared";

// O runner usa um banco temporário criado por execução no Postgres local.
const qaDatabase = process.env.FINANCE_QA_DATABASE;
const url = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/invalid");
if (!qaDatabase || !/^qa249_test_[a-f0-9]{16}$/.test(qaDatabase) || url.pathname !== `/${qaDatabase}` || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
  throw new Error("Use pnpm --filter rionovo-server test:financeiro:integration");
}
// Injeção de um Prisma REAL apontado para o banco temporário; não simula métodos/queries.
vi.mock("../../src/db.js", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  return { prisma: new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) }) };
});
let db: PrismaClient;
let ops: typeof import("../../src/services/financeiro/operacoes.js");
let drafts: typeof import("../../src/services/financeiro/rascunhos.js");
let accounts: typeof import("../../src/services/financeiro/contas.js");
let stock: typeof import("../../src/services/estoque/estoque.js");
let schema: typeof import("../../src/services/financeiro/schemas.js");
let pid: number, accountId: string, partnerId: string, productId: string, userId: number, centroConsumoId: string;
let serial = 0;
const data = new Date("2026-09-01T12:00:00Z");
const evidence: unknown[] = [];

beforeAll(async () => {
  db = (await import("../../src/db.js")).prisma;
  ops = await import("../../src/services/financeiro/operacoes.js");
  drafts = await import("../../src/services/financeiro/rascunhos.js");
  accounts = await import("../../src/services/financeiro/contas.js");
  stock = await import("../../src/services/estoque/estoque.js");
  schema = await import("../../src/services/financeiro/schemas.js");
  const rows = await db.$queryRaw<{ name: string }[]>`SELECT current_database()::text AS name`;
  expect(rows[0].name).toBe(qaDatabase);
});
beforeEach(async () => {
  serial++;
  pid = (await db.propriedade.create({ data: { nome: `QA propriedade ${serial}` } })).id;
  accountId = (await db.contaFinanceira.create({ data: { nome: "Banco QA", tipo: "BANCO", propriedadeId: pid, saldoAbertura: 1000, dataSaldoAbertura: data } })).id;
  partnerId = (await db.parceiro.create({ data: { nome: `Parceiro ${serial}`, papeis: { create: [{ papel: "FORNECEDOR" }, { papel: "CLIENTE" }] } } })).id;
  // Todo produto tem categoria; se ele entra no estoque quem decide é o tipo da operação.
  productId = (await db.produto.create({ data: { nome: `Produto ${serial}`, unidade: "KG", categoria: { create: { nome: `Insumos QA ${serial}`, classificacao: "CUSTEIO" } } } })).id;
  // Consumo direto não vai para o estoque: o custo precisa de um centro.
  centroConsumoId = (await db.centroCusto.create({ data: { nome: `Consumo direto ${serial}` } })).id;
  userId = (await db.usuario.create({ data: { nome: "QA", email: `qa${serial}@example.test`, papel: "gestor", abas: [], flags: [] } })).id;
});
afterAll(async () => {
  writeFileSync(join(process.env.FINANCE_QA_REPORT_DIR!, "estados.json"), JSON.stringify(evidence, null, 2));
  await db?.$disconnect();
});
function input(condicao = "A_PRAZO", tipo = "COMPRA_ESTOQUE") {
  return { ...schema.operacaoSchema.parse({
    tipo, data, descricao: "Compra QA 10 kg", parceiroId: partnerId,
    ...(tipo === "COMPRA_CONSUMO_DIRETO" ? { centroCustoId: centroConsumoId } : {}),
    itens: tipo === "SERVICO" ? [] : [{ produtoId: productId, descricao: "Produto QA", quantidade: 10, unidade: "kg", valorUnitario: 10, estocavel: true }],
    valorTotal: 100,
    financeiro: condicao === "SEM_EFEITO_FINANCEIRO" ? { condicao } : condicao === "A_VISTA" ? { condicao, contaId: accountId } : condicao === "PARCIAL" ? { condicao, contaId: accountId, valorPago: 40, parcelas: [{ valor: 60, dataVencimento: "2026-10-01" }] } : { condicao, parcelas: [{ valor: 100, dataVencimento: "2026-10-01" }] },
  }), propriedadeId: pid, usuarioId: userId };
}
async function snapshot(label: string) {
  const state = {
    saldoConta: Number((await accounts.listarContas(pid, true))[0].saldoAtual),
    saldoEstoque: (await stock.listarSaldos({ propriedadeId: pid })).find(p => p.produtoId === productId)?.saldo ?? 0,
    operacoes: await db.operacao.findMany({ where: { propriedadeId: pid }, include: { itens: true, compromissos: { include: { liquidacoes: true } }, transacoes: { include: { movimentos: true } }, movimentosEstoque: true, documentos: true }, orderBy: { id: "asc" } }),
    rascunhos: await db.rascunhoOperacao.findMany({ where: { propriedadeId: pid }, include: { documentos: true } }),
    auditoria: await db.auditoriaFinanceira.findMany({ where: { usuarioId: userId } }),
  };
  evidence.push({ caso: serial, label, state });
  return state;
}
async function pay(id: string, valor: number) { return ops.liquidarCompromisso(id, { data, valor, contaId: accountId, usuarioId: userId, propriedadeId: pid }); }

// Falha REAL do PostgreSQL, depois de operação, itens, estoque e dinheiro terem
// sido inseridos. Não substitui Prisma, serviços ou $transaction por mocks.
async function failAudit(action: () => Promise<unknown>) {
  await db.$executeRawUnsafe(`CREATE FUNCTION qa249_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA249_FALHA_INDUZIDA'; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER qa249_fail BEFORE INSERT ON "AuditoriaFinanceira" FOR EACH ROW EXECUTE FUNCTION qa249_fail()`);
  try { await expect(action()).rejects.toThrow("QA249_FALHA_INDUZIDA"); }
  finally {
    await db.$executeRawUnsafe(`DROP TRIGGER qa249_fail ON "AuditoriaFinanceira"`);
    await db.$executeRawUnsafe(`DROP FUNCTION qa249_fail()`);
  }
}

describe("#249 — regras reais Financeiro/Estoque", () => {
  it("compra à vista cria entrada, pagamento e vínculos coerentes", async () => {
    await snapshot("antes");
    const op = await ops.criarOperacao(input("A_VISTA"));
    const state = await snapshot("confirmada");
    expect(state.saldoConta).toBe(900); expect(state.saldoEstoque).toBe(10);
    expect(op.compromissos).toHaveLength(0);
    expect(op.movimentosEstoque).toHaveLength(1);
    expect(op.movimentosEstoque[0]).toMatchObject({ operacaoId: op.id, itemOperacaoId: op.itens[0].id, propriedadeId: pid, origem: "COMPRA" });
    expect(Number(op.movimentosEstoque[0].quantidade)).toBe(10);
    expect(Number(op.movimentosEstoque[0].custoUnitario)).toBe(10);
    expect(Number(op.movimentosEstoque[0].valorTotal)).toBe(100);
    expect(op.itens[0].unidade).toBe("kg");
  });
  it("compra a prazo e duas liquidações não duplicam estoque", async () => {
    await snapshot("antes"); const op = await ops.criarOperacao(input());
    expect((await snapshot("a prazo")).saldoConta).toBe(1000);
    await pay(op.compromissos[0].id, 40);
    expect((await snapshot("liquidação parcial")).saldoConta).toBe(960);
    await pay(op.compromissos[0].id, 60);
    const state = await snapshot("quitada");
    expect(state.saldoConta).toBe(900); expect(state.saldoEstoque).toBe(10);
    expect(state.operacoes[0].movimentosEstoque).toHaveLength(1);
    expect(state.operacoes[0].compromissos[0]).toMatchObject({ status: "LIQUIDADO" });
    expect(state.operacoes[0].compromissos[0].liquidacoes).toHaveLength(2);
  });
  it("pagamento parcial imediato cria compromisso apenas pelo restante", async () => {
    await snapshot("antes"); const op = await ops.criarOperacao(input("PARCIAL"));
    const state = await snapshot("parcial");
    expect(state.saldoConta).toBe(960); expect(state.saldoEstoque).toBe(10);
    expect(Number(op.compromissos[0].valorOriginal)).toBe(60);
  });
  it.each(["SERVICO", "COMPRA_CONSUMO_DIRETO"])("%s não altera estoque", async tipo => {
    await snapshot("antes"); await ops.criarOperacao(input("A_VISTA", tipo));
    const state = await snapshot("confirmada");
    expect(state.saldoConta).toBe(900); expect(state.saldoEstoque).toBe(0);
    expect(state.operacoes[0].movimentosEstoque).toHaveLength(0);
  });
  it.each(["INVENTARIO_INICIAL", "BONIFICACAO", "PRODUCAO", "AJUSTE_ESTOQUE"])("%s não cria efeito financeiro", async tipo => {
    await snapshot("antes"); await ops.criarOperacao(input("SEM_EFEITO_FINANCEIRO", tipo));
    const state = await snapshot("confirmada");
    expect(state.saldoConta).toBe(1000); expect(state.saldoEstoque).toBe(10);
    expect(state.operacoes[0].transacoes).toHaveLength(0); expect(state.operacoes[0].compromissos).toHaveLength(0);
  });
  it("rascunho não produz efeitos e confirmação promove documentos", async () => {
    const before = await snapshot("antes");
    const draft = await drafts.salvarRascunho({ propriedadeId: pid, usuarioId: userId, dados: { operacao: JSON.parse(JSON.stringify(input("A_VISTA"))) } });
    await db.documentoFinanceiro.create({ data: { nome: "Nota QA", tipo: "NOTA_FISCAL", rascunhoId: draft.id } });
    const saved = await snapshot("rascunho");
    expect(saved.operacoes).toEqual(before.operacoes); expect(saved.saldoConta).toBe(1000); expect(saved.saldoEstoque).toBe(0);
    const op = await drafts.confirmarRascunho(pid, userId, draft.versao);
    const final = await snapshot("confirmada");
    expect(final.rascunhos).toHaveLength(0); expect(final.saldoEstoque).toBe(10); expect(final.saldoConta).toBe(900);
    expect(op.documentos).toHaveLength(1);
  });
  it("falha após efeitos físicos/financeiros faz rollback completo", async () => {
    const before = await snapshot("antes");
    await failAudit(() => ops.criarOperacao(input("PARCIAL")));
    expect(await snapshot("após falha")).toEqual(before);
  });
  it("falha ao confirmar preserva rascunho e documento para nova tentativa", async () => {
    const draft = await drafts.salvarRascunho({ propriedadeId: pid, usuarioId: userId, dados: { operacao: JSON.parse(JSON.stringify(input("PARCIAL"))) } });
    await db.documentoFinanceiro.create({ data: { nome: "Nota QA", tipo: "NOTA_FISCAL", rascunhoId: draft.id } });
    const before = await snapshot("rascunho antes");
    await failAudit(() => drafts.confirmarRascunho(pid, userId, draft.versao));
    expect(await snapshot("rascunho após falha")).toEqual(before);
    await drafts.confirmarRascunho(pid, userId, draft.versao);
    expect((await snapshot("nova tentativa")).operacoes).toHaveLength(1);
  });
  it("liquidação acima do restante não deixa pagamento parcial persistido", async () => {
    const op = await ops.criarOperacao(input()); await pay(op.compromissos[0].id, 40);
    const before = await snapshot("parcial");
    await expect(pay(op.compromissos[0].id, 61)).rejects.toThrow("excede");
    expect(await snapshot("rejeitada")).toEqual(before);
  });
  it.each(["A_VISTA", "A_PRAZO", "PARCIAL"])("cancelamento %s neutraliza estoque e dinheiro sem apagar histórico", async condicao => {
    await snapshot("antes"); const op = await ops.criarOperacao(input(condicao)); await snapshot("confirmada");
    await ops.estornarOperacao(op.id, "Cancelamento QA", { propriedadeId: pid, usuarioId: userId });
    const state = await snapshot("cancelada");
    expect.soft(state.saldoConta).toBe(1000); expect.soft(state.saldoEstoque).toBe(0);
    expect(state.operacoes[0].status).toBe("CANCELADA");
    expect(state.operacoes[0].movimentosEstoque).toHaveLength(2);
    expect(state.operacoes[0].movimentosEstoque.some(m => m.reversaoDeId === op.movimentosEstoque[0].id)).toBe(true);
    expect(state.operacoes[0].compromissos.every(c => c.status === "CANCELADO")).toBe(true);
  });
  it("estorno repetido é recusado sem gerar novos efeitos", async () => {
    const op = await ops.criarOperacao(input("A_VISTA")); await ops.estornarOperacao(op.id, "Primeiro estorno", { propriedadeId: pid, usuarioId: userId });
    const before = await snapshot("primeiro estorno");
    await expect(ops.estornarOperacao(op.id, "Segundo estorno", { propriedadeId: pid, usuarioId: userId })).rejects.toThrow("já foi cancelada");
    expect(await snapshot("repetição recusada")).toEqual(before);
  });
  it("estorno de liquidação reabre compromisso e preserva vínculo histórico", async () => {
    const op = await ops.criarOperacao(input()); const tx = await pay(op.compromissos[0].id, 100);
    const before = await snapshot("liquidada");
    await ops.estornarTransacao(tx.id, "Estorno QA", { propriedadeId: pid, usuarioId: userId });
    const after = await snapshot("liquidação estornada");
    expect(after.saldoConta).toBe(1000); expect(after.saldoEstoque).toBe(10);
    expect(after.operacoes[0].compromissos[0].status).toBe("PENDENTE");
    expect(after.operacoes[0].compromissos[0].liquidacoes).toEqual(before.operacoes[0].compromissos[0].liquidacoes);
  });
  it.each(["VENDA", "DEVOLUCAO"])("%s retira estoque e registra recebimento", async tipo => {
    await ops.criarOperacao(input("SEM_EFEITO_FINANCEIRO", "INVENTARIO_INICIAL"));
    await snapshot("estoque inicial");
    await ops.criarOperacao(input("A_VISTA", tipo));
    const state = await snapshot("saída confirmada");
    expect(state.saldoEstoque).toBe(0); expect(state.saldoConta).toBe(1100);
  });
  it.each(["inativa", "outra propriedade", "período fechado", "parceiro inativo"])("rejeita %s sem efeitos parciais", async motivo => {
    if (motivo === "inativa") await db.contaFinanceira.update({ where: { id: accountId }, data: { ativo: false } });
    if (motivo === "outra propriedade") {
      const outra = await db.propriedade.create({ data: { nome: `Outra ${serial}` } });
      accountId = (await db.contaFinanceira.create({ data: { nome: "Conta outra", tipo: "BANCO", propriedadeId: outra.id, dataSaldoAbertura: data } })).id;
    }
    if (motivo === "período fechado") await db.periodoFinanceiro.create({ data: { propriedadeId: pid, ano: 2026, mes: 9, status: "FECHADO" } });
    if (motivo === "parceiro inativo") await db.parceiro.update({ where: { id: partnerId }, data: { ativo: false } });
    const before = await snapshot("antes");
    await expect(ops.criarOperacao(input("A_VISTA"))).rejects.toThrow();
    expect(await snapshot("recusada")).toEqual(before);
  });
  it("falha durante cancelamento conserva todos os efeitos originais", async () => {
    const op = await ops.criarOperacao(input("A_VISTA"));
    const before = await snapshot("confirmada");
    await failAudit(() => ops.estornarOperacao(op.id, "Cancelamento com falha", { propriedadeId: pid, usuarioId: userId }));
    expect(await snapshot("falha no cancelamento")).toEqual(before);
  });

  it("liquidações concorrentes não podem pagar mais que o compromisso", async () => {
    const op = await ops.criarOperacao(input()); await snapshot("compromisso de 100");
    const barrier = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await barrier.connect();
    const key = 2492026;
    let running: Promise<PromiseSettledResult<unknown>[]> | undefined;
    try {
      await barrier.query("SELECT pg_advisory_lock($1)", [key]);
      await db.$executeRawUnsafe(`CREATE FUNCTION qa249_barrier() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(${key}); RETURN NEW; END $$`);
      await db.$executeRawUnsafe(`CREATE TRIGGER qa249_barrier BEFORE INSERT ON "TransacaoFinanceira" FOR EACH ROW EXECUTE FUNCTION qa249_barrier()`);
      running = Promise.allSettled([pay(op.compromissos[0].id, 60), pay(op.compromissos[0].id, 60)]);
      // Ambas já leram o restante quando chegam à inserção. A barreira força
      // essa intercalação sem substituir nenhum serviço ou cliente por mock.
      let waiting = 0;
      for (let attempt = 0; attempt < 60 && waiting < 2; attempt++) {
        const result = await barrier.query("SELECT count(*)::int AS count FROM pg_locks WHERE locktype = 'advisory' AND objid = $1 AND NOT granted", [key]);
        waiting = result.rows[0].count;
        if (waiting < 2) await new Promise(resolve => setTimeout(resolve, 25));
      }
      expect(waiting, "duas liquidações devem alcançar a barreira").toBe(2);
      await barrier.query("SELECT pg_advisory_unlock($1)", [key]);
      const outcomes = await running;
      const state = await snapshot("após concorrência");
      evidence.push({ caso: serial, outcomes: outcomes.map(o => o.status) });
      const paid = state.operacoes[0].compromissos[0].liquidacoes.reduce((total, l) => total + Number(l.valor), 0);
      expect.soft(paid).toBeLessThanOrEqual(100);
      expect.soft(state.saldoConta).toBe(940);
      expect(outcomes.filter(o => o.status === "fulfilled")).toHaveLength(1);
    } finally {
      await barrier.query("SELECT pg_advisory_unlock_all()");
      await running;
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS qa249_barrier ON "TransacaoFinanceira"`);
      await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS qa249_barrier()`);
      await barrier.end();
    }
  });

  it("contagem encontrada reduz, aumenta e zera o estoque sem dinheiro", async () => {
    await ops.criarOperacao(input("SEM_EFEITO_FINANCEIRO", "INVENTARIO_INICIAL"));
    await snapshot("antes da contagem");
    for (const [saldoEsperado, quantidadeContada] of [[10, 8], [8, 12], [12, 0]]) {
      const r = await stock.ajustarContagem({ propriedadeId: pid, produtoId: productId, saldoEsperado, quantidadeContada, observacao: "Contagem física conferida", usuarioId: userId });
      expect(r.diferenca).toBe(quantidadeContada - saldoEsperado);
      const state = await snapshot(`contagem ${quantidadeContada}`);
      expect(state.saldoEstoque).toBe(quantidadeContada);
      expect(state.saldoConta).toBe(1000);
      const op = state.operacoes.find(o => o.id === r.operacaoId)!;
      expect(op.tipo).toBe("AJUSTE_ESTOQUE");
      expect(op.transacoes).toHaveLength(0); expect(op.compromissos).toHaveLength(0);
      expect(op.movimentosEstoque[0]).toMatchObject({ itemOperacaoId: op.itens[0].id, propriedadeId: pid, criadoPorId: userId });
    }
    expect(await db.auditoriaFinanceira.count({ where: { usuarioId: userId, acao: "AJUSTE_CONTAGEM" } })).toBe(3);
  });
  it("contagem com saldo antigo ou sem diferença não grava efeitos", async () => {
    await ops.criarOperacao(input("SEM_EFEITO_FINANCEIRO", "INVENTARIO_INICIAL"));
    const before = await snapshot("antes");
    await expect(stock.ajustarContagem({ propriedadeId: pid, produtoId: productId, saldoEsperado: 0, quantidadeContada: 8, observacao: "Contagem conferida", usuarioId: userId })).rejects.toThrow("estoque mudou");
    await expect(stock.ajustarContagem({ propriedadeId: pid, produtoId: productId, saldoEsperado: 10, quantidadeContada: 10, observacao: "Contagem conferida", usuarioId: userId })).rejects.toThrow("Nenhum ajuste");
    expect(await snapshot("recusadas")).toEqual(before);
  });
  it("falha de auditoria reverte ajuste de contagem inteiro", async () => {
    const before = await snapshot("antes");
    await failAudit(() => stock.ajustarContagem({ propriedadeId: pid, produtoId: productId, saldoEsperado: 0, quantidadeContada: 8, observacao: "Contagem conferida", usuarioId: userId }));
    expect(await snapshot("rollback contagem")).toEqual(before);
  });
  it("contagem usa somente movimentos da propriedade escolhida", async () => {
    await ops.criarOperacao(input("SEM_EFEITO_FINANCEIRO", "INVENTARIO_INICIAL"));
    const outra = await db.propriedade.create({ data: { nome: `Contagem outra ${serial}` } });
    await stock.ajustarContagem({ propriedadeId: outra.id, produtoId: productId, saldoEsperado: 0, quantidadeContada: 2, observacao: "Contagem outra propriedade", usuarioId: userId });
    expect((await snapshot("principal preservada")).saldoEstoque).toBe(10);
    expect((await stock.listarSaldos({ propriedadeId: outra.id })).find(p => p.produtoId === productId)?.saldo).toBe(2);
  });

});

describe("categorias por item e relatórios", () => {
  it("compra mista conserva snapshot, rateia parcelas e filtra por data, fazenda e centro", async () => {
    const { analisarCategorias } = await import("../../src/services/financeiro/analise-categorias.js");
    const { obterDashboard } = await import("../../src/services/financeiro/dashboard.js");
    const { gerarRelatorioGerencial } = await import("../../src/services/relatorio-gerencial.js");
    const silagem = await db.categoria.create({ data: { nome: `Silagem ${serial}`, classificacao: "CUSTEIO" } });
    const vacina = await db.categoria.create({ data: { nome: `Vacinas ${serial}`, classificacao: "INVESTIMENTO" } });
    const centro = await db.centroCusto.create({ data: { nome: `Pecuária ${serial}` } });
    await db.produto.update({ where: { id: productId }, data: { categoriaId: silagem.id, centrosCusto: { create: [{ centroCustoId: centro.id }] } } });
    const outro = await db.produto.create({ data: { nome: `Vacina ${serial}`, unidade: "UN", categoriaId: vacina.id } });
    const op = await ops.criarOperacao({ ...input(), valorTotal: 1000, centroCustoId: centro.id,
      itens: [{ produtoId: productId, descricao: "Silagem", quantidade: 1, unidade: "kg", valorUnitario: 800, estocavel: true }, { produtoId: outro.id, descricao: "Vacina", quantidade: 1, unidade: "un", valorUnitario: 200, estocavel: true }],
      financeiro: { condicao: "A_PRAZO", parcelas: [{ valor: 500, dataVencimento: new Date("2026-10-01") }, { valor: 500, dataVencimento: new Date("2026-11-01") }] },
    });
    expect(op.itens.map((i) => i.categoriaId)).toEqual([silagem.id, vacina.id]);
    // Silagem herda o único centro do produto; a vacina (produto sem centro) herda o da operação.
    expect(op.itens.map((i) => [i.centroCustoId, i.centroCustoNome])).toEqual([[centro.id, centro.nome], [null, null]]);
    expect(op.movimentosEstoque.map((m) => m.centroCustoId)).toEqual([centro.id, centro.id]);
    await db.produto.update({ where: { id: productId }, data: { categoriaId: vacina.id } });
    await db.categoria.update({ where: { id: silagem.id }, data: { nome: `Renomeada ${serial}`, classificacao: "INVESTIMENTO", ativo: false } });
    const filtro = { inicio: "2026-09-01", fim: "2026-11-30", base: "compras" as const, categoriaId: silagem.id };
    expect(await analisarCategorias(filtro, pid)).toMatchObject({ total: "800.00", categorias: [{ categoria: silagem.nome, valor: "800.00" }] });
    expect((await analisarCategorias({ ...filtro, centroCustoId: centro.id }, pid)).total).toBe("800.00");
    expect((await analisarCategorias({ ...filtro, centroCustoId: SEM_VINCULO }, pid)).total).toBe("0.00");
    expect((await analisarCategorias(filtro, pid + 9999)).total).toBe("0.00");
    expect((await analisarCategorias({ ...filtro, inicio: "2026-10-01" }, pid)).total).toBe("0.00");
    const pagamento = await pay(op.compromissos[0].id, 500);
    expect((await analisarCategorias({ ...filtro, base: "pagamentos" }, pid)).total).toBe("400.00");
    expect((await analisarCategorias({ ...filtro, base: "pendente" }, pid)).total).toBe("400.00");
    expect((await analisarCategorias({ ...filtro, base: "pendente", fim: "2026-10-31" }, pid)).total).toBe("0.00");
    const dashboard = await obterDashboard(pid, new Date(filtro.inicio), new Date(filtro.fim));
    expect(dashboard.despesasPorCategoria.map((c) => [c.categoria, Number(c.valor)])).toContainEqual([silagem.nome, 400]);
    const relatorio = await gerarRelatorioGerencial({ inicio: filtro.inicio, fim: filtro.fim, regime: "ambos" }, pid);
    expect(relatorio.categorias?.itens).toEqual(expect.arrayContaining([expect.objectContaining({ categoria: silagem.nome, total: 400 })]));
    const estorno = await ops.estornarTransacao(pagamento.id, "Estorno de teste", { propriedadeId: pid, usuarioId: userId });
    // Posiciona o estorno em outro mês para verificar a competência de caixa.
    await db.transacaoFinanceira.update({ where: { id: estorno.id }, data: { data: new Date("2026-10-02") } });
    expect((await analisarCategorias({ ...filtro, base: "pagamentos" }, pid)).total).toBe("0.00");
    expect((await analisarCategorias({ ...filtro, base: "pagamentos", inicio: "2026-10-01" }, pid)).total).toBe("-400.00");
    expect((await analisarCategorias({ ...filtro, base: "pendente" }, pid)).total).toBe("800.00");
    const relatorioEstornado = await gerarRelatorioGerencial({ inicio: filtro.inicio, fim: filtro.fim, regime: "ambos" }, pid);
    expect(relatorioEstornado.resumo.saidas).toBe(0);
    expect(relatorioEstornado.operacoes.find((o) => o.tipo === "estorno")).toMatchObject({ quantidade: 1, valor: 500 });
    expect(relatorioEstornado.operacoes.find((o) => o.tipo === "custeio")).toMatchObject({ quantidade: 1, valor: 400 });
    await ops.estornarOperacao(op.id, "Cancelar teste misto", { propriedadeId: pid, usuarioId: userId });
    expect((await analisarCategorias(filtro, pid)).total).toBe("0.00");
    expect((await analisarCategorias({ ...filtro, base: "pendente" }, pid)).total).toBe("0.00");
  });

  it("nota mista por centro: cada item vai ao seu centro e o não estocável sem centro herda o da operação", async () => {
    const { analisarCategorias } = await import("../../src/services/financeiro/analise-categorias.js");
    const { gerarRelatorioGerencial } = await import("../../src/services/relatorio-gerencial.js");
    const { comporItens } = await import("../../src/services/financeiro/relatorios.calc.js");
    const [x, y, sede] = await Promise.all(["X", "Y", "Sede"].map((nome) => db.centroCusto.create({ data: { nome: `${nome} ${serial}` } })));
    const op = await ops.criarOperacao({ ...input("A_VISTA", "COMPRA_CONSUMO_DIRETO"), valorTotal: 1000, centroCustoId: sede.id,
      itens: [
        { descricao: "A", quantidade: 1, unidade: "un", valorUnitario: 500, estocavel: false, centroCustoId: x.id },
        { descricao: "B", quantidade: 1, unidade: "un", valorUnitario: 300, estocavel: false, centroCustoId: y.id },
        { descricao: "C", quantidade: 1, unidade: "un", valorUnitario: 200, estocavel: false },
      ],
    });
    expect(op.itens.map((i) => [i.descricao, i.centroCustoId, i.centroCustoNome])).toEqual([["A", x.id, x.nome], ["B", y.id, y.nome], ["C", null, null]]);
    const operacoes = await db.operacao.findMany({ where: { propriedadeId: pid }, include: { itens: true, centroCusto: { select: { nome: true } }, parceiro: { select: { nome: true } } } });
    const semFiltro = { tipos: [] as never[], status: [] as never[], centroCustoIds: [], categoriaIds: [], classificacoes: [] as never[] };
    const composicao = comporItens(operacoes, semFiltro);
    expect(composicao.despesas.porCentro.map((c) => [c.nome, c.total])).toEqual([[x.nome, "500.00"], [y.nome, "300.00"], [sede.nome, "200.00"]]);
    expect(comporItens(operacoes, { ...semFiltro, centroCustoIds: [y.id] }).linhas.map((l) => l.item)).toEqual(["B"]);
    expect(comporItens(operacoes, { ...semFiltro, centroCustoIds: [SEM_VINCULO] }).linhas).toEqual([]);
    const filtro = { inicio: "2026-09-01", fim: "2026-09-30", base: "compras" as const };
    expect((await analisarCategorias({ ...filtro, centroCustoId: y.id }, pid))).toMatchObject({ total: "300.00", linhas: [{ centroCusto: y.nome }] });
    expect((await analisarCategorias({ ...filtro, centroCustoId: sede.id }, pid))).toMatchObject({ total: "200.00", linhas: [{ centroCusto: sede.nome }] });
    expect((await analisarCategorias({ ...filtro, centroCustoId: SEM_VINCULO }, pid)).total).toBe("0.00");
    expect((await analisarCategorias({ ...filtro, base: "pagamentos", centroCustoId: x.id }, pid)).total).toBe("500.00");
    const gerencial = await gerarRelatorioGerencial({ inicio: filtro.inicio, fim: filtro.fim, regime: "realizado" }, pid, { ...semFiltro, centroCustoIds: [y.id] });
    expect(gerencial.categorias?.centros).toEqual([{ centro: y.nome, total: 300, pct: 100 }]);
    expect((await gerarRelatorioGerencial({ inicio: filtro.inicio, fim: filtro.fim, regime: "realizado" }, pid, { ...semFiltro, centroCustoIds: [SEM_VINCULO] })).categorias?.centros).toEqual([]);

    // Caso positivo de centroCustoId: SEM_VINCULO — item estocável cujo produto tem 2 centros
    // fica sem centro efetivo (nem operação nem item definem um), então cai em SEM_VINCULO.
    const insumos = await db.categoria.create({ data: { nome: `Insumos sem centro ${serial}`, classificacao: "CUSTEIO" } });
    const produtoDoisCentros = await db.produto.create({ data: { nome: `Sem centro efetivo ${serial}`, unidade: "UN", categoriaId: insumos.id, centrosCusto: { create: [{ centroCustoId: x.id }, { centroCustoId: y.id }] } } });
    const semCentro = await ops.criarOperacao({ ...input("A_VISTA", "COMPRA_ESTOQUE"), valorTotal: 150, centroCustoId: undefined,
      itens: [{ produtoId: produtoDoisCentros.id, descricao: "Sem centro", quantidade: 1, unidade: "un", valorUnitario: 150, estocavel: true }],
    });
    expect(semCentro.itens[0]).toMatchObject({ centroCustoId: null, centroCustoNome: null });
    const semCentroFiltro = await analisarCategorias({ ...filtro, centroCustoId: SEM_VINCULO }, pid);
    expect(semCentroFiltro.total).toBe("150.00");
    expect(semCentroFiltro.linhas).toEqual([{ operacaoId: semCentro.id, descricao: semCentro.descricao, data: filtro.inicio, categoriaId: insumos.id, categoria: insumos.nome, centroCusto: "Sem centro de custo", classificacao: semCentro.itens[0].classificacao, valor: "150.00" }]);
    const gerencialZero = await gerarRelatorioGerencial({ inicio: filtro.inicio, fim: filtro.fim, regime: "realizado" }, pid, { ...semFiltro, centroCustoIds: [SEM_VINCULO] });
    expect(gerencialZero.categorias?.centros).toEqual([{ centro: "(Sem centro de custo)", total: 150, pct: 100 }]);
    expect((await analisarCategorias({ ...filtro, centroCustoId: x.id }, pid)).total).toBe("500.00");
  });

  it("item não estocável sem centro em operação sem centro é recusado; centro inativo também", async () => {
    const before = await snapshot("antes");
    const base = { ...input("A_VISTA", "COMPRA_CONSUMO_DIRETO"), centroCustoId: undefined };
    await expect(ops.criarOperacao({ ...base, itens: [{ descricao: "Frete", quantidade: 1, unidade: "un", valorUnitario: 100, estocavel: false }] }))
      .rejects.toMatchObject({ code: "VALIDACAO", campo: "itens.0.centroCustoId" });
    const inativo = await db.centroCusto.create({ data: { nome: `Inativo ${serial}`, ativo: false } });
    await expect(ops.criarOperacao({ ...base, itens: [{ descricao: "Frete", quantidade: 1, unidade: "un", valorUnitario: 100, estocavel: false, centroCustoId: inativo.id }] }))
      .rejects.toMatchObject({ code: "VALIDACAO", campo: "itens.0.centroCustoId" });
    await expect(ops.criarOperacao({ ...base, centroCustoId: inativo.id, itens: [{ descricao: "Frete", quantidade: 1, unidade: "un", valorUnitario: 100, estocavel: false }] }))
      .rejects.toMatchObject({ code: "VALIDACAO", campo: "centroCustoId" });
    // Compra para consumo direto nunca movimenta estoque: mesmo com produto (e o
    // cliente marcando estocável), o item precisa de centro — o tipo decide.
    await expect(ops.criarOperacao({ ...base, itens: [{ produtoId: productId, descricao: "Produto QA", quantidade: 1, unidade: "kg", valorUnitario: 100, estocavel: true }] }))
      .rejects.toMatchObject({ code: "VALIDACAO", campo: "itens.0.centroCustoId" });
    // Em compra para estoque o item com produto é estocável (mesmo que o cliente
    // mande false) e pode ficar sem centro.
    const ok = await ops.criarOperacao({ ...input("A_VISTA", "COMPRA_ESTOQUE"), centroCustoId: undefined, itens: [{ produtoId: productId, descricao: "Produto QA", quantidade: 1, unidade: "kg", valorUnitario: 100, estocavel: false }] });
    expect(ok.itens[0]).toMatchObject({ estocavel: true, centroCustoId: null, centroCustoNome: null });
    expect(ok.movimentosEstoque).toHaveLength(1);
    expect((await snapshot("depois")).operacoes).toHaveLength(before.operacoes.length + 1);
  });

  it("produto com 1 centro transmite ao item; com 2 centros o item fica sem centro; null explícito ignora o produto", async () => {
    const [a, b] = await Promise.all(["A", "B"].map((nome) => db.centroCusto.create({ data: { nome: `Centro ${nome} ${serial}` } })));
    const categoriaId = (await db.produto.findUniqueOrThrow({ where: { id: productId } })).categoriaId;
    const umCentro = await db.produto.create({ data: { nome: `Um centro ${serial}`, unidade: "UN", categoriaId, centrosCusto: { create: [{ centroCustoId: a.id }] } } });
    const doisCentros = await db.produto.create({ data: { nome: `Dois centros ${serial}`, unidade: "UN", categoriaId, centrosCusto: { create: [{ centroCustoId: a.id }, { centroCustoId: b.id }] } } });
    const op = await ops.criarOperacao({ ...input("A_VISTA"), valorTotal: 400, centroCustoId: b.id, itens: [
      { produtoId: umCentro.id, descricao: "Um", quantidade: 1, unidade: "un", valorUnitario: 100, estocavel: true },
      { produtoId: doisCentros.id, descricao: "Dois", quantidade: 1, unidade: "un", valorUnitario: 100, estocavel: true },
      { produtoId: umCentro.id, descricao: "Um, herda da operação", quantidade: 1, unidade: "un", valorUnitario: 100, estocavel: true, centroCustoId: null },
      { produtoId: doisCentros.id, descricao: "Dois, explícito", quantidade: 1, unidade: "un", valorUnitario: 100, estocavel: true, centroCustoId: b.id },
    ] });
    expect(op.itens.map((i) => [i.centroCustoId, i.centroCustoNome])).toEqual([[a.id, a.nome], [null, null], [null, null], [b.id, b.nome]]);
    expect(op.movimentosEstoque.map((m) => m.centroCustoId)).toEqual([a.id, b.id, b.id, b.id]);
  });

  it("serviço sem itens registra categoria e classificação e aceita item avulso sem categoria", async () => {
    const categoria = await db.categoria.create({ data: { nome: `Serviços ${serial}`, classificacao: "CUSTEIO" } });
    const op = await ops.criarOperacao({ ...input("A_VISTA", "SERVICO"), parceiroId: undefined, categoriaId: categoria.id, classificacao: "INVESTIMENTO" });
    expect(op).toMatchObject({ categoriaNome: categoria.nome, classificacao: "INVESTIMENTO" });
    // Item avulso não estocável precisa de um centro efetivo — aqui o da operação.
    const centro = await db.centroCusto.create({ data: { nome: `Sede ${serial}` } });
    const avulso = await ops.criarOperacao({ ...input("A_VISTA", "COMPRA_CONSUMO_DIRETO"), centroCustoId: centro.id, itens: [{ descricao: "Material sem cadastro", quantidade: 1, unidade: "un", valorUnitario: 100, estocavel: false }] });
    expect(avulso.itens[0]).toMatchObject({ categoriaId: null, categoriaNome: null, centroCustoId: null, centroCustoNome: null });
  });
});


describe("correções da revisão", () => {
  it("inclui pagamentos avulsos e suas reversões sem misturar receitas, datas ou fazendas", async () => {
    const { analisarCategorias } = await import("../../src/services/financeiro/analise-categorias.js");
    const filtro = { inicio: "2026-09-01", fim: "2026-11-30", base: "pagamentos" as const };
    const pagamento = await ops.criarTransacaoAvulsa({ tipo: "PAGAMENTO", propriedadeId: pid, contaId: accountId, data, valor: 100, descricao: "Frete avulso" });
    await ops.criarTransacaoAvulsa({ tipo: "RECEBIMENTO", propriedadeId: pid, contaId: accountId, data, valor: 75, descricao: "Recebimento avulso" });
    expect(await analisarCategorias(filtro, pid)).toMatchObject({ total: "100.00", linhas: [{ operacaoId: null, contaId: accountId, movimentoId: pagamento.movimentos[0].id, categoria: "Sem categoria", valor: "100.00" }] });
    expect((await analisarCategorias({ ...filtro, categoriaId: SEM_VINCULO, centroCustoId: SEM_VINCULO }, pid)).total).toBe("100.00");
    expect((await analisarCategorias({ ...filtro, categoriaId: uid(999999) }, pid)).total).toBe("0.00");
    expect((await analisarCategorias({ ...filtro, centroCustoId: uid(999999) }, pid)).total).toBe("0.00");
    expect((await analisarCategorias({ ...filtro, base: "compras" }, pid)).total).toBe("0.00");
    expect((await analisarCategorias(filtro, pid + 99999)).total).toBe("0.00");
    const estorno = await ops.estornarTransacao(pagamento.id, "Reverter frete avulso", { propriedadeId: pid, usuarioId: userId });
    await db.transacaoFinanceira.update({ where: { id: estorno.id }, data: { data: new Date("2026-10-02") } });
    expect((await analisarCategorias(filtro, pid)).total).toBe("0.00");
    expect((await analisarCategorias({ ...filtro, fim: "2026-09-30" }, pid)).total).toBe("100.00");
    expect((await analisarCategorias({ ...filtro, inicio: "2026-10-01" }, pid)).total).toBe("-100.00");
  });

  it("rejeita ajuste sem fazenda no consolidado e preserva os estoques", async () => {
    const outra = await db.propriedade.create({ data: { nome: `Segunda fazenda da revisão ${serial}` } });
    await ops.criarOperacao(input("SEM_EFEITO_FINANCEIRO", "INVENTARIO_INICIAL"));
    await ops.criarOperacao({ ...input("SEM_EFEITO_FINANCEIRO", "INVENTARIO_INICIAL"), propriedadeId: outra.id, itens: [{ produtoId: productId, descricao: "Produto", quantidade: 20, unidade: "kg", valorUnitario: 10, estocavel: true }], valorTotal: 200 });
    await expect(stock.ajustarContagem({ produtoId: productId, quantidadeContada: 25, saldoEsperado: 30, observacao: "Contagem consolidada" })).rejects.toThrow("Selecione uma fazenda");
    expect((await stock.listarSaldos({ propriedadeId: pid })).find((p) => p.produtoId === productId)?.saldo).toBe(10);
    expect((await stock.listarSaldos({ propriedadeId: outra.id })).find((p) => p.produtoId === productId)?.saldo).toBe(20);
    await stock.ajustarContagem({ propriedadeId: outra.id, produtoId: productId, quantidadeContada: 25, saldoEsperado: 20, observacao: "Contagem na segunda fazenda" });
    expect((await stock.listarSaldos({ propriedadeId: pid })).find((p) => p.produtoId === productId)?.saldo).toBe(10);
    expect((await stock.listarSaldos({ propriedadeId: outra.id })).find((p) => p.produtoId === productId)?.saldo).toBe(25);
  });
  it("estoque lista só produto com movimento no sítio; movimento sem propriedade conta como da principal", async () => {
    const { propriedadePrincipalId } = await import("../../src/services/propriedade.js");
    const principal = await propriedadePrincipalId();
    const outra = await db.propriedade.create({ data: { nome: `Sítio do estoque ${serial}` } });
    const categoriaId = (await db.produto.findUniqueOrThrow({ where: { id: productId } })).categoriaId;
    const novo = (nome: string) => db.produto.create({ data: { nome: `${nome} ${serial}`, unidade: "KG", categoriaId } });
    const [semMovimento, soNaOutra, legado] = await Promise.all([novo("Sem movimento"), novo("Só na outra"), novo("Legado sem sítio")]);
    await ops.criarOperacao({ ...input("SEM_EFEITO_FINANCEIRO", "INVENTARIO_INICIAL"), propriedadeId: outra.id, valorTotal: 50,
      itens: [{ produtoId: soNaOutra.id, descricao: "Só na outra", quantidade: 5, unidade: "kg", valorUnitario: 10, estocavel: false }] }); // o tipo decide
    await db.movimentoEstoque.create({ data: { produtoId: legado.id, tipo: "ENTRADA", origem: "INVENTARIO_INICIAL", data, quantidade: 3, custoUnitario: 1, valorTotal: 3, propriedadeId: null } });
    const ids = async (propriedadeId: number | null) => (await stock.listarSaldos({ propriedadeId })).map((l) => l.produtoId);

    expect(await ids(pid)).not.toEqual(expect.arrayContaining([semMovimento.id]));
    expect(await ids(pid)).not.toEqual(expect.arrayContaining([soNaOutra.id]));
    expect(await ids(outra.id)).toEqual(expect.arrayContaining([soNaOutra.id]));
    expect(await ids(outra.id)).not.toEqual(expect.arrayContaining([legado.id]));
    expect((await stock.listarSaldos({ propriedadeId: principal })).find((l) => l.produtoId === legado.id)?.saldo).toBe(3);
    const consolidado = await ids(null);
    expect(consolidado).toEqual(expect.arrayContaining([soNaOutra.id, legado.id]));
    expect(consolidado).not.toEqual(expect.arrayContaining([semMovimento.id]));

    expect(await stock.produtoTemEstoque(db, soNaOutra.id, outra.id)).toBe(true);
    expect(await stock.produtoTemEstoque(db, soNaOutra.id, pid)).toBe(false);
    expect(await stock.produtoTemEstoque(db, legado.id, principal)).toBe(true);
    expect(await stock.produtoTemEstoque(db, semMovimento.id, null)).toBe(false);
    expect(await stock.produtoTemEstoque(db, soNaOutra.id, null)).toBe(true);
  });
  it("venda de produto sem entrada no sítio não movimenta estoque e cai na regra de item não estocável", async () => {
    // O produto só teve entrada em OUTRO sítio: no sítio da venda ele nunca foi estocado.
    const outra = await db.propriedade.create({ data: { nome: `Sítio com estoque ${serial}` } });
    await ops.criarOperacao({ ...input("SEM_EFEITO_FINANCEIRO", "INVENTARIO_INICIAL"), propriedadeId: outra.id });
    const venda = (extra: Record<string, unknown> = {}) => ({ ...schema.operacaoSchema.parse({
      tipo: "VENDA", data, descricao: "Venda de produto nunca estocado", parceiroId: partnerId,
      itens: [{ produtoId: productId, descricao: "Produto QA", quantidade: 3, unidade: "kg", valorUnitario: 20, estocavel: true }],
      financeiro: { condicao: "A_VISTA", contaId: accountId }, ...extra,
    }), propriedadeId: pid, usuarioId: userId });
    const before = await snapshot("antes da venda sem estoque");
    await expect(ops.criarOperacao(venda())).rejects.toMatchObject({ code: "VALIDACAO", campo: "itens.0.centroCustoId" });
    expect(await snapshot("venda sem centro recusada")).toEqual(before);

    const op = await ops.criarOperacao(venda({ centroCustoId: centroConsumoId }));
    expect(op.movimentosEstoque).toHaveLength(0);
    expect(op.itens[0]).toMatchObject({ produtoId: productId, estocavel: false });
    const state = await snapshot("venda sem estoque confirmada");
    expect(state.saldoConta).toBe(1060);
    expect((await stock.listarSaldos({ propriedadeId: pid })).map((l) => l.produtoId)).not.toContain(productId);
    expect((await stock.listarSaldos({ propriedadeId: outra.id })).find((l) => l.produtoId === productId)?.saldo).toBe(10);

    // Com entrada no sítio, a mesma venda passa a baixar o estoque.
    await ops.criarOperacao(input("SEM_EFEITO_FINANCEIRO", "INVENTARIO_INICIAL"));
    const comEstoque = await ops.criarOperacao(venda());
    expect(comEstoque.movimentosEstoque).toHaveLength(1);
    expect(comEstoque.movimentosEstoque[0]).toMatchObject({ tipo: "SAIDA", propriedadeId: pid });
    expect((await snapshot("venda com estoque")).saldoEstoque).toBe(7);
  });
  it("AJUSTE negativo não põe produto no estoque; baixa manual sem estoque é recusada", async () => {
    await db.movimentoEstoque.create({ data: { produtoId: productId, tipo: "AJUSTE", origem: "AJUSTE_INVENTARIO", data, quantidade: -2, custoUnitario: 0, valorTotal: 0, propriedadeId: pid } });
    expect(await stock.produtoTemEstoque(db, productId, pid)).toBe(false);
    expect(await stock.produtosComEstoque(db, [productId], pid)).toEqual(new Set());
    await expect(stock.registrarMovimento({ produtoId: productId, tipo: "AJUSTE", data: "2026-09-01", quantidade: -1, observacao: "Perda no galpão", propriedadeId: pid, usuarioId: userId }))
      .rejects.toMatchObject({ code: "VALIDACAO", message: expect.stringContaining("não tem estoque neste sítio") });
    await stock.registrarMovimento({ produtoId: productId, tipo: "AJUSTE", data: "2026-09-01", quantidade: 5, observacao: "Sobra encontrada", propriedadeId: pid, usuarioId: userId });
    expect(await stock.produtoTemEstoque(db, productId, pid)).toBe(true);
    await stock.registrarMovimento({ produtoId: productId, tipo: "AJUSTE", data: "2026-09-01", quantidade: -1, observacao: "Perda no galpão", propriedadeId: pid, usuarioId: userId });
    expect((await stock.listarSaldos({ propriedadeId: pid })).find((l) => l.produtoId === productId)?.saldo).toBe(2);
  });
  it("movimentos recentes usam o escopo de sítio dos saldos (principal inclui movimento sem propriedade)", async () => {
    const { propriedadePrincipalId } = await import("../../src/services/propriedade.js");
    const principal = await propriedadePrincipalId();
    const legado = await db.movimentoEstoque.create({ data: { produtoId: productId, tipo: "ENTRADA", origem: "INVENTARIO_INICIAL", data, quantidade: 1, custoUnitario: 1, valorTotal: 1, propriedadeId: null } });
    expect((await stock.listarMovimentos({ propriedadeId: principal })).itens.map((m) => m.id)).toContain(legado.id);
    const outra = await db.propriedade.create({ data: { nome: `Sítio sem legado ${serial}` } });
    expect((await stock.listarMovimentos({ propriedadeId: outra.id })).itens.map((m) => m.id)).not.toContain(legado.id);
  });
  it("custo médio ponderado: compras formam o médio, venda baixa pelo médio e estorno recalcula", async () => {
    const compra = (valorUnitario: number) => ({ ...schema.operacaoSchema.parse({
      tipo: "COMPRA_ESTOQUE", data, descricao: `Compra QA a ${valorUnitario}`, parceiroId: partnerId,
      itens: [{ produtoId: productId, descricao: "Produto QA", quantidade: 10, unidade: "kg", valorUnitario, estocavel: true }],
      financeiro: { condicao: "A_VISTA", contaId: accountId },
    }), propriedadeId: pid, usuarioId: userId });
    await ops.criarOperacao(compra(5));
    const segunda = await ops.criarOperacao(compra(7));
    const linha = async () => (await stock.listarSaldos({ propriedadeId: pid })).find((p) => p.produtoId === productId)!;
    expect(await linha()).toMatchObject({ saldo: 20, custoMedio: 6, valor: 120 });

    const venda = await ops.criarOperacao({ ...schema.operacaoSchema.parse({
      tipo: "VENDA", data, descricao: "Venda QA 5 kg", parceiroId: partnerId,
      itens: [{ produtoId: productId, descricao: "Produto QA", quantidade: 5, unidade: "kg", valorUnitario: 20, estocavel: true }],
      financeiro: { condicao: "A_VISTA", contaId: accountId },
    }), propriedadeId: pid, usuarioId: userId });
    expect(venda.movimentosEstoque).toHaveLength(1);
    expect(venda.movimentosEstoque[0].tipo).toBe("SAIDA");
    expect(Number(venda.movimentosEstoque[0].custoUnitario)).toBe(6); // custo, não o preço de venda (20)
    expect(Number(venda.movimentosEstoque[0].valorTotal)).toBe(30);
    expect(await linha()).toMatchObject({ saldo: 15, custoMedio: 6, valor: 90 });

    await ops.estornarOperacao(segunda.id, "Compra lançada em duplicidade", { propriedadeId: pid, usuarioId: userId });
    expect(await linha()).toMatchObject({ saldo: 5, custoMedio: 5, valor: 25 });
    await snapshot("custo médio após estorno");
  });
});

// Segura as inserções na tabela até as duas chamadas chegarem à barreira.
async function emCorrida<T>(tabela: string, chamadas: () => Promise<T>[]) {
  const barrier = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await barrier.connect();
  const key = 2492027;
  let running: Promise<PromiseSettledResult<T>[]> | undefined;
  try {
    await barrier.query("SELECT pg_advisory_lock($1)", [key]);
    await db.$executeRawUnsafe(`CREATE FUNCTION qa249_corrida() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(${key}); RETURN NEW; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER qa249_corrida BEFORE INSERT ON "${tabela}" FOR EACH ROW EXECUTE FUNCTION qa249_corrida()`);
    running = Promise.allSettled(chamadas());
    let waiting = 0;
    for (let attempt = 0; attempt < 60 && waiting < 2; attempt++) {
      const result = await barrier.query("SELECT count(*)::int AS count FROM pg_locks WHERE locktype = 'advisory' AND objid = $1 AND NOT granted", [key]);
      waiting = result.rows[0].count;
      if (waiting < 2) await new Promise(resolve => setTimeout(resolve, 25));
    }
    expect(waiting, "os dois envios devem alcançar a barreira").toBe(2);
    await barrier.query("SELECT pg_advisory_unlock($1)", [key]);
    return await running;
  } finally {
    await barrier.query("SELECT pg_advisory_unlock_all()");
    await running;
    await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS qa249_corrida ON "${tabela}"`);
    await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS qa249_corrida()`);
    await barrier.end();
  }
}

describe("ids gerados pelo cliente", () => {
  const contagens = async () => ({
    operacoes: await db.operacao.count({ where: { propriedadeId: pid } }),
    compromissos: await db.compromissoFinanceiro.count({ where: { operacao: { propriedadeId: pid } } }),
    transacoes: await db.transacaoFinanceira.count({ where: { propriedadeId: pid } }),
    liquidacoes: await db.liquidacao.count({ where: { compromisso: { operacao: { propriedadeId: pid } } } }),
    movimentosEstoque: await db.movimentoEstoque.count({ where: { propriedadeId: pid } }),
    auditoria: await db.auditoriaFinanceira.count({ where: { usuarioId: userId } }),
    saldoConta: Number((await accounts.listarContas(pid, true))[0].saldoAtual),
  });
  const aPrazoComIds = (id: string, parcelaId: string) => {
    const base = input("A_PRAZO");
    return { ...base, id, financeiro: { condicao: "A_PRAZO" as const, parcelas: [{ id: parcelaId, valor: 100, dataVencimento: new Date("2026-10-01") }] } };
  };

  it("operação com id e parcela com id: reenvio devolve a mesma e a parcela é liquidável pelo id", async () => {
    const id = randomUUID(), parcelaId = randomUUID();
    const criada = await ops.criarOperacao(aPrazoComIds(id, parcelaId));
    expect(criada.id).toBe(id);
    expect(criada.compromissos.map(c => c.id)).toEqual([parcelaId]);
    const antes = await contagens();
    const reenvio = await ops.criarOperacao(aPrazoComIds(id, parcelaId));
    expect(reenvio).toEqual(criada);
    expect(await contagens()).toEqual(antes);
    await ops.liquidarCompromisso(parcelaId, { data, valor: 100, contaId: accountId, usuarioId: userId, propriedadeId: pid });
    expect((await contagens()).saldoConta).toBe(900);
  });

  it("à vista reenviada não debita a conta de novo", async () => {
    const id = randomUUID();
    const criada = await ops.criarOperacao({ ...input("A_VISTA"), id });
    const antes = await contagens();
    expect(antes.saldoConta).toBe(900);
    expect(await ops.criarOperacao({ ...input("A_VISTA"), id })).toEqual(criada);
    expect(await contagens()).toEqual(antes);
  });

  it("sem id, dois envios iguais continuam gerando duas operações", async () => {
    await ops.criarOperacao(input("A_VISTA")); await ops.criarOperacao(input("A_VISTA"));
    const estado = await contagens();
    expect(estado.operacoes).toBe(2); expect(estado.saldoConta).toBe(800);
  });

  it("id de outro tipo ou de outra propriedade é conflito", async () => {
    const id = randomUUID();
    await ops.criarOperacao({ ...input("A_VISTA"), id });
    const antes = await contagens();
    await expect(ops.criarOperacao({ ...input("A_VISTA", "SERVICO"), id })).rejects.toMatchObject({ code: "CONFLITO" });
    const outra = await db.propriedade.create({ data: { nome: `Outra id ${serial}` } });
    const contaOutra = (await db.contaFinanceira.create({ data: { nome: "Conta outra", tipo: "BANCO", propriedadeId: outra.id, dataSaldoAbertura: data } })).id;
    await expect(ops.criarOperacao({ ...input("A_VISTA"), id, propriedadeId: outra.id, financeiro: { condicao: "A_VISTA", contaId: contaOutra } })).rejects.toMatchObject({ code: "CONFLITO" });
    await expect(ops.transferir({ id, contaOrigemId: accountId, contaDestinoId: contaOutra, valor: 10, data, propriedadeId: pid })).rejects.toMatchObject({ code: "CONFLITO" });
    await expect(stock.ajustarContagem({ id, propriedadeId: pid, produtoId: productId, saldoEsperado: 10, quantidadeContada: 8, observacao: "Contagem conferida", usuarioId: userId })).rejects.toMatchObject({ code: "CONFLITO" });
    expect(await contagens()).toEqual(antes);
  });

  it("id de parcela já usado por outro compromisso é conflito", async () => {
    const parcelaId = randomUUID();
    await ops.criarOperacao(aPrazoComIds(randomUUID(), parcelaId));
    const antes = await contagens();
    await expect(ops.criarOperacao(aPrazoComIds(randomUUID(), parcelaId))).rejects.toMatchObject({ code: "CONFLITO" });
    expect(await contagens()).toEqual(antes);
  });

  it("dois envios concorrentes da mesma operação gravam uma só", async () => {
    const id = randomUUID();
    const resultados = await emCorrida("Operacao", () => [ops.criarOperacao({ ...input("A_VISTA"), id }), ops.criarOperacao({ ...input("A_VISTA"), id })]);
    evidence.push({ caso: serial, corridaOperacao: resultados.map(r => r.status) });
    expect(resultados.map(r => r.status)).toEqual(["fulfilled", "fulfilled"]);
    const [a, b] = resultados.map(r => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof ops.criarOperacao>>>).value);
    expect(a.id).toBe(id); expect(b).toEqual(a);
    const estado = await contagens();
    expect(estado.operacoes).toBe(1); expect(estado.transacoes).toBe(1); expect(estado.saldoConta).toBe(900);
  });

  it("liquidação com id: reenvio devolve a mesma transação; id de outro compromisso é conflito", async () => {
    const op = await ops.criarOperacao(input());
    const outra = await ops.criarOperacao(input());
    const transacaoId = randomUUID();
    const liquidar = (compromissoId: string) => ops.liquidarCompromisso(compromissoId, { transacaoId, data, valor: 40, contaId: accountId, usuarioId: userId, propriedadeId: pid });
    const primeira = await liquidar(op.compromissos[0].id);
    expect(primeira.id).toBe(transacaoId);
    const antes = await contagens();
    expect(antes.saldoConta).toBe(960);
    expect(await liquidar(op.compromissos[0].id)).toEqual(primeira);
    await expect(liquidar(outra.compromissos[0].id)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(await contagens()).toEqual(antes);
  });

  it("duas liquidações concorrentes com o mesmo id pagam uma vez", async () => {
    const op = await ops.criarOperacao(input());
    const transacaoId = randomUUID();
    const liquidar = () => ops.liquidarCompromisso(op.compromissos[0].id, { transacaoId, data, valor: 60, contaId: accountId, usuarioId: userId, propriedadeId: pid });
    const resultados = await emCorrida("TransacaoFinanceira", () => [liquidar(), liquidar()]);
    evidence.push({ caso: serial, corridaLiquidacao: resultados.map(r => r.status) });
    expect(resultados.map(r => r.status)).toEqual(["fulfilled", "fulfilled"]);
    const estado = await contagens();
    expect(estado.liquidacoes).toBe(1); expect(estado.saldoConta).toBe(940);
  });

  it("transferência com id: reenvio devolve a mesma transação e não move saldo de novo", async () => {
    const destino = (await db.contaFinanceira.create({ data: { nome: "Caixa QA", tipo: "CAIXA", propriedadeId: pid, dataSaldoAbertura: data } })).id;
    const id = randomUUID();
    const transferir = () => ops.transferir({ id, contaOrigemId: accountId, contaDestinoId: destino, valor: 150, data, propriedadeId: pid, usuarioId: userId });
    const primeira = await transferir();
    expect(primeira.operacaoId).toBe(id);
    const antes = await contagens();
    expect(await transferir()).toEqual(primeira);
    expect(await contagens()).toEqual(antes);
    const saldos = await accounts.listarContas(pid, true);
    expect(saldos.map(c => Number(c.saldoAtual)).sort((x, y) => x - y)).toEqual([150, 850]);
  });

  it("ajuste de contagem com id: reenvio com saldo já alterado devolve só o operacaoId", async () => {
    await ops.criarOperacao(input("SEM_EFEITO_FINANCEIRO", "INVENTARIO_INICIAL"));
    const id = randomUUID();
    const ajustar = () => stock.ajustarContagem({ id, propriedadeId: pid, produtoId: productId, saldoEsperado: 10, quantidadeContada: 7, observacao: "Contagem conferida", usuarioId: userId });
    const primeira = await ajustar();
    expect(primeira).toMatchObject({ operacaoId: id, saldoAnterior: 10, quantidadeContada: 7, diferenca: -3 });
    const antes = await contagens();
    expect(await ajustar()).toEqual({ operacaoId: id });
    expect(await contagens()).toEqual(antes);
    expect((await stock.listarSaldos({ propriedadeId: pid })).find(p => p.produtoId === productId)?.saldo).toBe(7);
  });

  it("rascunho confirmado usa o id informado na operação", async () => {
    const id = randomUUID();
    const draft = await drafts.salvarRascunho({ propriedadeId: pid, usuarioId: userId, dados: { operacao: JSON.parse(JSON.stringify({ ...input("A_VISTA"), id })) } });
    const op = await drafts.confirmarRascunho(pid, userId, draft.versao);
    expect(op.id).toBe(id);
    expect((await contagens()).saldoConta).toBe(900);
  });
});

describe("previsão compartilhada × registros gravados", () => {
  const TIPOS = [
    "COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "SERVICO", "VENDA", "APORTE", "RETIRADA",
    "AJUSTE_ESTOQUE", "TRANSFERENCIA_ESTOQUE", "INVENTARIO_INICIAL", "BONIFICACAO", "DEVOLUCAO", "PRODUCAO",
  ] as const;
  const CONDICOES = ["SEM_EFEITO_FINANCEIRO", "A_VISTA", "A_PRAZO", "PARCIAL"] as const;
  const comParceiro = new Set(["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "SERVICO", "VENDA", "DEVOLUCAO"]);
  const n = (valor: unknown) => Number(valor);

  it.each(TIPOS)("%s em todas as condições aceitas", async (tipo) => {
    const centroItem = (await db.centroCusto.create({ data: { nome: `Item ${serial}` } })).id;
    const catItem = await db.categoria.create({ data: { nome: `Máquinas QA ${serial}`, classificacao: "INVESTIMENTO" } });
    const produtoCentro = (await db.produto.create({ data: { nome: `Produto centro ${serial}`, unidade: "UN", categoriaId: catItem.id, centrosCusto: { create: [{ centroCustoId: centroItem }] } } })).id;
    const produto = await db.produto.findUniqueOrThrow({ where: { id: productId }, include: { categoria: true } });
    if (tipo === "VENDA" || tipo === "DEVOLUCAO") {
      await ops.criarOperacao({ ...schema.operacaoSchema.parse({
        tipo: "COMPRA_ESTOQUE", data, descricao: "Estoque inicial", parceiroId: partnerId, financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" },
        itens: [
          { produtoId: productId, descricao: "Produto QA", quantidade: 300, unidade: "kg", valorTotal: 1000 },
          { produtoId: produtoCentro, descricao: "Produto centro", quantidade: 30, unidade: "un", valorTotal: 70 },
        ],
      }), propriedadeId: pid, usuarioId: userId });
    }
    const contexto: ContextoOperacao = {
      produtos: [
        { id: productId, categoriaId: produto.categoriaId, centrosCustoIds: [] },
        { id: produtoCentro, categoriaId: catItem.id, centrosCustoIds: [centroItem] },
      ],
      categorias: [
        { id: produto.categoria!.id, nome: produto.categoria!.nome, classificacao: produto.categoria!.classificacao },
        { id: catItem.id, nome: catItem.nome, classificacao: catItem.classificacao },
      ],
      centrosCusto: [{ id: centroConsumoId, nome: `Consumo direto ${serial}` }, { id: centroItem, nome: `Item ${serial}` }],
      produtosComEstoque: tipo === "VENDA" || tipo === "DEVOLUCAO" ? [productId, produtoCentro] : [],
      basesCusto: tipo === "VENDA" || tipo === "DEVOLUCAO" ? [{ produtoId: productId, quantidade: 300, valor: 1000 }, { produtoId: produtoCentro, quantidade: 30, valor: 70 }] : [],
    };

    let casos = 0;
    for (const condicao of CONDICOES) for (const comItens of [true, false]) {
      const financeiro = condicao === "SEM_EFEITO_FINANCEIRO" ? { condicao }
        : condicao === "A_VISTA" ? { condicao, contaId: accountId, formaPagamento: "PIX" }
          : condicao === "A_PRAZO" ? { condicao, parcelas: [{ id: randomUUID(), valor: 33.33, dataVencimento: "2026-10-01" }, { valor: 33.34, dataVencimento: "2026-11-01" }] }
            : { condicao, contaId: accountId, valorPago: 16.67, parcelas: [{ valor: 50, dataVencimento: "2026-10-01" }] };
      const parse = schema.operacaoSchema.safeParse({
        tipo, data, descricao: `Previsão ${tipo} ${condicao}`, centroCustoId: centroConsumoId,
        ...(comParceiro.has(tipo) ? { parceiroId: partnerId } : {}),
        ...(comItens
          ? { itens: [
            { produtoId: productId, descricao: "Produto QA", quantidade: 3, unidade: "kg", valorUnitario: 10.005 },
            { produtoId: produtoCentro, descricao: "Produto centro", quantidade: 3, unidade: "un", valorTotal: 20 },
            { descricao: "Frete", quantidade: 1, unidade: "un", valorTotal: 16.64, centroCustoId: centroItem, categoriaId: catItem.id, classificacao: "CUSTEIO" },
            { produtoId: produtoCentro, descricao: "Produto centro sem centro", quantidade: 1, unidade: "un", valorTotal: 0.01, centroCustoId: null },
          ] }
          : { valorTotal: 66.67 }),
        financeiro,
      });
      if (!parse.success) continue;
      casos++;
      const efeitos = preverEfeitosOperacao(parse.data, contexto);
      const op = await ops.criarOperacao({ ...parse.data, propriedadeId: pid, usuarioId: userId });

      expect({ valorTotal: n(op.valorTotal), categoriaId: op.categoriaId, categoriaNome: op.categoriaNome, classificacao: op.classificacao, centroCustoId: op.centroCustoId })
        .toEqual({ valorTotal: efeitos.valorTotal, categoriaId: efeitos.categoriaId, categoriaNome: efeitos.categoriaNome, classificacao: efeitos.classificacao, centroCustoId: efeitos.centroCustoId });
      const itens = [...op.itens].sort((a, b) => a.ordem - b.ordem);
      expect(itens.map((item) => ({
        ordem: item.ordem, produtoId: item.produtoId ?? undefined, descricao: item.descricao, quantidade: n(item.quantidade), unidade: item.unidade,
        valorUnitario: n(item.valorUnitario), valorTotal: n(item.valorTotal), estocavel: item.estocavel,
        categoriaId: item.categoriaId, categoriaNome: item.categoriaNome, classificacao: item.classificacao,
        centroCustoId: item.centroCustoId, centroCustoNome: item.centroCustoNome, centroCustoEfetivoId: item.centroCustoId ?? op.centroCustoId,
      }))).toEqual(efeitos.itens);
      const ordemPorItem = new Map(itens.map((item) => [item.id, item.ordem]));
      expect(op.movimentosEstoque.map((m) => ({
        ordemItem: ordemPorItem.get(m.itemOperacaoId!), produtoId: m.produtoId, tipo: m.tipo, origem: m.origem,
        quantidade: n(m.quantidade), custoUnitario: n(m.custoUnitario), valorTotal: n(m.valorTotal), centroCustoId: m.centroCustoId,
      })).sort((a, b) => a.ordemItem! - b.ordemItem!)).toEqual(efeitos.movimentosEstoque);
      expect([...op.compromissos].sort((a, b) => (a.numeroParcela ?? 0) - (b.numeroParcela ?? 0)).map((c, i) => ({
        ...(efeitos.compromissos[i]?.id ? { id: c.id } : {}), tipo: c.tipo, valorOriginal: n(c.valorOriginal), dataVencimento: c.dataVencimento,
        numeroParcela: c.numeroParcela, totalParcelas: c.totalParcelas,
      }))).toEqual(efeitos.compromissos);
      expect(op.transacoes.map((t) => ({
        tipo: t.tipo, direcao: t.movimentos[0].direcao, valor: n(t.valorTotal), contaId: t.movimentos[0].contaId,
        ...(t.formaPagamento ? { formaPagamento: t.formaPagamento } : {}),
      }))).toEqual(efeitos.transacao ? [efeitos.transacao] : []);
    }
    expect(casos).toBeGreaterThan(0);
  });
});
