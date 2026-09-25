-- Estoque: origem própria para a saída de venda e snapshot do talhão da aplicação
-- no movimento. O backfill fica na migration seguinte porque o Postgres não deixa
-- usar um valor de enum na mesma transação em que ele é criado.

-- AlterEnum
ALTER TYPE "OrigemMovimentoEstoque" ADD VALUE 'VENDA';

-- AlterTable
ALTER TABLE "MovimentoEstoque" ADD COLUMN     "talhaoId" INTEGER;

-- CreateIndex
CREATE INDEX "MovimentoEstoque_talhaoId_idx" ON "MovimentoEstoque"("talhaoId");

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

