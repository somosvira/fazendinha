import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import type { PrismaClient } from "@prisma/client";
import { newEntityId } from "@fazendinha/shared";

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

// O estorno exige as identidades que o cliente geraria (offline-first): a
// função nunca inventa um UUID de reversão sozinha. Aqui simulamos o mesmo
// contrato que FormOperacao.tsx/OperacaoFinanceiraDetalhe.tsx cumprem.
function identidadesEstornoOperacao(op: { transacoes: { id: string; status: string; tipo: string; movimentos: { id: string }[] }[] }) {
  return op.transacoes
    .filter((transacao) => transacao.status === "CONFIRMADA" && transacao.tipo !== "REVERSAO")
    .map((transacao) => ({
      originalId: transacao.id,
      id: newEntityId(),
      movimentos: transacao.movimentos.map((movimento) => ({ originalId: movimento.id, id: newEntityId() })),
    }));
}
function estornarOperacao(op: Parameters<typeof identidadesEstornoOperacao>[0] & { id: string }, motivo: string) {
  return ops.estornarOperacao(op.id, motivo, identidadesEstornoOperacao(op), userId);
}
function estornarTransacao(transacao: { id: string; movimentos: { id: string }[] }, motivo: string) {
  return ops.estornarTransacao(transacao.id, {
    motivo, transacaoId: newEntityId(),
    movimentos: transacao.movimentos.map((movimento) => ({ originalId: movimento.id, id: newEntityId() })),
  }, userId);
}

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
    await estornarOperacao(op, "Cancelamento QA");
    const state = await snapshot("cancelada");
    expect.soft(state.saldoConta).toBe(1000); expect.soft(state.saldoEstoque).toBe(0);
    expect(state.operacoes[0].status).toBe("CANCELADA");
    expect(state.operacoes[0].movimentosEstoque).toHaveLength(2);
    expect(state.operacoes[0].movimentosEstoque.some(m => m.reversaoDeId === op.movimentosEstoque[0].id)).toBe(true);
    expect(state.operacoes[0].compromissos.every(c => c.status === "CANCELADO")).toBe(true);
  });
  it("estorno repetido é recusado sem gerar novos efeitos", async () => {
    const op = await ops.criarOperacao(input("A_VISTA")); await estornarOperacao(op, "Primeiro estorno");
    const before = await snapshot("primeiro estorno");
    await expect(estornarOperacao(op, "Segundo estorno")).rejects.toThrow("já foi cancelada");
    expect(await snapshot("repetição recusada")).toEqual(before);
  });
  it("estorno de liquidação reabre compromisso e preserva vínculo histórico", async () => {
    const op = await ops.criarOperacao(input()); const tx = await pay(op.compromissos[0].id, 100);
    const before = await snapshot("liquidada");
    await estornarTransacao(tx, "Estorno QA");
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
    await failAudit(() => estornarOperacao(op, "Cancelamento com falha"));
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
    await db.produto.update({ where: { id: productId }, data: { categoriaId: silagem.id, centroCustoId: centro.id } });
    const outro = await db.produto.create({ data: { nome: `Vacina ${serial}`, unidade: "un", categoriaId: vacina.id } });
    const op = await ops.criarOperacao({ ...input(), valorTotal: 1000, centroCustoId: centro.id,
      itens: [{ produtoId: productId, descricao: "Silagem", quantidade: 1, unidade: "kg", valorUnitario: 800, estocavel: true }, { produtoId: outro.id, descricao: "Vacina", quantidade: 1, unidade: "un", valorUnitario: 200, estocavel: true }],
      financeiro: { condicao: "A_PRAZO", parcelas: [{ valor: 500, dataVencimento: new Date("2026-10-01") }, { valor: 500, dataVencimento: new Date("2026-11-01") }] },
    });
    expect(op.itens.map((i) => i.categoriaId)).toEqual([silagem.id, vacina.id]);
    await db.produto.update({ where: { id: productId }, data: { categoriaId: vacina.id } });
    await db.categoria.update({ where: { id: silagem.id }, data: { nome: `Renomeada ${serial}`, classificacao: "INVESTIMENTO", ativo: false } });
    const filtro = { inicio: "2026-09-01", fim: "2026-11-30", base: "compras" as const, categoriaId: silagem.id };
    expect(await analisarCategorias(filtro, pid)).toMatchObject({ total: "800.00", categorias: [{ categoria: silagem.nome, valor: "800.00" }] });
    expect((await analisarCategorias({ ...filtro, centroCustoId: centro.id }, pid)).total).toBe("800.00");
    expect((await analisarCategorias({ ...filtro, centroCustoId: "0" }, pid)).total).toBe("0.00");
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
    const estorno = await estornarTransacao(pagamento, "Estorno de teste");
    // Posiciona o estorno em outro mês para verificar a competência de caixa.
    await db.transacaoFinanceira.update({ where: { id: estorno.id }, data: { data: new Date("2026-10-02") } });
    expect((await analisarCategorias({ ...filtro, base: "pagamentos" }, pid)).total).toBe("0.00");
    expect((await analisarCategorias({ ...filtro, base: "pagamentos", inicio: "2026-10-01" }, pid)).total).toBe("-400.00");
    expect((await analisarCategorias({ ...filtro, base: "pendente" }, pid)).total).toBe("800.00");
    const relatorioEstornado = await gerarRelatorioGerencial({ inicio: filtro.inicio, fim: filtro.fim, regime: "ambos" }, pid);
    expect(relatorioEstornado.resumo.saidas).toBe(0);
    expect(relatorioEstornado.operacoes.find((o) => o.tipo === "estorno")).toMatchObject({ quantidade: 1, valor: 500 });
    expect(relatorioEstornado.operacoes.find((o) => o.tipo === "custeio")).toMatchObject({ quantidade: 1, valor: 400 });
    await estornarOperacao(op, "Cancelar teste misto");
    expect((await analisarCategorias(filtro, pid)).total).toBe("0.00");
    expect((await analisarCategorias({ ...filtro, base: "pendente" }, pid)).total).toBe("0.00");
  });

  it("serviço sem itens registra categoria e classificação e aceita item avulso sem categoria", async () => {
    const categoria = await db.categoria.create({ data: { nome: `Serviços ${serial}`, classificacao: "CUSTEIO" } });
    const op = await ops.criarOperacao({ ...input("A_VISTA", "SERVICO"), parceiroId: undefined, categoriaId: categoria.id, classificacao: "INVESTIMENTO" });
    expect(op).toMatchObject({ categoriaNome: categoria.nome, classificacao: "INVESTIMENTO" });
    const avulso = await ops.criarOperacao({ ...input("A_VISTA", "COMPRA_CONSUMO_DIRETO"), itens: [{ descricao: "Material sem cadastro", quantidade: 1, unidade: "un", valorUnitario: 100, estocavel: false }] });
    expect(avulso.itens[0]).toMatchObject({ categoriaId: null, categoriaNome: null });
  });
});


