-- DropForeignKey
ALTER TABLE "ComposicaoProdutoItem" DROP CONSTRAINT "ComposicaoProdutoItem_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "ComposicaoProdutoItem" DROP CONSTRAINT "ComposicaoProdutoItem_ingredienteId_fkey";

-- DropForeignKey
ALTER TABLE "LoteProduto" DROP CONSTRAINT "LoteProduto_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "LoteProduto" DROP CONSTRAINT "LoteProduto_localId_fkey";

-- DropForeignKey
ALTER TABLE "ProdutoPrincipioAtivo" DROP CONSTRAINT "ProdutoPrincipioAtivo_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "ItemOperacao" DROP CONSTRAINT "ItemOperacao_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "DietaItem" DROP CONSTRAINT "DietaItem_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "EventoSanitario" DROP CONSTRAINT "EventoSanitario_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "EventoSanitario" DROP CONSTRAINT "EventoSanitario_movimentoEstoqueId_fkey";

-- DropForeignKey
ALTER TABLE "MovimentoEstoque" DROP CONSTRAINT "MovimentoEstoque_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "MovimentoEstoque" DROP CONSTRAINT "MovimentoEstoque_reversaoDeId_fkey";

-- DropForeignKey
ALTER TABLE "MovimentoEstoque" DROP CONSTRAINT "MovimentoEstoque_consumoPeriodoId_fkey";

-- AlterTable
ALTER TABLE "Produto" DROP CONSTRAINT "Produto_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "Produto_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ComposicaoProdutoItem" DROP CONSTRAINT "ComposicaoProdutoItem_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "produtoId",
ADD COLUMN     "produtoId" UUID NOT NULL,
DROP COLUMN "ingredienteId",
ADD COLUMN     "ingredienteId" UUID NOT NULL,
ADD CONSTRAINT "ComposicaoProdutoItem_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "LocalArmazenamento" DROP CONSTRAINT "LocalArmazenamento_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "LocalArmazenamento_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "LoteProduto" DROP CONSTRAINT "LoteProduto_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "produtoId",
ADD COLUMN     "produtoId" UUID NOT NULL,
DROP COLUMN "localId",
ADD COLUMN     "localId" UUID,
ADD CONSTRAINT "LoteProduto_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ProdutoPrincipioAtivo" DROP CONSTRAINT "ProdutoPrincipioAtivo_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "produtoId",
ADD COLUMN     "produtoId" UUID NOT NULL,
ADD CONSTRAINT "ProdutoPrincipioAtivo_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ItemOperacao" DROP COLUMN "produtoId",
ADD COLUMN     "produtoId" UUID;

-- AlterTable
ALTER TABLE "DietaItem" DROP COLUMN "produtoId",
ADD COLUMN     "produtoId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "EventoSanitario" DROP COLUMN "produtoId",
ADD COLUMN     "produtoId" UUID,
DROP COLUMN "movimentoEstoqueId",
ADD COLUMN     "movimentoEstoqueId" UUID;

-- AlterTable
ALTER TABLE "MovimentoEstoque" DROP CONSTRAINT "MovimentoEstoque_pkey",
ADD COLUMN     "ordem" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "produtoId",
ADD COLUMN     "produtoId" UUID NOT NULL,
DROP COLUMN "reversaoDeId",
ADD COLUMN     "reversaoDeId" UUID,
DROP COLUMN "consumoPeriodoId",
ADD COLUMN     "consumoPeriodoId" UUID,
ADD CONSTRAINT "MovimentoEstoque_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ConsumoPeriodo" DROP CONSTRAINT "ConsumoPeriodo_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "ConsumoPeriodo_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "ComposicaoProdutoItem_produtoId_idx" ON "ComposicaoProdutoItem"("produtoId");

-- CreateIndex
CREATE INDEX "ComposicaoProdutoItem_ingredienteId_idx" ON "ComposicaoProdutoItem"("ingredienteId");

-- CreateIndex
CREATE UNIQUE INDEX "ComposicaoProdutoItem_produtoId_ingredienteId_key" ON "ComposicaoProdutoItem"("produtoId", "ingredienteId");

-- CreateIndex
CREATE INDEX "LoteProduto_produtoId_idx" ON "LoteProduto"("produtoId");

-- CreateIndex
CREATE INDEX "LoteProduto_localId_idx" ON "LoteProduto"("localId");

-- CreateIndex
CREATE INDEX "ProdutoPrincipioAtivo_produtoId_idx" ON "ProdutoPrincipioAtivo"("produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "ProdutoPrincipioAtivo_produtoId_principioAtivoId_key" ON "ProdutoPrincipioAtivo"("produtoId", "principioAtivoId");

-- CreateIndex
CREATE INDEX "ItemOperacao_produtoId_idx" ON "ItemOperacao"("produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "DietaItem_dietaId_produtoId_key" ON "DietaItem"("dietaId", "produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "EventoSanitario_movimentoEstoqueId_key" ON "EventoSanitario"("movimentoEstoqueId");

-- CreateIndex
CREATE INDEX "EventoSanitario_produtoId_idx" ON "EventoSanitario"("produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "MovimentoEstoque_reversaoDeId_key" ON "MovimentoEstoque"("reversaoDeId");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_produtoId_data_idx" ON "MovimentoEstoque"("produtoId", "data");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_consumoPeriodoId_idx" ON "MovimentoEstoque"("consumoPeriodoId");

-- AddForeignKey
ALTER TABLE "ComposicaoProdutoItem" ADD CONSTRAINT "ComposicaoProdutoItem_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComposicaoProdutoItem" ADD CONSTRAINT "ComposicaoProdutoItem_ingredienteId_fkey" FOREIGN KEY ("ingredienteId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoteProduto" ADD CONSTRAINT "LoteProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoteProduto" ADD CONSTRAINT "LoteProduto_localId_fkey" FOREIGN KEY ("localId") REFERENCES "LocalArmazenamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoPrincipioAtivo" ADD CONSTRAINT "ProdutoPrincipioAtivo_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOperacao" ADD CONSTRAINT "ItemOperacao_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietaItem" ADD CONSTRAINT "DietaItem_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoSanitario" ADD CONSTRAINT "EventoSanitario_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoSanitario" ADD CONSTRAINT "EventoSanitario_movimentoEstoqueId_fkey" FOREIGN KEY ("movimentoEstoqueId") REFERENCES "MovimentoEstoque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_reversaoDeId_fkey" FOREIGN KEY ("reversaoDeId") REFERENCES "MovimentoEstoque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_consumoPeriodoId_fkey" FOREIGN KEY ("consumoPeriodoId") REFERENCES "ConsumoPeriodo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
