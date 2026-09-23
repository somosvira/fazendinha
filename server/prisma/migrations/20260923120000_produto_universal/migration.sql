-- Produto universal: classificação por categoria, unidade padronizada.
-- Sem dados reais em produção até esta data — mesmo assim, a conversão
-- abaixo preserva o máximo de informação possível e ABORTA em vez de
-- corromper silenciosamente o que não conseguir interpretar.

-- CreateEnum
CREATE TYPE "UnidadeMedida" AS ENUM ('UN', 'KG', 'G', 'T', 'L', 'ML', 'SC', 'DOSE', 'CX', 'M', 'HA');

-- AlterTable: novas marcações de uso da categoria (default false)
ALTER TABLE "Categoria" ADD COLUMN     "usoAgricola" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "usoNutricional" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "usoSanitario" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: marca a categoria de cada produto conforme o tipo/subtipo que
-- ele tinha, ANTES de essas colunas serem removidas de Produto. Sem isso,
-- todo produto ficaria sem uso e sumiria dos seletores de sanidade, dieta
-- e aplicação agrícola.
UPDATE "Categoria" c SET "usoSanitario" = true
WHERE EXISTS (SELECT 1 FROM "Produto" p WHERE p."categoriaId" = c.id AND p."tipo" = 'MEDICAMENTO');

UPDATE "Categoria" c SET "usoNutricional" = true
WHERE EXISTS (SELECT 1 FROM "Produto" p WHERE p."categoriaId" = c.id AND p."tipo" IN ('RACAO', 'MINERAL'));

UPDATE "Categoria" c SET "usoAgricola" = true
WHERE EXISTS (SELECT 1 FROM "Produto" p WHERE p."categoriaId" = c.id AND p."subtipoPlantio" IS NOT NULL);

-- DropIndex
DROP INDEX "Produto_tipo_idx";

-- AlterTable: DietaItem.unidade — texto livre → enum, convertendo valores
-- conhecidos (incluindo plurais/abreviações comuns). Unidade não mapeada
-- vira NULL, o que quebra a coluna NOT NULL e ABORTA a migration — é
-- proposital: melhor parar aqui do que gravar "un" errado em silêncio.
ALTER TABLE "DietaItem" ALTER COLUMN "unidade" TYPE "UnidadeMedida" USING (
  CASE regexp_replace(lower(trim("unidade")), '\.$', '')
    WHEN 'un' THEN 'UN' WHEN 'und' THEN 'UN' WHEN 'unid' THEN 'UN' WHEN 'unidade' THEN 'UN' WHEN 'unidades' THEN 'UN'
    WHEN 'kg' THEN 'KG' WHEN 'kgs' THEN 'KG' WHEN 'quilo' THEN 'KG' WHEN 'quilos' THEN 'KG' WHEN 'quilograma' THEN 'KG' WHEN 'quilogramas' THEN 'KG'
    WHEN 'g' THEN 'G' WHEN 'gr' THEN 'G' WHEN 'grama' THEN 'G' WHEN 'gramas' THEN 'G'
    WHEN 't' THEN 'T' WHEN 'ton' THEN 'T' WHEN 'tonelada' THEN 'T' WHEN 'toneladas' THEN 'T'
    WHEN 'l' THEN 'L' WHEN 'lt' THEN 'L' WHEN 'lts' THEN 'L' WHEN 'litro' THEN 'L' WHEN 'litros' THEN 'L'
    WHEN 'ml' THEN 'ML' WHEN 'mls' THEN 'ML' WHEN 'mililitro' THEN 'ML' WHEN 'mililitros' THEN 'ML' WHEN 'cc' THEN 'ML'
    WHEN 'sc' THEN 'SC' WHEN 'saco' THEN 'SC' WHEN 'sacos' THEN 'SC'
    WHEN 'dose' THEN 'DOSE' WHEN 'doses' THEN 'DOSE' WHEN 'dse' THEN 'DOSE'
    WHEN 'cx' THEN 'CX' WHEN 'caixa' THEN 'CX' WHEN 'caixas' THEN 'CX'
    WHEN 'm' THEN 'M' WHEN 'mt' THEN 'M' WHEN 'metro' THEN 'M' WHEN 'metros' THEN 'M'
    WHEN 'ha' THEN 'HA' WHEN 'hectare' THEN 'HA' WHEN 'hectares' THEN 'HA'
    ELSE NULL
  END::"UnidadeMedida"
);

