import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../../db.js";
import { exigirBancoIntegracaoPecuaria } from "../../lib/banco-pecuaria-integration.fixture.js";
import { criarProdutoTx, includeProduto, produtoDTO } from "./produtos.js";
import { produtoSchema } from "./produtos.schemas.js";
import { composicaoSchema, informacoesNutricionaisSchema } from "./composicao.schemas.js";
import { capturarComposicaoTx, salvarComposicaoTx, salvarNutricaoTx } from "./composicao.js";
import { comReenvioCadastro, normalizarNomeCatalogo } from "./cadastro-reenvio.js";

const comBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;

comBanco("Produtos ampliados: serviços com PostgreSQL e rollback integral", () => {
  it("grava versões, snapshots e reenvio reais sem deixar fixtures no banco", async () => {
    exigirBancoIntegracaoPecuaria();
    const marcador = `QA produtos ampliados ${randomUUID()}`;
    const principioId = randomUUID(), nutrienteId = randomUUID(), chave = randomUUID();
    const abortar = new Error("Rollback intencional: nenhuma fixture deve persistir");
    let produtoId: string | undefined;
    let gravacoesProduto = 0;

    await expect(prisma.$transaction(async tx => {
      // Único cadastro preexistente consultado: categoria obrigatória, sem alteração.
      const categoria = await tx.categoria.findFirst({ orderBy: { id: "asc" }, select: { id: true } });
      expect(categoria, "O seedatev3 deve oferecer uma categoria financeira").not.toBeNull();
      const nomePrincipio = `${marcador} ingrediente`;
      const nomeNutriente = `${marcador} nutriente`;
      await tx.principioAtivo.create({ data: { id: principioId, nome: nomePrincipio, nomeNormalizado: normalizarNomeCatalogo(nomePrincipio) } });
      await tx.nutrienteProdutoCatalogo.create({ data: { id: nutrienteId, nome: nomeNutriente, nomeNormalizado: normalizarNomeCatalogo(nomeNutriente), unidadeReferencia: "PERCENTUAL" } });

      const composicao = composicaoSchema.parse({ situacao: "INFORMADA", versaoEsperada: null, referencia: "Rótulo fictício da fixture", itens: [{ principioAtivoId: principioId, concentracaoValor: "1.123456", concentracaoUnidade: "MG_ML" }] });
      const nutricional = informacoesNutricionaisSchema.parse({ situacao: "INFORMADA", versaoEsperada: null, referencia: "Análise fictícia da fixture", itens: [{ nutrienteId, valor: "0", base: "MATERIA_SECA" }] });
      const input = produtoSchema.parse({ nome: marcador, categoriaId: categoria!.id, unidade: "KG", usoNutricional: true,
        codigoReferencia: "QA-ROLLBACK", apresentacao: "Embalagem fictícia", observacao: "Somente fixture transacional", conservacao: null,
        chaveReenvio: chave, composicao, informacoesNutricionais: nutricional, perfilNutricional: { materiaSecaPercentual: 82.25 } });
      const gravar = async () => { gravacoesProduto++; return criarProdutoTx(tx, input, null); };
      const criado = await comReenvioCadastro(tx, "qa:produto:criar", null, chave, input, gravar);
      produtoId = criado.id;
      expect(criado).toMatchObject({ codigoReferencia: "QA-ROLLBACK", apresentacao: "Embalagem fictícia", revisaoCadastro: 1,
        composicao: { numero: 1, situacao: "INFORMADA", itens: [{ nomePrincipioSnapshot: nomePrincipio, concentracaoValor: "1.123456" }] },
        informacoesNutricionais: { numero: 1, materiaSecaSnapshot: "82.25", itens: [{ valor: "0", unidadeSnapshot: "PERCENTUAL", base: "MATERIA_SECA" }] } });
      expect(await tx.auditoriaFinanceira.count({ where: { entidade: "Produto", entidadeId: criado.id } })).toBe(1);

      // O resultado persistido é retornado antes de qualquer nova execução.
      expect(await comReenvioCadastro(tx, "qa:produto:criar", null, chave, input, gravar)).toEqual(criado);
      expect(gravacoesProduto).toBe(1);
      await expect(comReenvioCadastro(tx, "qa:produto:criar", null, chave, { ...input, nome: "Outro payload" }, gravar))
        .rejects.toMatchObject({ code: "CONFLITO", campo: "chaveReenvio" });

      const composicaoAtual = { ...composicao, versaoEsperada: criado.composicao.id };
      const nutricionalAtual = { ...nutricional, versaoEsperada: criado.informacoesNutricionais.id };
      await salvarComposicaoTx(tx, criado.id, composicaoAtual, null);
      await salvarNutricaoTx(tx, criado.id, nutricionalAtual, null);
      expect(await tx.composicaoProdutoVersao.count({ where: { produtoId: criado.id } })).toBe(1);
      expect(await tx.perfilNutricionalProdutoVersao.count({ where: { produtoId: criado.id } })).toBe(1);
      const snapshot = await capturarComposicaoTx(tx, criado.id);
      expect(snapshot).toMatchObject({ schemaVersion: 1, versaoComposicaoId: criado.composicao.id, contexto: "CADASTRO_NA_GRAVACAO", itens: [{ nomePrincipioSnapshot: nomePrincipio, concentracaoValor: "1.123456" }] });

      const alterada = composicaoSchema.parse({ ...composicaoAtual, itens: [{ ...composicao.itens[0], concentracaoValor: "2.5" }] });
      // Erros de domínio são JavaScript: não abortam a transação PostgreSQL.
      await expect(salvarComposicaoTx(tx, criado.id, { ...alterada, versaoEsperada: null }, null)).rejects.toMatchObject({ code: "CONFLITO" });
      await expect(salvarComposicaoTx(tx, criado.id, alterada, null)).rejects.toMatchObject({ code: "VALIDACAO", campo: "motivoAlteracao" });
      await salvarComposicaoTx(tx, criado.id, { ...alterada, motivoAlteracao: "Correção documentada na fixture" }, null);
      await expect(salvarComposicaoTx(tx, criado.id, { ...alterada, motivoAlteracao: "Revisão antiga da fixture" }, null)).rejects.toMatchObject({ code: "CONFLITO" });
      await salvarNutricaoTx(tx, criado.id, { ...nutricionalAtual, motivoAlteracao: "Novo resultado documentado", itens: [{ nutrienteId, valor: "5.123456", base: "MATERIA_NATURAL" }] }, null);
      const final = produtoDTO(await tx.produto.findUniqueOrThrow({ where: { id: criado.id }, include: includeProduto }));
      expect(final.composicao).toMatchObject({ numero: 2, itens: [{ concentracaoValor: "2.5" }] });
      expect(final.informacoesNutricionais).toMatchObject({ numero: 2, materiaSecaSnapshot: "82.25", itens: [{ valor: "5.123456", base: "MATERIA_NATURAL" }] });
      expect(await tx.composicaoProdutoVersao.count({ where: { produtoId: criado.id } })).toBe(2);
      expect(await tx.perfilNutricionalProdutoVersao.count({ where: { produtoId: criado.id } })).toBe(2);
      expect(snapshot).toMatchObject({ versaoComposicaoId: criado.composicao.id, itens: [{ concentracaoValor: "1.123456" }] });
      expect((await tx.composicaoProdutoItem.findFirstOrThrow({ where: { versaoId: criado.composicao.id! } })).concentracaoValor?.toString()).toBe("1.123456");

      // Dispara também as garantias SQL diferidas antes de reverter o ensaio.
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      throw abortar;
    }, { timeout: 30_000 })).rejects.toBe(abortar);

    expect(produtoId).toBeDefined();
    expect(gravacoesProduto).toBe(1);
    expect(await prisma.produto.count({ where: { nome: marcador } })).toBe(0);
    expect(await prisma.principioAtivo.count({ where: { id: principioId } })).toBe(0);
    expect(await prisma.nutrienteProdutoCatalogo.count({ where: { id: nutrienteId } })).toBe(0);
    expect(await prisma.reenvioCadastroEstoque.count({ where: { chave } })).toBe(0);
    expect(await prisma.composicaoProdutoVersao.count({ where: { produtoId } })).toBe(0);
    expect(await prisma.perfilNutricionalProdutoVersao.count({ where: { produtoId } })).toBe(0);
    expect(await prisma.auditoriaFinanceira.count({ where: { entidadeId: produtoId } })).toBe(0);
  }, 40_000);
});
