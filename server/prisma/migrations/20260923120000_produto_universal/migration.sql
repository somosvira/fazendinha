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

-- Backfill: produto com tipo/subtipoPlantio mas SEM categoria (categoriaId
-- IS NULL) ficaria sem nenhuma marcação de uso e ainda quebraria a regra
-- de backend "produto estocável exige categoria". Cria (se ainda não
-- existir) uma categoria "migrada" com a marcação certa e associa esses
-- produtos a ela. Ordem importa: um produto só cai num dos três blocos
-- (o primeiro que bater deixa de satisfazer "categoriaId IS NULL" para
-- os seguintes).
DO $$
DECLARE
  cat_id INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM "Produto" WHERE "tipo" = 'MEDICAMENTO' AND "categoriaId" IS NULL) THEN
    SELECT id INTO cat_id FROM "Categoria" WHERE "nome" = 'Medicamentos (migrados)';
    IF cat_id IS NULL THEN
      INSERT INTO "Categoria" ("nome", "usoSanitario", "usoNutricional", "usoAgricola", "ativo", "ordem")
      VALUES ('Medicamentos (migrados)', true, false, false, true, 0)
      RETURNING id INTO cat_id;
    ELSE
      UPDATE "Categoria" SET "usoSanitario" = true WHERE id = cat_id;
    END IF;
    UPDATE "Produto" SET "categoriaId" = cat_id WHERE "tipo" = 'MEDICAMENTO' AND "categoriaId" IS NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM "Produto" WHERE "tipo" IN ('RACAO', 'MINERAL') AND "categoriaId" IS NULL) THEN
    SELECT id INTO cat_id FROM "Categoria" WHERE "nome" = 'Alimentação (migrada)';
    IF cat_id IS NULL THEN
      INSERT INTO "Categoria" ("nome", "usoSanitario", "usoNutricional", "usoAgricola", "ativo", "ordem")
      VALUES ('Alimentação (migrada)', false, true, false, true, 0)
      RETURNING id INTO cat_id;
    ELSE
      UPDATE "Categoria" SET "usoNutricional" = true WHERE id = cat_id;
    END IF;
    UPDATE "Produto" SET "categoriaId" = cat_id WHERE "tipo" IN ('RACAO', 'MINERAL') AND "categoriaId" IS NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM "Produto" WHERE "subtipoPlantio" IS NOT NULL AND "categoriaId" IS NULL) THEN
    SELECT id INTO cat_id FROM "Categoria" WHERE "nome" = 'Insumos agrícolas (migrados)';
    IF cat_id IS NULL THEN
      INSERT INTO "Categoria" ("nome", "usoSanitario", "usoNutricional", "usoAgricola", "ativo", "ordem")
      VALUES ('Insumos agrícolas (migrados)', false, false, true, true, 0)
      RETURNING id INTO cat_id;
    ELSE
      UPDATE "Categoria" SET "usoAgricola" = true WHERE id = cat_id;
    END IF;
    UPDATE "Produto" SET "categoriaId" = cat_id WHERE "subtipoPlantio" IS NOT NULL AND "categoriaId" IS NULL;
  END IF;
END $$;

-- DropIndex
DROP INDEX "Produto_tipo_idx";

