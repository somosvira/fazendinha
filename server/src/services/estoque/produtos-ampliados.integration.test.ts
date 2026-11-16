import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../../db.js";
import { exigirBancoIntegracaoPecuaria } from "../../lib/banco-pecuaria-integration.fixture.js";
import { criarProdutoTx } from "./produtos.js";
import { produtoSchema } from "./produtos.schemas.js";
import { normalizarNomeCatalogo } from "./catalogos.js";

const comBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;

comBanco("Produtos ampliados: serviços com PostgreSQL e rollback integral", () => {
  it("grava atributos ampliados com fabricante e classificação do catálogo sem deixar fixtures no banco", async () => {
    exigirBancoIntegracaoPecuaria();
    const marcador = `QA produtos ampliados ${randomUUID()}`;
    const fabricanteId = randomUUID(), classificacaoId = randomUUID();
    const abortar = new Error("Rollback intencional: nenhuma fixture deve persistir");

    await expect(prisma.$transaction(async tx => {
      // Único cadastro preexistente consultado: categoria obrigatória, sem alteração.
      const categoria = await tx.categoria.findFirst({ orderBy: { id: "asc" }, select: { id: true } });
      expect(categoria, "O seedatev3 deve oferecer uma categoria financeira").not.toBeNull();
      const nomeFabricante = `${marcador} fabricante`, nomeClassificacao = `${marcador} classificação`;
      await tx.fabricanteProduto.create({ data: { id: fabricanteId, codigoOrigem: `QA-${fabricanteId}`, nome: nomeFabricante, nomeNormalizado: normalizarNomeCatalogo(nomeFabricante) } });
      await tx.classificacaoTecnicaProduto.create({ data: { id: classificacaoId, codigoOrigem: `QA-${classificacaoId}`, nome: nomeClassificacao, nomeNormalizado: normalizarNomeCatalogo(nomeClassificacao) } });

      const input = produtoSchema.parse({ nome: marcador, categoriaId: categoria!.id, unidade: "KG", usoNutricional: true,
        codigoReferencia: "QA-ROLLBACK", apresentacao: "Embalagem fictícia", observacao: "Somente fixture transacional", conservacao: null,
        fabricanteId, classificacaoTecnicaId: classificacaoId });
      const criado = await criarProdutoTx(tx, input, null);
      expect(criado).toMatchObject({ codigoReferencia: "QA-ROLLBACK", apresentacao: "Embalagem fictícia", fabricanteId, classificacaoTecnicaId: classificacaoId });
      expect(await tx.auditoriaFinanceira.count({ where: { entidade: "Produto", entidadeId: criado.id } })).toBe(1);
      expect(await tx.produto.findUniqueOrThrow({ where: { id: criado.id }, select: { produtoCatalogoId: true, nomeAlterado: true } })).toEqual({ produtoCatalogoId: null, nomeAlterado: false });

      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      throw abortar;
    }, { timeout: 30_000 })).rejects.toBe(abortar);

    expect(await prisma.produto.count({ where: { nome: marcador } })).toBe(0);
    expect(await prisma.fabricanteProduto.count({ where: { id: fabricanteId } })).toBe(0);
    expect(await prisma.classificacaoTecnicaProduto.count({ where: { id: classificacaoId } })).toBe(0);
  }, 40_000);
});
