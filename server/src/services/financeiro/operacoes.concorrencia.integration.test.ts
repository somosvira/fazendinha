import crypto from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../db.js";
import { listarContas } from "./contas.js";
import { estornarOperacao, estornarTransacao, criarOperacao, liquidarCompromisso } from "./operacoes.js";
import { FinanceiroError } from "./regras.js";
import { operacaoSchema } from "./schemas.js";
import { estornarMovimentoTx, listarSaldos } from "../estoque/estoque.js";

const describeComBanco = process.env.FINANCE_DB_INTEGRATION === "1" ? describe : describe.skip;
const propriedadesCriadas: number[] = [];
const parceirosCriados: string[] = [];
const produtosCriados: string[] = [];

async function fixture() {
  const sufixo = crypto.randomUUID();
  const propriedadeId = (await prisma.propriedade.create({ data: { nome: `Concorrência ${sufixo}` } })).id;
  const outraPropriedadeId = (await prisma.propriedade.create({ data: { nome: `Outro escopo ${sufixo}` } })).id;
  propriedadesCriadas.push(propriedadeId, outraPropriedadeId);
  const contaId = (await prisma.contaFinanceira.create({ data: {
    nome: `Banco ${sufixo}`, tipo: "BANCO", propriedadeId, saldoAbertura: 1_000, dataSaldoAbertura: new Date(),
  } })).id;
  const parceiroId = (await prisma.parceiro.create({ data: {
    nome: `Fornecedor ${sufixo}`, tipo: "FORNECEDOR", papeis: { create: { papel: "FORNECEDOR" } },
  } })).id;
  parceirosCriados.push(parceiroId);
  const produtoId = (await prisma.produto.create({ data: { nome: `Produto ${sufixo}`, unidade: "KG", categoria: { create: { nome: `Categoria concorrência ${sufixo}` } } } })).id;
  produtosCriados.push(produtoId);
  return { propriedadeId, outraPropriedadeId, contaId, parceiroId, produtoId };
}

function entrada(f: Awaited<ReturnType<typeof fixture>>, condicao: "A_VISTA" | "A_PRAZO" | "SEM_EFEITO_FINANCEIRO") {
  const somenteFisica = condicao === "SEM_EFEITO_FINANCEIRO";
  return {
    ...operacaoSchema.parse({
      tipo: somenteFisica ? "INVENTARIO_INICIAL" : "COMPRA_ESTOQUE",
      data: new Date(),
      descricao: "Operação para teste concorrente",
      parceiroId: somenteFisica ? undefined : f.parceiroId,
      itens: [{ produtoId: f.produtoId, descricao: "Produto concorrente", quantidade: 10, unidade: "kg", valorUnitario: 10, estocavel: true }],
      financeiro: condicao === "A_VISTA"
        ? { condicao, contaId: f.contaId }
        : condicao === "A_PRAZO"
          ? { condicao, parcelas: [{ valor: 100, dataVencimento: new Date() }] }
          : { condicao },
    }),
    propriedadeId: f.propriedadeId,
  };
}

afterAll(async () => {
  if (!propriedadesCriadas.length) return;
  const propriedadeId = { in: propriedadesCriadas };
  await prisma.liquidacao.deleteMany({ where: { transacao: { propriedadeId } } });
  await prisma.movimentoConta.deleteMany({ where: { transacao: { propriedadeId } } });
  await prisma.transacaoFinanceira.deleteMany({ where: { propriedadeId } });
  await prisma.compromissoFinanceiro.deleteMany({ where: { operacao: { propriedadeId } } });
  await prisma.movimentoEstoque.deleteMany({ where: { propriedadeId } });
  await prisma.itemOperacao.deleteMany({ where: { operacao: { propriedadeId } } });
  await prisma.operacao.deleteMany({ where: { propriedadeId } });
  await prisma.contaFinanceira.deleteMany({ where: { propriedadeId } });
  await prisma.propriedade.deleteMany({ where: { id: propriedadeId } });
  await prisma.parceiroPapel.deleteMany({ where: { parceiroId: { in: parceirosCriados } } });
  await prisma.parceiro.deleteMany({ where: { id: { in: parceirosCriados } } });
  await prisma.produto.deleteMany({ where: { id: { in: produtosCriados } } });
  await prisma.categoria.deleteMany({ where: { nome: { startsWith: "Categoria concorrência " }, produtos: { none: {} } } });
});

