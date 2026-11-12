-- Catálogo de produtos do sistema (docs/produtos.md).
-- Remove da migration 20261108120000 o que o contrato novo não mantém
-- (composição e perfil nutricional versionados, snapshot sanitário, reenvio,
-- tabelas de origem e autoria/revisão dos catálogos) e acrescenta o catálogo
-- do sistema. Os dados são carregados pela migration seguinte.

-- Gatilhos que dependem das colunas e tabelas removidas.
DROP TRIGGER "Produto_ponteiros_versionados" ON public."Produto";
DROP TRIGGER "AplicacaoProduto_composicaoSnapshot_imutavel" ON pecuaria."AplicacaoProduto";
ALTER TABLE pecuaria."AplicacaoProduto" DROP CONSTRAINT "AplicacaoProduto_composicaoSnapshot_check";
ALTER TABLE public."Produto" DROP CONSTRAINT "Produto_revisaoCadastro_check";

-- DropForeignKey
ALTER TABLE "Produto" DROP CONSTRAINT "Produto_id_composicaoVersaoAtualId_fkey";

-- DropForeignKey
ALTER TABLE "Produto" DROP CONSTRAINT "Produto_id_perfilNutricionalVersaoAtualId_fkey";

-- DropForeignKey
ALTER TABLE "FabricanteProduto" DROP CONSTRAINT "FabricanteProduto_criadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "FabricanteProduto" DROP CONSTRAINT "FabricanteProduto_atualizadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "ClassificacaoTecnicaProduto" DROP CONSTRAINT "ClassificacaoTecnicaProduto_criadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "ClassificacaoTecnicaProduto" DROP CONSTRAINT "ClassificacaoTecnicaProduto_atualizadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "PrincipioAtivo" DROP CONSTRAINT "PrincipioAtivo_criadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "PrincipioAtivo" DROP CONSTRAINT "PrincipioAtivo_atualizadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "NutrienteProdutoCatalogo" DROP CONSTRAINT "NutrienteProdutoCatalogo_criadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "NutrienteProdutoCatalogo" DROP CONSTRAINT "NutrienteProdutoCatalogo_atualizadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "ComposicaoProdutoVersao" DROP CONSTRAINT "ComposicaoProdutoVersao_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "ComposicaoProdutoVersao" DROP CONSTRAINT "ComposicaoProdutoVersao_criadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "ComposicaoProdutoItem" DROP CONSTRAINT "ComposicaoProdutoItem_versaoId_fkey";

-- DropForeignKey
ALTER TABLE "ComposicaoProdutoItem" DROP CONSTRAINT "ComposicaoProdutoItem_principioAtivoId_fkey";

-- DropForeignKey
ALTER TABLE "PerfilNutricionalProdutoVersao" DROP CONSTRAINT "PerfilNutricionalProdutoVersao_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "PerfilNutricionalProdutoVersao" DROP CONSTRAINT "PerfilNutricionalProdutoVersao_criadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "PerfilNutricionalProdutoItem" DROP CONSTRAINT "PerfilNutricionalProdutoItem_versaoId_fkey";

-- DropForeignKey
ALTER TABLE "PerfilNutricionalProdutoItem" DROP CONSTRAINT "PerfilNutricionalProdutoItem_nutrienteId_fkey";

-- DropForeignKey
ALTER TABLE "OrigemCadastroProduto" DROP CONSTRAINT "OrigemCadastroProduto_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "OrigemCadastroProduto" DROP CONSTRAINT "OrigemCadastroProduto_fabricanteId_fkey";

-- DropForeignKey
ALTER TABLE "OrigemCadastroProduto" DROP CONSTRAINT "OrigemCadastroProduto_classificacaoTecnicaId_fkey";

-- DropForeignKey
ALTER TABLE "OrigemCadastroProduto" DROP CONSTRAINT "OrigemCadastroProduto_nutrienteId_fkey";

-- DropForeignKey
ALTER TABLE "OrigemCadastroProduto" DROP CONSTRAINT "OrigemCadastroProduto_importadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "OrigemPrincipioAtivo" DROP CONSTRAINT "OrigemPrincipioAtivo_principioAtivoId_fkey";

