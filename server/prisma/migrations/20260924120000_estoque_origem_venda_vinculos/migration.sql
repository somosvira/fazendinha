-- Estoque: origem própria para a saída de venda e snapshot do vínculo operacional
-- (animal/talhão) no movimento. O backfill fica na migration seguinte porque o
-- Postgres não deixa usar um valor de enum na mesma transação em que ele é criado.

-- AlterEnum
ALTER TYPE "OrigemMovimentoEstoque" ADD VALUE 'VENDA';

-- AlterTable
ALTER TABLE "MovimentoEstoque" ADD COLUMN     "animalId" INTEGER,
ADD COLUMN     "talhaoId" INTEGER;

-- CreateIndex
CREATE INDEX "MovimentoEstoque_animalId_idx" ON "MovimentoEstoque"("animalId");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_talhaoId_idx" ON "MovimentoEstoque"("talhaoId");

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