-- AlterTable: Produto.unidade — mesma conversão.
ALTER TABLE "Produto" ALTER COLUMN "unidade" DROP DEFAULT;
ALTER TABLE "Produto" ALTER COLUMN "unidade" TYPE "UnidadeMedida" USING (
  CASE regexp_replace(lower(trim("unidade")), '\.$', '')
    WHEN 'un' THEN 'UN' WHEN 'und' THEN 'UN' WHEN 'unid' THEN 'UN' WHEN 'unidade' THEN 'UN' WHEN 'unidades' THEN 'UN'
    WHEN 'kg' THEN 'KG' WHEN 'kgs' THEN 'KG' WHEN 'quilo' THEN 'KG' WHEN 'quilos' THEN 'KG' WHEN 'quilograma' THEN 'KG' WHEN 'quilogramas' THEN 'KG'
    WHEN 'g' THEN 'G' WHEN 'gr' THEN 'G' WHEN 'grama' THEN 'G' WHEN 'gramas' THEN 'G'
    WHEN 't' THEN 'T' WHEN 'ton' THEN 'T' WHEN 'tonelada' THEN 'T' WHEN 'toneladas' THEN 'T'
    WHEN 'l' THEN 'L' WHEN 'lt' THEN 'L' WHEN 'lts' THEN 'L' WHEN 'litro' THEN 'L' WHEN 'litros' THEN 'L'
    WHEN 'ml' THEN 'ML' WHEN 'mls' THEN 'ML' WHEN 'mililitro' THEN 'ML' WHEN 'mililitros' THEN 'ML' WHEN 'cc' THEN 'ML'
    WHEN 'sc' THEN 'SC' WHEN 'saco' THEN 'SC' WHEN 'sacos' THEN 'SC'
    WHEN 'dose' THEN 'DOSE' WHEN 'doses' THEN 'DOSE' WHEN 'dse' THEN 'DOSE'
    WHEN 'cx' THEN 'CX' WHEN 'caixa' THEN 'CX' WHEN 'caixas' THEN 'CX'
    WHEN 'm' THEN 'M' WHEN 'mt' THEN 'M' WHEN 'metro' THEN 'M' WHEN 'metros' THEN 'M'
    WHEN 'ha' THEN 'HA' WHEN 'hectare' THEN 'HA' WHEN 'hectares' THEN 'HA'
    ELSE NULL
  END::"UnidadeMedida"
);
ALTER TABLE "Produto" ALTER COLUMN "unidade" SET DEFAULT 'UN';

-- AlterTable: colunas de produto que saem (preço, tipo, carência, % MS)
ALTER TABLE "Produto" DROP COLUMN "carencia",
DROP COLUMN "custoUnitario",
DROP COLUMN "percentualMS",
DROP COLUMN "subtipoPlantio",
DROP COLUMN "tipo";

-- AlterTable: precisão alinhada entre item da operação, movimento de
-- estoque e evento sanitário (todos passam a lidar com 3 casas de
-- quantidade, coerentes com a conversão de dose por hectare do plantio).
ALTER TABLE "EventoSanitario" ALTER COLUMN "quantidadeUsada" SET DATA TYPE DECIMAL(12,3);
ALTER TABLE "MovimentoEstoque" ALTER COLUMN "quantidade" SET DATA TYPE DECIMAL(12,3),
ALTER COLUMN "custoUnitario" SET DATA TYPE DECIMAL(14,4);
ALTER TABLE "OperacaoAgricola" ALTER COLUMN "quantidadeTotal" SET DATA TYPE DECIMAL(12,3);

-- DropEnum
DROP TYPE "TipoInsumoPlantio";

-- DropEnum
DROP TYPE "TipoProduto";