-- DropForeignKey
ALTER TABLE "OrigemPrincipioAtivo" DROP CONSTRAINT "OrigemPrincipioAtivo_importadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "OrigemComposicaoProdutoItem" DROP CONSTRAINT "OrigemComposicaoProdutoItem_itemId_fkey";

-- DropIndex
DROP INDEX "Produto_composicaoVersaoAtualId_key";

-- DropIndex
DROP INDEX "Produto_perfilNutricionalVersaoAtualId_key";

-- DropIndex
DROP INDEX "Produto_id_composicaoVersaoAtualId_key";

-- DropIndex
DROP INDEX "Produto_id_perfilNutricionalVersaoAtualId_key";

-- AlterTable
ALTER TABLE "Produto" DROP COLUMN "composicaoVersaoAtualId",
DROP COLUMN "perfilNutricionalVersaoAtualId",
DROP COLUMN "revisaoCadastro",
ADD COLUMN     "nomeAlterado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "produtoCatalogoId" UUID;

-- AlterTable
ALTER TABLE "pecuaria"."AplicacaoProduto" DROP COLUMN "composicaoSnapshot";

-- AlterTable
ALTER TABLE "FabricanteProduto" DROP COLUMN "atualizadoEm",
DROP COLUMN "atualizadoPorId",
DROP COLUMN "criadoEm",
DROP COLUMN "criadoPorId",
DROP COLUMN "revisao",
ADD COLUMN     "codigoOrigem" TEXT;

-- AlterTable
ALTER TABLE "ClassificacaoTecnicaProduto" DROP COLUMN "atualizadoEm",
DROP COLUMN "atualizadoPorId",
DROP COLUMN "criadoEm",
DROP COLUMN "criadoPorId",
DROP COLUMN "revisao",
ADD COLUMN     "codigoOrigem" TEXT;

-- AlterTable
ALTER TABLE "PrincipioAtivo" DROP COLUMN "atualizadoEm",
DROP COLUMN "atualizadoPorId",
DROP COLUMN "criadoEm",
DROP COLUMN "criadoPorId",
DROP COLUMN "revisao",
ADD COLUMN     "codigoOrigem" TEXT;

-- Catálogos de bancos que já tinham linhas da versão anterior recebem um código provisório;
-- a carga do catálogo grava o código de origem real.
UPDATE "FabricanteProduto" SET "codigoOrigem" = 'LEGADO-' || "id"::text WHERE "codigoOrigem" IS NULL;
UPDATE "ClassificacaoTecnicaProduto" SET "codigoOrigem" = 'LEGADO-' || "id"::text WHERE "codigoOrigem" IS NULL;
UPDATE "PrincipioAtivo" SET "codigoOrigem" = 'LEGADO-' || "id"::text WHERE "codigoOrigem" IS NULL;
ALTER TABLE "FabricanteProduto" ALTER COLUMN "codigoOrigem" SET NOT NULL;
ALTER TABLE "ClassificacaoTecnicaProduto" ALTER COLUMN "codigoOrigem" SET NOT NULL;
ALTER TABLE "PrincipioAtivo" ALTER COLUMN "codigoOrigem" SET NOT NULL;

-- DropTable
DROP TABLE "NutrienteProdutoCatalogo";

-- DropTable
DROP TABLE "ComposicaoProdutoVersao";

-- DropTable
DROP TABLE "ComposicaoProdutoItem";

-- DropTable
DROP TABLE "PerfilNutricionalProdutoVersao";

-- DropTable
DROP TABLE "PerfilNutricionalProdutoItem";

-- DropTable
DROP TABLE "ReenvioCadastroEstoque";

-- DropTable
DROP TABLE "OrigemCadastroProduto";

-- DropTable
DROP TABLE "OrigemPrincipioAtivo";

-- DropTable
DROP TABLE "OrigemComposicaoProdutoItem";

