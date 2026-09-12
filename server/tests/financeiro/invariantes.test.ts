import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import type { PrismaClient } from "@prisma/client";

// O runner usa tabelas em um schema temporário dentro do único banco local.
const database = "fazendinha_local";
const qaSchema = process.env.FINANCE_QA_SCHEMA;
const url = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/invalid");
if (!qaSchema || !/^qa249_test_[a-f0-9]{16}$/.test(qaSchema) || url.searchParams.get("schema") !== qaSchema || url.pathname !== `/${database}` || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
  throw new Error("Use pnpm --filter rionovo-server test:financeiro:integration");
}
// Injeção de um Prisma REAL com namespace de teste; não simula métodos/queries.
vi.mock("../../src/db.js", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const connection = new URL(process.env.DATABASE_URL!);
  connection.searchParams.delete("schema");
  return { prisma: new PrismaClient({ adapter: new PrismaPg({ connectionString: connection.href, options: `-c search_path=${process.env.FINANCE_QA_SCHEMA}` }, { schema: process.env.FINANCE_QA_SCHEMA }) }) };
});
let db: PrismaClient;
let ops: typeof import("../../src/services/financeiro/operacoes.js");
let drafts: typeof import("../../src/services/financeiro/rascunhos.js");
let accounts: typeof import("../../src/services/financeiro/contas.js");
let stock: typeof import("../../src/services/rebanho/estoque.js");
let schema: typeof import("../../src/services/financeiro/schemas.js");
let pid: number, accountId: number, partnerId: number, productId: number, userId: number;
let serial = 0;
const data = new Date("2026-09-01T12:00:00Z");
const evidence: unknown[] = [];

beforeAll(async () => {
  db = (await import("../../src/db.js")).prisma;
  ops = await import("../../src/services/financeiro/operacoes.js");
  drafts = await import("../../src/services/financeiro/rascunhos.js");
  accounts = await import("../../src/services/financeiro/contas.js");
  stock = await import("../../src/services/rebanho/estoque.js");
  schema = await import("../../src/services/financeiro/schemas.js");
  const rows = await db.$queryRaw<{ name: string }[]>`SELECT current_database()::text AS name`;
  expect(rows[0].name).toBe(database);
});
beforeEach(async () => {
  serial++;
  pid = (await db.propriedade.create({ data: { nome: `QA propriedade ${serial}` } })).id;
  accountId = (await db.contaFinanceira.create({ data: { nome: "Banco QA", tipo: "BANCO", propriedadeId: pid, saldoAbertura: 1000, dataSaldoAbertura: data } })).id;
  partnerId = (await db.parceiro.create({ data: { nome: `Parceiro ${serial}`, papeis: { create: [{ papel: "FORNECEDOR" }, { papel: "CLIENTE" }] } } })).id;
  productId = (await db.produto.create({ data: { nome: `Produto ${serial}`, unidade: "kg" } })).id;
  userId = (await db.usuario.create({ data: { nome: "QA", email: `qa${serial}@example.test`, papel: "gestor", abas: [], flags: [] } })).id;
});
afterAll(async () => {
  writeFileSync(join(process.env.FINANCE_QA_REPORT_DIR!, "estados.json"), JSON.stringify(evidence, null, 2));
  await db?.$disconnect();
});
function input(condicao = "A_PRAZO", tipo = "COMPRA_ESTOQUE") {
  return { ...schema.operacaoSchema.parse({
    tipo, data, descricao: "Compra QA 10 kg", parceiroId: partnerId,
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
async function pay(id: number, valor: number) { return ops.liquidarCompromisso(id, { data, valor, contaId: accountId, usuarioId: userId }); }

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
    await ops.estornarOperacao(op.id, "Cancelamento QA", userId);
    const state = await snapshot("cancelada");
    expect.soft(state.saldoConta).toBe(1000); expect.soft(state.saldoEstoque).toBe(0);
    expect(state.operacoes[0].status).toBe("CANCELADA");
    expect(state.operacoes[0].movimentosEstoque).toHaveLength(2);
    expect(state.operacoes[0].movimentosEstoque.some(m => m.reversaoDeId === op.movimentosEstoque[0].id)).toBe(true);
    expect(state.operacoes[0].compromissos.every(c => c.status === "CANCELADO")).toBe(true);
  });
  it("estorno repetido é recusado sem gerar novos efeitos", async () => {
    const op = await ops.criarOperacao(input("A_VISTA")); await ops.estornarOperacao(op.id, "Primeiro estorno", userId);
    const before = await snapshot("primeiro estorno");
    await expect(ops.estornarOperacao(op.id, "Segundo estorno", userId)).rejects.toThrow("já foi cancelada");
    expect(await snapshot("repetição recusada")).toEqual(before);
  });
  it("estorno de liquidação reabre compromisso e preserva vínculo histórico", async () => {
    const op = await ops.criarOperacao(input()); const tx = await pay(op.compromissos[0].id, 100);
    const before = await snapshot("liquidada");
    await ops.estornarTransacao(tx.id, "Estorno QA", userId);
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
    await failAudit(() => ops.estornarOperacao(op.id, "Cancelamento com falha", userId));
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

});
