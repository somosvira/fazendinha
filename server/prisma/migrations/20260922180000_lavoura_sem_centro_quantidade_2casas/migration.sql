-- DropForeignKey
ALTER TABLE "Lavoura" DROP CONSTRAINT "Lavoura_centroCustoId_fkey";

-- AlterTable
ALTER TABLE "Lavoura" DROP COLUMN "centroCustoId";

-- AlterTable
ALTER TABLE "OperacaoAgricola" ALTER COLUMN "quantidadeTotal" SET DATA TYPE DECIMAL(12,2);