describeComBanco("operações financeiras concorrentes com PostgreSQL", () => {
  it("serializa liquidação concorrente com cancelamento", async () => {
    const f = await fixture();
    const operacao = await criarOperacao(entrada(f, "A_PRAZO"));
    const resultados = await Promise.allSettled([
      liquidarCompromisso(operacao.compromissos[0].id, { data: new Date(), valor: 60, contaId: f.contaId }),
      estornarOperacao(operacao.id, "Cancelamento concorrente", { propriedadeId: f.propriedadeId }),
    ]);

    expect(resultados[1].status).toBe("fulfilled");
    const atual = await prisma.operacao.findUniqueOrThrow({ where: { id: operacao.id }, include: { transacoes: true, compromissos: true } });
    expect(atual.status).toBe("CANCELADA");
    expect(atual.compromissos).toEqual([expect.objectContaining({ status: "CANCELADO" })]);
    expect(atual.transacoes.filter((item) => item.tipo !== "REVERSAO" && item.status === "CONFIRMADA")).toHaveLength(0);
    expect(Number((await listarContas(f.propriedadeId, true))[0].saldoAtual)).toBe(1_000);
  });

  it("produz um único inverso em estornos simultâneos", async () => {
    const f = await fixture();
    const operacao = await criarOperacao(entrada(f, "A_VISTA"));
    const pagamento = operacao.transacoes[0];
    const resultados = await Promise.allSettled([
      estornarTransacao(pagamento.id, "Estorno concorrente A", { propriedadeId: f.propriedadeId }),
      estornarTransacao(pagamento.id, "Estorno concorrente B", { propriedadeId: f.propriedadeId }),
    ]);

    expect(resultados.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    const rejeitado = resultados.find((item): item is PromiseRejectedResult => item.status === "rejected");
    expect(rejeitado?.reason).toBeInstanceOf(FinanceiroError);
    expect(rejeitado?.reason).toMatchObject({ code: "JA_REVERTIDO" });
    expect(await prisma.transacaoFinanceira.count({ where: { reversaoDeId: pagamento.id } })).toBe(1);
    expect(Number((await listarContas(f.propriedadeId, true))[0].saldoAtual)).toBe(1_000);
  });

  // Estorno avulso de um movimento (o que sanidade fazem) disputando o
  // lock da Operacao com o cancelamento financeiro.
  const estornarMovimento = (id: string, propriedadeId: number) =>
    prisma.$transaction((tx) => estornarMovimentoTx(tx, id, { propriedadeId }), { isolationLevel: "Serializable" });

  it("serializa estorno físico com cancelamento da operação", async () => {
    const f = await fixture();
    const operacao = await criarOperacao(entrada(f, "SEM_EFEITO_FINANCEIRO"));
    const resultados = await Promise.allSettled([
      estornarMovimento(operacao.movimentosEstoque[0].id, f.propriedadeId),
      estornarOperacao(operacao.id, "Cancelamento físico concorrente", { propriedadeId: f.propriedadeId }),
    ]);

    expect(resultados[1].status).toBe("fulfilled");
    const movimentos = await prisma.movimentoEstoque.findMany({ where: { operacaoId: operacao.id } });
    expect(movimentos).toHaveLength(2);
    expect(movimentos.filter((item) => item.reversaoDeId === operacao.movimentosEstoque[0].id)).toHaveLength(1);
    expect((await listarSaldos({ propriedadeId: f.propriedadeId })).find((item) => item.produtoId === f.produtoId)?.saldo).toBe(0);
  });

  it("não permite estornar novamente o movimento inverso", async () => {
    const f = await fixture();
    const operacao = await criarOperacao(entrada(f, "SEM_EFEITO_FINANCEIRO"));
    await estornarOperacao(operacao.id, "Gerar inverso físico", { propriedadeId: f.propriedadeId });
    const inverso = await prisma.movimentoEstoque.findUniqueOrThrow({ where: { reversaoDeId: operacao.movimentosEstoque[0].id } });

    await expect(estornarMovimento(inverso.id, f.propriedadeId)).rejects.toMatchObject({ code: "ORIGEM_AUTOMATICA" });
    expect(await prisma.movimentoEstoque.count({ where: { operacaoId: operacao.id } })).toBe(2);
    expect((await listarSaldos({ propriedadeId: f.propriedadeId })).find((item) => item.produtoId === f.produtoId)?.saldo).toBe(0);
  });

  it("recusa estornos fora da propriedade ativa", async () => {
    const f = await fixture();
    const operacao = await criarOperacao(entrada(f, "A_VISTA"));
    await expect(estornarTransacao(operacao.transacoes[0].id, "Escopo incorreto", { propriedadeId: f.outraPropriedadeId })).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    await expect(estornarOperacao(operacao.id, "Escopo incorreto", { propriedadeId: f.outraPropriedadeId })).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    expect(await prisma.transacaoFinanceira.count({ where: { reversaoDeId: operacao.transacoes[0].id } })).toBe(0);
    expect((await prisma.operacao.findUniqueOrThrow({ where: { id: operacao.id } })).status).toBe("CONFIRMADA");
  });
});