-- CreateTable
CREATE TABLE "ProdutoCatalogo" (
    "id" UUID NOT NULL,
    "fonte" VARCHAR(40) NOT NULL,
    "codigoOrigem" TEXT NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "nomeNormalizado" TEXT NOT NULL,
    "apresentacao" VARCHAR(200),
    "fabricanteId" UUID,
    "classificacaoTecnicaId" UUID,
    "unidadeSugerida" "UnidadeMedida" NOT NULL DEFAULT 'UN',
    "usoSanitario" BOOLEAN NOT NULL DEFAULT false,
    "usoNutricional" BOOLEAN NOT NULL DEFAULT false,
    "usoGenetico" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "versaoCatalogo" INTEGER NOT NULL,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProdutoCatalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProdutoCatalogoPrincipioAtivo" (
    "produtoCatalogoId" UUID NOT NULL,
    "principioAtivoId" UUID NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "ProdutoCatalogoPrincipioAtivo_pkey" PRIMARY KEY ("produtoCatalogoId","principioAtivoId")
);

-- CreateIndex
CREATE INDEX "ProdutoCatalogo_nomeNormalizado_idx" ON "ProdutoCatalogo"("nomeNormalizado");

-- CreateIndex
CREATE UNIQUE INDEX "ProdutoCatalogo_fonte_codigoOrigem_key" ON "ProdutoCatalogo"("fonte", "codigoOrigem");

-- CreateIndex
CREATE UNIQUE INDEX "ProdutoCatalogoPrincipioAtivo_produtoCatalogoId_ordem_key" ON "ProdutoCatalogoPrincipioAtivo"("produtoCatalogoId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_produtoCatalogoId_key" ON "Produto"("produtoCatalogoId");

-- CreateIndex
CREATE UNIQUE INDEX "FabricanteProduto_codigoOrigem_key" ON "FabricanteProduto"("codigoOrigem");

-- CreateIndex
CREATE UNIQUE INDEX "ClassificacaoTecnicaProduto_codigoOrigem_key" ON "ClassificacaoTecnicaProduto"("codigoOrigem");

-- CreateIndex
CREATE UNIQUE INDEX "PrincipioAtivo_codigoOrigem_key" ON "PrincipioAtivo"("codigoOrigem");

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_produtoCatalogoId_fkey" FOREIGN KEY ("produtoCatalogoId") REFERENCES "ProdutoCatalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoCatalogo" ADD CONSTRAINT "ProdutoCatalogo_fabricanteId_fkey" FOREIGN KEY ("fabricanteId") REFERENCES "FabricanteProduto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoCatalogo" ADD CONSTRAINT "ProdutoCatalogo_classificacaoTecnicaId_fkey" FOREIGN KEY ("classificacaoTecnicaId") REFERENCES "ClassificacaoTecnicaProduto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoCatalogoPrincipioAtivo" ADD CONSTRAINT "ProdutoCatalogoPrincipioAtivo_produtoCatalogoId_fkey" FOREIGN KEY ("produtoCatalogoId") REFERENCES "ProdutoCatalogo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoCatalogoPrincipioAtivo" ADD CONSTRAINT "ProdutoCatalogoPrincipioAtivo_principioAtivoId_fkey" FOREIGN KEY ("principioAtivoId") REFERENCES "PrincipioAtivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Funções de gatilho das estruturas removidas.
DROP FUNCTION public.proteger_versao_produto_v1();
DROP FUNCTION public.proteger_item_produto_v1();
DROP FUNCTION public."conferir_ComposicaoProdutoVersao_v1"();
DROP FUNCTION public."conferir_PerfilNutricionalProdutoVersao_v1"();
DROP FUNCTION public.conferir_ponteiros_produto_v1();
DROP FUNCTION public.proteger_composicao_snapshot_v1();

-- Os catálogos mantêm a normalização versionada da migration anterior.
ALTER TABLE public."ProdutoCatalogo" ADD CONSTRAINT "ProdutoCatalogo_nome_check" CHECK (
 char_length(btrim("nome")) BETWEEN 2 AND 200
 AND "nomeNormalizado" = public.normalizar_nome_produto_v1("nome")
 AND "versaoCatalogo" > 0);
ALTER TABLE public."ProdutoCatalogoPrincipioAtivo" ADD CONSTRAINT "ProdutoCatalogoPrincipioAtivo_ordem_check" CHECK ("ordem" > 0);
