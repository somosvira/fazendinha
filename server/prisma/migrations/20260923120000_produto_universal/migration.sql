-- CreateEnum
CREATE TYPE "UnidadeMedida" AS ENUM ('UN', 'KG', 'G', 'T', 'L', 'ML', 'SC', 'DOSE', 'CX', 'M', 'HA');

-- DropIndex
DROP INDEX "Produto_tipo_idx";

-- AlterTable
ALTER TABLE "Categoria" ADD COLUMN     "usoAgricola" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "usoNutricional" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "usoSanitario" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: texto livre → enum, convertendo os valores existentes
ALTER TABLE "DietaItem" ALTER COLUMN "unidade" TYPE "UnidadeMedida" USING (CASE lower(trim("unidade"))
    WHEN 'kg' THEN 'KG' WHEN 'g' THEN 'G' WHEN 't' THEN 'T'
    WHEN 'l' THEN 'L' WHEN 'ml' THEN 'ML'
    WHEN 'sc' THEN 'SC' WHEN 'saco' THEN 'SC' WHEN 'dose' THEN 'DOSE' WHEN 'cx' THEN 'CX'
    WHEN 'm' THEN 'M' WHEN 'ha' THEN 'HA'
    ELSE 'UN' END::"UnidadeMedida");

-- AlterTable
ALTER TABLE "MovimentoEstoque" ALTER COLUMN "quantidade" SET DATA TYPE DECIMAL(12,3),
ALTER COLUMN "custoUnitario" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "OperacaoAgricola" ALTER COLUMN "quantidadeTotal" SET DATA TYPE DECIMAL(12,3);

-- AlterTable
ALTER TABLE "Produto" DROP COLUMN "carencia",
DROP COLUMN "custoUnitario",
DROP COLUMN "percentualMS",
DROP COLUMN "subtipoPlantio",
DROP COLUMN "tipo";

-- AlterTable: texto livre → enum, convertendo os valores existentes
ALTER TABLE "Produto" ALTER COLUMN "unidade" DROP DEFAULT;
ALTER TABLE "Produto" ALTER COLUMN "unidade" TYPE "UnidadeMedida" USING (CASE lower(trim("unidade"))
    WHEN 'kg' THEN 'KG' WHEN 'g' THEN 'G' WHEN 't' THEN 'T'
    WHEN 'l' THEN 'L' WHEN 'ml' THEN 'ML'
    WHEN 'sc' THEN 'SC' WHEN 'saco' THEN 'SC' WHEN 'dose' THEN 'DOSE' WHEN 'cx' THEN 'CX'
    WHEN 'm' THEN 'M' WHEN 'ha' THEN 'HA'
    ELSE 'UN' END::"UnidadeMedida");
ALTER TABLE "Produto" ALTER COLUMN "unidade" SET DEFAULT 'UN';

-- DropEnum
DROP TYPE "TipoInsumoPlantio";

-- DropEnum
DROP TYPE "TipoProduto";

