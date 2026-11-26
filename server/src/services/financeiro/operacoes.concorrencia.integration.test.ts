import { exigirBancoIntegracaoPecuaria } from "../../lib/banco-pecuaria-integration.fixture.js";
import { limparMovimentosValorizadosFixture } from "../../test/estoque-valorizado.fixture.js";
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
const categoriasCriadas: string[] = [];

async function fixture() {
  exigirBancoIntegracaoPecuaria();
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
  const produto = await prisma.produto.create({ data: { nome: `Produto ${sufixo}`, unidade: "KG", categoria: { create: { nome: `Categoria concorrência ${sufixo}` } } } });
  const produtoId = produto.id;
  if (produto.categoriaId) categoriasCriadas.push(produto.categoriaId);
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
      ...(somenteFisica ? { documentacaoValor: { referencia: "FIXTURE_CONCORRENCIA", evidencia: "Inventário fictício documentado para esta fixture" } } : {}),
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
  const operacoes = await prisma.operacao.findMany({ where: { propriedadeId }, select: { id: true } });
  const transacoes = await prisma.transacaoFinanceira.findMany({ where: { propriedadeId }, select: { id: true } });
  const compromissos = await prisma.compromissoFinanceiro.findMany({ where: { operacao: { propriedadeId } }, select: { id: true } });
  const contas = await prisma.contaFinanceira.findMany({ where: { propriedadeId }, select: { id: true } });
  await prisma.auditoriaFinanceira.deleteMany({ where: { entidadeId: { in: [...operacoes, ...transacoes, ...compromissos, ...contas].map(x => x.id) } } });
  await prisma.liquidacao.deleteMany({ where: { transacao: { propriedadeId } } });
  await prisma.movimentoConta.deleteMany({ where: { transacao: { propriedadeId } } });
  await prisma.transacaoFinanceira.deleteMany({ where: { propriedadeId } });
  await prisma.compromissoFinanceiro.deleteMany({ where: { operacao: { propriedadeId } } });
  await limparMovimentosValorizadosFixture(produtosCriados);
  await prisma.itemOperacao.deleteMany({ where: { operacao: { propriedadeId } } });
  await prisma.operacao.deleteMany({ where: { propriedadeId } });
  await prisma.contaFinanceira.deleteMany({ where: { propriedadeId } });
  await prisma.propriedade.deleteMany({ where: { id: propriedadeId } });
  await prisma.parceiroPapel.deleteMany({ where: { parceiroId: { in: parceirosCriados } } });
  await prisma.parceiro.deleteMany({ where: { id: { in: parceirosCriados } } });
  await prisma.produto.deleteMany({ where: { id: { in: produtosCriados } } });
  await prisma.categoria.deleteMany({ where: { id: { in: categoriasCriadas } } });
});

describeComBanco("operações financeiras concorrentes com PostgreSQL", () => {
  it("exige nova ciência após movimento concorrente e preserva o reenvio idempotente", async () => {
    const f = await fixture();
    const dados = { ...entrada(f, "A_VISTA"), chave: crypto.randomUUID() };
    dados.itens[0].valorUnitario = 110;
    const ciencia = { origem: "direta" as const };
    const aviso = await criarOperacao(dados, ciencia).catch(e => e);
    expect(aviso).toMatchObject({ code: "SALDO_NEGATIVO", saldoNegativo: { saldoAtual: "1000.00", valorPagamento: "1100.00", saldoProjetado: "-100.00" } });
    const outro = { ...entrada(f, "A_VISTA"), chave: crypto.randomUUID() };
    await criarOperacao(outro);
    const atualizado = await criarOperacao(dados, { ...ciencia, token: aviso.saldoNegativo.token }).catch(e => e);
    expect(atualizado).toMatchObject({ code: "SALDO_NEGATIVO", saldoNegativo: { saldoAtual: "900.00", saldoProjetado: "-200.00" } });
    const salva = await criarOperacao(dados, { ...ciencia, token: atualizado.saldoNegativo.token });
    const repetida = await criarOperacao(dados, ciencia);
    expect(repetida.id).toBe(salva.id);
    expect(await prisma.transacaoFinanceira.count({ where: { operacaoId: salva.id } })).toBe(1);
  });

  it("serializa pagamentos concorrentes antes da projeção", async () => {
    const f = await fixture();
    const dados = entrada(f, "A_VISTA");
    dados.itens[0].valorUnitario = 70;
    const outroProduto = await prisma.produto.create({ data: { nome: `Produto paralelo ${crypto.randomUUID()}`, unidade: "KG" } });
    produtosCriados.push(outroProduto.id);
    const dadosParalelos = { ...dados, itens: [{ ...dados.itens[0], produtoId: outroProduto.id }] };
    const resultados = await Promise.allSettled([
      criarOperacao({ ...dados, chave: crypto.randomUUID() }, { origem: "direta" }),
      criarOperacao({ ...dadosParalelos, chave: crypto.randomUUID() }, { origem: "direta" }),
    ]);
    expect(resultados.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(resultados.filter(r => r.status === "rejected")).toEqual([expect.objectContaining({ reason: expect.objectContaining({ code: "SALDO_NEGATIVO", saldoNegativo: expect.objectContaining({ saldoAtual: "300.00", saldoProjetado: "-400.00" }) }) })]);
  });

  it("rejeita liquidação fora do sítio sem gravar e aceita no sítio do fato", async () => {
    const f = await fixture();
    const operacao = await criarOperacao(entrada(f, "A_PRAZO"));
    const compromissoId = operacao.compromissos[0].id;
    const antes = await prisma.transacaoFinanceira.count({ where: { operacaoId: operacao.id } });
    await expect(liquidarCompromisso(compromissoId, { data: new Date(), valor: 1, contaId: f.contaId, propriedadeId: f.outraPropriedadeId })).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    expect(await prisma.transacaoFinanceira.count({ where: { operacaoId: operacao.id } })).toBe(antes);
    expect(await prisma.liquidacao.count({ where: { compromissoId } })).toBe(0);
    const salva = await liquidarCompromisso(compromissoId, { data: new Date(), valor: 1, contaId: f.contaId, propriedadeId: f.propriedadeId });
    expect(salva.propriedadeId).toBe(f.propriedadeId);
    expect(await prisma.liquidacao.count({ where: { compromissoId } })).toBe(1);
  });
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
