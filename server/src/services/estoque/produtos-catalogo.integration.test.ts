import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../db.js";
import { exigirBancoIntegracaoPecuaria } from "../../lib/banco-pecuaria-integration.fixture.js";
import { normalizarNomeCatalogo } from "./catalogos.js";
import { adotarProdutoCatalogoTx, resolverProdutoIdTx } from "./produtos-catalogo.js";
import { criarOperacao } from "../financeiro/operacoes.js";
import { operacaoSchema } from "../financeiro/schemas.js";

const comBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;

// Fixtures próprias (sítio, fornecedor, categoria e itens de catálogo com fonte QA); nada do seed é alterado.
comBanco("Adoção de item do catálogo com PostgreSQL", () => {
  const run = randomUUID().slice(0, 8);
  const fonte = "QA_CATALOGO_ADOCAO";
  const ids = { categoria: "", itens: [] as string[], propriedade: 0, parceiro: "" };

  async function criarItem(sufixo: string, extra: { ativo?: boolean } = {}) {
    const nome = `QA Catálogo ${run} ${sufixo}`;
    const item = await prisma.produtoCatalogo.create({ data: { id: randomUUID(), fonte, codigoOrigem: `${run}-${sufixo}`, nome, nomeNormalizado: normalizarNomeCatalogo(nome),
      apresentacao: "Frasco 50 mL", unidadeSugerida: "ML", usoSanitario: true, versaoCatalogo: 1, ...extra } });
    ids.itens.push(item.id);
    return item;
  }

  beforeAll(async () => {
    exigirBancoIntegracaoPecuaria();
    ids.categoria = (await prisma.categoria.create({ data: { nome: `QA Catálogo adoção ${run}`, usoSanitario: true } })).id;
    ids.propriedade = (await prisma.propriedade.create({ data: { nome: `QA Catálogo ${run}` } })).id;
    ids.parceiro = (await prisma.parceiro.create({ data: { nome: `QA Fornecedor catálogo ${run}`, tipo: "FORNECEDOR", papeis: { create: { papel: "FORNECEDOR" } } } })).id;
  });

  afterAll(async () => {
    const produtos = await prisma.produto.findMany({ where: { OR: [{ produtoCatalogoId: { in: ids.itens } }, { nome: { startsWith: `QA Catálogo ${run}` } }] }, select: { id: true } });
    const produtoIds = produtos.map((p) => p.id);
    await prisma.auditoriaFinanceira.deleteMany({ where: { entidade: "Produto", entidadeId: { in: produtoIds } } });
    await prisma.produto.deleteMany({ where: { id: { in: produtoIds } } });
    await prisma.produtoCatalogo.deleteMany({ where: { id: { in: ids.itens } } });
    if (ids.categoria) await prisma.categoria.deleteMany({ where: { id: ids.categoria } });
    if (ids.parceiro) await prisma.parceiro.deleteMany({ where: { id: ids.parceiro } });
    if (ids.propriedade) await prisma.propriedade.deleteMany({ where: { id: ids.propriedade } });
  });

  it("duas adoções simultâneas do mesmo item resolvem para um único Produto", async () => {
    const item = await criarItem("concorrente");
    const adotar = (atraso: number) => prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_sleep(${atraso})`;
      const id = await adotarProdutoCatalogoTx(tx, item.id, { categoriaId: ids.categoria });
      // Segura a transação aberta para que a outra encontre a linha ainda não confirmada.
      await tx.$executeRaw`SELECT pg_sleep(0.4)`;
      return id;
    }, { timeout: 20_000 });
    const [a, b] = await Promise.all([adotar(0), adotar(0.1)]);
    expect(a).toBe(b);
    const produtos = await prisma.produto.findMany({ where: { produtoCatalogoId: item.id } });
    expect(produtos).toHaveLength(1);
    expect(produtos[0]).toMatchObject({ nome: `${item.nome} (Frasco 50 mL)`, unidade: "ML", categoriaId: ids.categoria, usoSanitario: true,
      nomeAlterado: false, apresentacao: null, fabricanteId: null, classificacaoTecnicaId: null });
    expect(await prisma.auditoriaFinanceira.count({ where: { entidade: "Produto", entidadeId: a, acao: "CRIADO" } })).toBe(1);
  }, 30_000);

  it("nome já usado por outro Produto: conflito que identifica o existente, sem fusão; item inativo é recusado", async () => {
    const item = await criarItem("homonimo");
    const inativo = await criarItem("inativo", { ativo: false });
    const abortar = new Error("Rollback intencional");
    await expect(prisma.$transaction(async (tx) => {
      const existente = await tx.produto.create({ data: { nome: `${item.nome} (Frasco 50 mL)`, categoriaId: ids.categoria } });
      await expect(adotarProdutoCatalogoTx(tx, item.id, { categoriaId: ids.categoria })).rejects.toMatchObject({
        code: "CONFLITO", campo: "produtoCatalogoId", produtoExistente: { id: existente.id, nome: existente.nome } });
      expect(await tx.produto.findFirst({ where: { produtoCatalogoId: item.id } })).toBeNull();
      expect(await tx.produto.findUniqueOrThrow({ where: { id: existente.id } })).toMatchObject({ produtoCatalogoId: null });
      await expect(resolverProdutoIdTx(tx, { produtoCatalogoId: inativo.id, categoriaId: ids.categoria })).rejects.toMatchObject({ code: "VALIDACAO", campo: "produtoCatalogoId" });
      throw abortar;
    }, { timeout: 20_000 })).rejects.toBe(abortar);
    expect(await prisma.produto.count({ where: { nome: { startsWith: item.nome } } })).toBe(0);
  }, 30_000);

  it("compra que falha depois da adoção não deixa Produto", async () => {
    const item = await criarItem("compra");
    // Item sem centro de custo numa compra para consumo direto: a validação de centro vem depois da adoção.
    const input = operacaoSchema.parse({ tipo: "COMPRA_CONSUMO_DIRETO", data: new Date().toISOString().slice(0, 10), descricao: `QA compra ${run}`, parceiroId: ids.parceiro,
      financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" },
      itens: [{ produtoCatalogoId: item.id, categoriaId: ids.categoria, descricao: "Item do catálogo", quantidade: 1, unidade: "mL", valorTotal: 10 }] });
    await expect(criarOperacao({ ...input, propriedadeId: ids.propriedade, usuarioId: null })).rejects.toMatchObject({ code: "VALIDACAO", campo: "itens.0.centroCustoId" });
    expect(await prisma.produto.count({ where: { produtoCatalogoId: item.id } })).toBe(0);
  }, 30_000);
});