describe("correções da revisão", () => {
  it("inclui pagamentos avulsos e suas reversões sem misturar receitas, datas ou fazendas", async () => {
    const { analisarCategorias } = await import("../../src/services/financeiro/analise-categorias.js");
    const filtro = { inicio: "2026-09-01", fim: "2026-11-30", base: "pagamentos" as const };
    const pagamento = await ops.criarTransacaoAvulsa({ tipo: "PAGAMENTO", propriedadeId: pid, contaId: accountId, data, valor: 100, descricao: "Frete avulso" });
    await ops.criarTransacaoAvulsa({ tipo: "RECEBIMENTO", propriedadeId: pid, contaId: accountId, data, valor: 75, descricao: "Recebimento avulso" });
    expect(await analisarCategorias(filtro, pid)).toMatchObject({ total: "100.00", linhas: [{ operacaoId: null, contaId: accountId, movimentoId: pagamento.movimentos[0].id, categoria: "Sem categoria", valor: "100.00" }] });
    expect((await analisarCategorias({ ...filtro, categoriaId: "0", centroCustoId: "0" }, pid)).total).toBe("100.00");
    expect((await analisarCategorias({ ...filtro, categoriaId: "00000000-0000-4000-8000-000000000999" }, pid)).total).toBe("0.00");
    expect((await analisarCategorias({ ...filtro, centroCustoId: "00000000-0000-4000-8000-000000000999" }, pid)).total).toBe("0.00");
    expect((await analisarCategorias({ ...filtro, base: "compras" }, pid)).total).toBe("0.00");
    expect((await analisarCategorias(filtro, pid + 99999)).total).toBe("0.00");
    const estorno = await estornarTransacao(pagamento, "Reverter frete avulso");
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
});
