-- AlterTable
ALTER TABLE "Operacao" ADD COLUMN     "numero" SERIAL NOT NULL,
ADD COLUMN     "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ItemOperacao" ADD COLUMN     "ordem" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CompromissoFinanceiro" ALTER COLUMN "numeroParcela" SET NOT NULL,
ALTER COLUMN "numeroParcela" SET DEFAULT 1,
ALTER COLUMN "totalParcelas" SET NOT NULL,
ALTER COLUMN "totalParcelas" SET DEFAULT 1;

-- AlterTable
ALTER TABLE "TransacaoFinanceira" ADD COLUMN     "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "MovimentoConta" ADD COLUMN     "ordem" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Operacao_numero_key" ON "Operacao"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "ItemOperacao_operacaoId_ordem_key" ON "ItemOperacao"("operacaoId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "CompromissoFinanceiro_operacaoId_numeroParcela_key" ON "CompromissoFinanceiro"("operacaoId", "numeroParcela");
