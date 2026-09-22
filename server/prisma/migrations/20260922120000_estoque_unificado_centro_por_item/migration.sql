-- AlterEnum
ALTER TYPE "OrigemMovimentoEstoque" ADD VALUE 'APLICACAO';

-- DropForeignKey
ALTER TABLE "Produto" DROP CONSTRAINT "Produto_centroCustoId_fkey";

-- AlterTable
ALTER TABLE "Grupo" ADD COLUMN     "centroCustoId" INTEGER;

-- AlterTable
ALTER TABLE "ItemOperacao" ADD COLUMN     "centroCustoId" INTEGER,
ADD COLUMN     "centroCustoNome" TEXT;

-- AlterTable
ALTER TABLE "MovimentoEstoque" ADD COLUMN     "centroCustoId" INTEGER;

-- AlterTable
ALTER TABLE "OperacaoAgricola" ADD COLUMN     "movimentoEstoqueId" INTEGER,
ADD COLUMN     "produtoId" INTEGER,
ADD COLUMN     "quantidadeTotal" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Produto" DROP COLUMN "centroCustoId",
DROP COLUMN "setor";

-- DropEnum
DROP TYPE "SetorEstoque";

-- CreateTable
CREATE TABLE "ProdutoCentroCusto" (
    "produtoId" INTEGER NOT NULL,
    "centroCustoId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProdutoCentroCusto_pkey" PRIMARY KEY ("produtoId","centroCustoId")
);

-- CreateIndex
CREATE INDEX "ProdutoCentroCusto_centroCustoId_idx" ON "ProdutoCentroCusto"("centroCustoId");

-- CreateIndex
CREATE INDEX "ItemOperacao_centroCustoId_idx" ON "ItemOperacao"("centroCustoId");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_centroCustoId_idx" ON "MovimentoEstoque"("centroCustoId");

-- CreateIndex
CREATE UNIQUE INDEX "OperacaoAgricola_movimentoEstoqueId_key" ON "OperacaoAgricola"("movimentoEstoqueId");

-- CreateIndex
CREATE INDEX "OperacaoAgricola_produtoId_idx" ON "OperacaoAgricola"("produtoId");

-- AddForeignKey
ALTER TABLE "ProdutoCentroCusto" ADD CONSTRAINT "ProdutoCentroCusto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoCentroCusto" ADD CONSTRAINT "ProdutoCentroCusto_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOperacao" ADD CONSTRAINT "ItemOperacao_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacaoAgricola" ADD CONSTRAINT "OperacaoAgricola_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacaoAgricola" ADD CONSTRAINT "OperacaoAgricola_movimentoEstoqueId_fkey" FOREIGN KEY ("movimentoEstoqueId") REFERENCES "MovimentoEstoque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

