-- AlterEnum
ALTER TYPE "OrigemMovimentoEstoque" ADD VALUE 'SANIDADE';

-- AlterTable
ALTER TABLE "EventoSanitario" ADD COLUMN "produtoId" INTEGER,
ADD COLUMN "quantidadeUsada" DECIMAL(12,2),
ADD COLUMN "movimentoEstoqueId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "EventoSanitario_movimentoEstoqueId_key" ON "EventoSanitario"("movimentoEstoqueId");

-- CreateIndex
CREATE INDEX "EventoSanitario_produtoId_idx" ON "EventoSanitario"("produtoId");

-- AddForeignKey
ALTER TABLE "EventoSanitario" ADD CONSTRAINT "EventoSanitario_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoSanitario" ADD CONSTRAINT "EventoSanitario_movimentoEstoqueId_fkey" FOREIGN KEY ("movimentoEstoqueId") REFERENCES "MovimentoEstoque"("id") ON DELETE SET NULL ON UPDATE CASCADE;