-- Function de apoio (só existe durante esta migration, removida no fim do
-- arquivo): normaliza texto livre de unidade (minúsculas, sem acento, sem
-- ponto final) e mapeia para o enum UnidadeMedida. Usada tanto para
-- validar (RAISE EXCEPTION com os valores não reconhecidos) quanto para
-- converter de fato — uma única fonte de verdade para o mapeamento.
CREATE FUNCTION "_produtoUniversalMapearUnidade"(valor TEXT) RETURNS "UnidadeMedida"
LANGUAGE sql IMMUTABLE AS $mapear$
  SELECT CASE regexp_replace(
      translate(
        lower(trim(valor)),
        'áàãâäéèêëíìîïóòõôöúùûüçñÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇÑ',
        'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
      ),
      '\.$', ''
    )
    WHEN 'un' THEN 'UN' WHEN 'und' THEN 'UN' WHEN 'unid' THEN 'UN' WHEN 'unidade' THEN 'UN' WHEN 'unidades' THEN 'UN'
    WHEN 'kg' THEN 'KG' WHEN 'kgs' THEN 'KG' WHEN 'quilo' THEN 'KG' WHEN 'quilos' THEN 'KG' WHEN 'quilograma' THEN 'KG' WHEN 'quilogramas' THEN 'KG'
    WHEN 'g' THEN 'G' WHEN 'gr' THEN 'G' WHEN 'grama' THEN 'G' WHEN 'gramas' THEN 'G'
    WHEN 't' THEN 'T' WHEN 'ton' THEN 'T' WHEN 'tonelada' THEN 'T' WHEN 'toneladas' THEN 'T'
    WHEN 'l' THEN 'L' WHEN 'lt' THEN 'L' WHEN 'lts' THEN 'L' WHEN 'litro' THEN 'L' WHEN 'litros' THEN 'L'
    WHEN 'ml' THEN 'ML' WHEN 'mls' THEN 'ML' WHEN 'mililitro' THEN 'ML' WHEN 'mililitros' THEN 'ML' WHEN 'cc' THEN 'ML'
    WHEN 'sc' THEN 'SC' WHEN 'saco' THEN 'SC' WHEN 'sacos' THEN 'SC' WHEN 'saca' THEN 'SC' WHEN 'sacas' THEN 'SC'
    WHEN 'dose' THEN 'DOSE' WHEN 'doses' THEN 'DOSE' WHEN 'dse' THEN 'DOSE'
    WHEN 'cx' THEN 'CX' WHEN 'caixa' THEN 'CX' WHEN 'caixas' THEN 'CX'
    WHEN 'm' THEN 'M' WHEN 'mt' THEN 'M' WHEN 'metro' THEN 'M' WHEN 'metros' THEN 'M'
    WHEN 'ha' THEN 'HA' WHEN 'hectare' THEN 'HA' WHEN 'hectares' THEN 'HA'
    WHEN 'fr' THEN 'UN' WHEN 'frasco' THEN 'UN' WHEN 'frascos' THEN 'UN'
    WHEN 'amp' THEN 'UN' WHEN 'ampola' THEN 'UN' WHEN 'ampolas' THEN 'UN'
    WHEN 'gl' THEN 'UN' WHEN 'galao' THEN 'L' WHEN 'galoes' THEN 'L'
    WHEN 'pct' THEN 'UN' WHEN 'pacote' THEN 'UN' WHEN 'pacotes' THEN 'UN'
    ELSE NULL
  END::"UnidadeMedida"
$mapear$;

-- AlterTable: DietaItem.unidade — texto livre → enum, convertendo valores
-- conhecidos (incluindo plurais/abreviações comuns). Valida ANTES de
-- converter: se sobrar algum valor não mapeado, aborta com uma mensagem
-- que lista os valores distintos — melhor parar aqui com diagnóstico do
-- que travar num erro genérico do Postgres ou gravar "un" errado em silêncio.
DO $$
DECLARE
  valores_invalidos TEXT;
BEGIN
  SELECT string_agg(DISTINCT "unidade", ', ' ORDER BY "unidade") INTO valores_invalidos
  FROM "DietaItem"
  WHERE "unidade" IS NOT NULL
    AND "_produtoUniversalMapearUnidade"("unidade") IS NULL;

  IF valores_invalidos IS NOT NULL THEN
    RAISE EXCEPTION 'DietaItem.unidade tem valores não reconhecidos: %. Corrija manualmente antes de aplicar esta migration.', valores_invalidos;
  END IF;
END $$;

ALTER TABLE "DietaItem" ALTER COLUMN "unidade" TYPE "UnidadeMedida" USING (
  "_produtoUniversalMapearUnidade"("unidade")
);

-- AlterTable: Produto.unidade — mesma conversão, mesma validação prévia.
ALTER TABLE "Produto" ALTER COLUMN "unidade" DROP DEFAULT;

DO $$
DECLARE
  valores_invalidos TEXT;
BEGIN
  SELECT string_agg(DISTINCT "unidade", ', ' ORDER BY "unidade") INTO valores_invalidos
  FROM "Produto"
  WHERE "unidade" IS NOT NULL
    AND "_produtoUniversalMapearUnidade"("unidade") IS NULL;

  IF valores_invalidos IS NOT NULL THEN
    RAISE EXCEPTION 'Produto.unidade tem valores não reconhecidos: %. Corrija manualmente antes de aplicar esta migration.', valores_invalidos;
  END IF;
END $$;

ALTER TABLE "Produto" ALTER COLUMN "unidade" TYPE "UnidadeMedida" USING (
  "_produtoUniversalMapearUnidade"("unidade")
);
ALTER TABLE "Produto" ALTER COLUMN "unidade" SET DEFAULT 'UN';

-- DropFunction: função de apoio só usada durante esta migration.
DROP FUNCTION "_produtoUniversalMapearUnidade"(TEXT);

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
