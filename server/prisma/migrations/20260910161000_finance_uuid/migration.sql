-- DropForeignKey
ALTER TABLE "Categoria" DROP CONSTRAINT "Categoria_grupoCategoriaId_fkey";

-- DropForeignKey
ALTER TABLE "Produto" DROP CONSTRAINT "Produto_categoriaId_fkey";

-- DropForeignKey
ALTER TABLE "Produto" DROP CONSTRAINT "Produto_centroCustoId_fkey";

-- DropForeignKey
ALTER TABLE "Operacao" DROP CONSTRAINT "Operacao_parceiroId_fkey";

-- DropForeignKey
ALTER TABLE "Operacao" DROP CONSTRAINT "Operacao_categoriaId_fkey";

-- DropForeignKey
ALTER TABLE "Operacao" DROP CONSTRAINT "Operacao_centroCustoId_fkey";

-- DropForeignKey
ALTER TABLE "Operacao" DROP CONSTRAINT "Operacao_corrigeOperacaoId_fkey";

-- DropForeignKey
ALTER TABLE "ItemOperacao" DROP CONSTRAINT "ItemOperacao_operacaoId_fkey";

-- DropForeignKey
ALTER TABLE "CompromissoFinanceiro" DROP CONSTRAINT "CompromissoFinanceiro_operacaoId_fkey";

-- DropForeignKey
ALTER TABLE "CompromissoFinanceiro" DROP CONSTRAINT "CompromissoFinanceiro_parceiroId_fkey";

-- DropForeignKey
ALTER TABLE "TransacaoFinanceira" DROP CONSTRAINT "TransacaoFinanceira_operacaoId_fkey";

-- DropForeignKey
ALTER TABLE "TransacaoFinanceira" DROP CONSTRAINT "TransacaoFinanceira_parceiroId_fkey";

-- DropForeignKey
ALTER TABLE "TransacaoFinanceira" DROP CONSTRAINT "TransacaoFinanceira_reversaoDeId_fkey";

-- DropForeignKey
ALTER TABLE "MovimentoConta" DROP CONSTRAINT "MovimentoConta_transacaoId_fkey";

-- DropForeignKey
ALTER TABLE "MovimentoConta" DROP CONSTRAINT "MovimentoConta_contaId_fkey";

-- DropForeignKey
ALTER TABLE "Liquidacao" DROP CONSTRAINT "Liquidacao_compromissoId_fkey";

-- DropForeignKey
ALTER TABLE "Liquidacao" DROP CONSTRAINT "Liquidacao_transacaoId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentoFinanceiro" DROP CONSTRAINT "DocumentoFinanceiro_operacaoId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentoFinanceiro" DROP CONSTRAINT "DocumentoFinanceiro_transacaoId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentoFinanceiro" DROP CONSTRAINT "DocumentoFinanceiro_compromissoId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentoFinanceiro" DROP CONSTRAINT "DocumentoFinanceiro_rascunhoId_fkey";

-- DropForeignKey
ALTER TABLE "MovimentoEstoque" DROP CONSTRAINT "MovimentoEstoque_operacaoId_fkey";

-- DropForeignKey
ALTER TABLE "MovimentoEstoque" DROP CONSTRAINT "MovimentoEstoque_itemOperacaoId_fkey";

-- DropForeignKey
ALTER TABLE "OperacaoAgricola" DROP CONSTRAINT "OperacaoAgricola_operacaoFinanceiraId_fkey";

-- DropForeignKey
ALTER TABLE "Safra" DROP CONSTRAINT "Safra_centroCustoId_fkey";

-- DropForeignKey
ALTER TABLE "ManejoSanitario" DROP CONSTRAINT "ManejoSanitario_operacaoFinanceiraId_fkey";

-- DropForeignKey
ALTER TABLE "OperacaoComercial" DROP CONSTRAINT "OperacaoComercial_operacaoFinanceiraId_fkey";

-- DropForeignKey
ALTER TABLE "LancamentoCusto" DROP CONSTRAINT "LancamentoCusto_operacaoFinanceiraId_fkey";

-- AlterTable
ALTER TABLE "CentroCusto" DROP CONSTRAINT "CentroCusto_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "CentroCusto_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "GrupoCategoria" DROP CONSTRAINT "GrupoCategoria_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "GrupoCategoria_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Categoria" DROP CONSTRAINT "Categoria_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "grupoCategoriaId",
ADD COLUMN     "grupoCategoriaId" UUID NOT NULL,
ADD CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ContaFinanceira" DROP CONSTRAINT "ContaFinanceira_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "ContaFinanceira_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Produto" DROP COLUMN "categoriaId",
ADD COLUMN     "categoriaId" UUID,
DROP COLUMN "centroCustoId",
ADD COLUMN     "centroCustoId" UUID;

-- AlterTable
ALTER TABLE "Parceiro" DROP CONSTRAINT "Parceiro_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "Parceiro_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "PeriodoFinanceiro" DROP CONSTRAINT "PeriodoFinanceiro_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "PeriodoFinanceiro_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Operacao" DROP CONSTRAINT "Operacao_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "parceiroId",
ADD COLUMN     "parceiroId" UUID,
DROP COLUMN "categoriaId",
ADD COLUMN     "categoriaId" UUID,
DROP COLUMN "centroCustoId",
ADD COLUMN     "centroCustoId" UUID,
DROP COLUMN "corrigeOperacaoId",
ADD COLUMN     "corrigeOperacaoId" UUID,
ADD CONSTRAINT "Operacao_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "RascunhoOperacao" DROP CONSTRAINT "RascunhoOperacao_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "RascunhoOperacao_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ItemOperacao" DROP CONSTRAINT "ItemOperacao_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "operacaoId",
ADD COLUMN     "operacaoId" UUID NOT NULL,
ADD CONSTRAINT "ItemOperacao_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "CompromissoFinanceiro" DROP CONSTRAINT "CompromissoFinanceiro_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "operacaoId",
ADD COLUMN     "operacaoId" UUID NOT NULL,
DROP COLUMN "parceiroId",
ADD COLUMN     "parceiroId" UUID,
ADD CONSTRAINT "CompromissoFinanceiro_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "TransacaoFinanceira" DROP CONSTRAINT "TransacaoFinanceira_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "operacaoId",
ADD COLUMN     "operacaoId" UUID,
DROP COLUMN "parceiroId",
ADD COLUMN     "parceiroId" UUID,
DROP COLUMN "reversaoDeId",
ADD COLUMN     "reversaoDeId" UUID,
ADD CONSTRAINT "TransacaoFinanceira_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "MovimentoConta" DROP CONSTRAINT "MovimentoConta_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "transacaoId",
ADD COLUMN     "transacaoId" UUID NOT NULL,
DROP COLUMN "contaId",
ADD COLUMN     "contaId" UUID NOT NULL,
ADD CONSTRAINT "MovimentoConta_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Liquidacao" DROP CONSTRAINT "Liquidacao_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "compromissoId",
ADD COLUMN     "compromissoId" UUID NOT NULL,
DROP COLUMN "transacaoId",
ADD COLUMN     "transacaoId" UUID NOT NULL,
ADD CONSTRAINT "Liquidacao_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "DocumentoFinanceiro" DROP CONSTRAINT "DocumentoFinanceiro_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "operacaoId",
ADD COLUMN     "operacaoId" UUID,
DROP COLUMN "transacaoId",
ADD COLUMN     "transacaoId" UUID,
DROP COLUMN "compromissoId",
ADD COLUMN     "compromissoId" UUID,
DROP COLUMN "rascunhoId",
ADD COLUMN     "rascunhoId" UUID,
ADD CONSTRAINT "DocumentoFinanceiro_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "AuditoriaFinanceira" DROP CONSTRAINT "AuditoriaFinanceira_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "AuditoriaFinanceira_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "MovimentoEstoque" DROP COLUMN "operacaoId",
ADD COLUMN     "operacaoId" UUID,
DROP COLUMN "itemOperacaoId",
ADD COLUMN     "itemOperacaoId" UUID;

-- AlterTable
ALTER TABLE "OperacaoAgricola" DROP COLUMN "operacaoFinanceiraId",
ADD COLUMN     "operacaoFinanceiraId" UUID;

-- AlterTable
ALTER TABLE "Safra" DROP COLUMN "centroCustoId",
ADD COLUMN     "centroCustoId" UUID;

-- AlterTable
ALTER TABLE "ManejoSanitario" DROP COLUMN "operacaoFinanceiraId",
ADD COLUMN     "operacaoFinanceiraId" UUID;

-- AlterTable
ALTER TABLE "OperacaoComercial" DROP COLUMN "operacaoFinanceiraId",
ADD COLUMN     "operacaoFinanceiraId" UUID;

-- AlterTable
ALTER TABLE "LancamentoCusto" DROP COLUMN "operacaoFinanceiraId",
ADD COLUMN     "operacaoFinanceiraId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_grupoCategoriaId_nome_key" ON "Categoria"("grupoCategoriaId", "nome");

-- CreateIndex
CREATE INDEX "Operacao_parceiroId_idx" ON "Operacao"("parceiroId");

-- CreateIndex
CREATE INDEX "Operacao_corrigeOperacaoId_idx" ON "Operacao"("corrigeOperacaoId");

-- CreateIndex
CREATE INDEX "ItemOperacao_operacaoId_idx" ON "ItemOperacao"("operacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemOperacao_operacaoId_ordem_key" ON "ItemOperacao"("operacaoId", "ordem");

-- CreateIndex
CREATE INDEX "CompromissoFinanceiro_operacaoId_idx" ON "CompromissoFinanceiro"("operacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "CompromissoFinanceiro_operacaoId_numeroParcela_key" ON "CompromissoFinanceiro"("operacaoId", "numeroParcela");

-- CreateIndex
CREATE UNIQUE INDEX "TransacaoFinanceira_reversaoDeId_key" ON "TransacaoFinanceira"("reversaoDeId");

-- CreateIndex
CREATE INDEX "TransacaoFinanceira_operacaoId_idx" ON "TransacaoFinanceira"("operacaoId");

-- CreateIndex
CREATE INDEX "MovimentoConta_contaId_createdAt_idx" ON "MovimentoConta"("contaId", "createdAt");

-- CreateIndex
CREATE INDEX "MovimentoConta_transacaoId_idx" ON "MovimentoConta"("transacaoId");

-- CreateIndex
CREATE INDEX "Liquidacao_transacaoId_idx" ON "Liquidacao"("transacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Liquidacao_compromissoId_transacaoId_key" ON "Liquidacao"("compromissoId", "transacaoId");

-- CreateIndex
CREATE INDEX "DocumentoFinanceiro_operacaoId_idx" ON "DocumentoFinanceiro"("operacaoId");

-- CreateIndex
CREATE INDEX "DocumentoFinanceiro_transacaoId_idx" ON "DocumentoFinanceiro"("transacaoId");

-- CreateIndex
CREATE INDEX "DocumentoFinanceiro_compromissoId_idx" ON "DocumentoFinanceiro"("compromissoId");

-- CreateIndex
CREATE INDEX "DocumentoFinanceiro_rascunhoId_idx" ON "DocumentoFinanceiro"("rascunhoId");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_operacaoId_idx" ON "MovimentoEstoque"("operacaoId");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_itemOperacaoId_idx" ON "MovimentoEstoque"("itemOperacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "OperacaoAgricola_operacaoFinanceiraId_key" ON "OperacaoAgricola"("operacaoFinanceiraId");

-- CreateIndex
CREATE UNIQUE INDEX "ManejoSanitario_operacaoFinanceiraId_key" ON "ManejoSanitario"("operacaoFinanceiraId");

-- CreateIndex
CREATE UNIQUE INDEX "OperacaoComercial_operacaoFinanceiraId_key" ON "OperacaoComercial"("operacaoFinanceiraId");

-- CreateIndex
CREATE UNIQUE INDEX "LancamentoCusto_operacaoFinanceiraId_key" ON "LancamentoCusto"("operacaoFinanceiraId");

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_grupoCategoriaId_fkey" FOREIGN KEY ("grupoCategoriaId") REFERENCES "GrupoCategoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operacao" ADD CONSTRAINT "Operacao_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES "Parceiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operacao" ADD CONSTRAINT "Operacao_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operacao" ADD CONSTRAINT "Operacao_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operacao" ADD CONSTRAINT "Operacao_corrigeOperacaoId_fkey" FOREIGN KEY ("corrigeOperacaoId") REFERENCES "Operacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOperacao" ADD CONSTRAINT "ItemOperacao_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES "Operacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompromissoFinanceiro" ADD CONSTRAINT "CompromissoFinanceiro_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES "Operacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompromissoFinanceiro" ADD CONSTRAINT "CompromissoFinanceiro_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES "Parceiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransacaoFinanceira" ADD CONSTRAINT "TransacaoFinanceira_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES "Operacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransacaoFinanceira" ADD CONSTRAINT "TransacaoFinanceira_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES "Parceiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransacaoFinanceira" ADD CONSTRAINT "TransacaoFinanceira_reversaoDeId_fkey" FOREIGN KEY ("reversaoDeId") REFERENCES "TransacaoFinanceira"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoConta" ADD CONSTRAINT "MovimentoConta_transacaoId_fkey" FOREIGN KEY ("transacaoId") REFERENCES "TransacaoFinanceira"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoConta" ADD CONSTRAINT "MovimentoConta_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "ContaFinanceira"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liquidacao" ADD CONSTRAINT "Liquidacao_compromissoId_fkey" FOREIGN KEY ("compromissoId") REFERENCES "CompromissoFinanceiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liquidacao" ADD CONSTRAINT "Liquidacao_transacaoId_fkey" FOREIGN KEY ("transacaoId") REFERENCES "TransacaoFinanceira"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoFinanceiro" ADD CONSTRAINT "DocumentoFinanceiro_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES "Operacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoFinanceiro" ADD CONSTRAINT "DocumentoFinanceiro_transacaoId_fkey" FOREIGN KEY ("transacaoId") REFERENCES "TransacaoFinanceira"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoFinanceiro" ADD CONSTRAINT "DocumentoFinanceiro_compromissoId_fkey" FOREIGN KEY ("compromissoId") REFERENCES "CompromissoFinanceiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoFinanceiro" ADD CONSTRAINT "DocumentoFinanceiro_rascunhoId_fkey" FOREIGN KEY ("rascunhoId") REFERENCES "RascunhoOperacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES "Operacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_itemOperacaoId_fkey" FOREIGN KEY ("itemOperacaoId") REFERENCES "ItemOperacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacaoAgricola" ADD CONSTRAINT "OperacaoAgricola_operacaoFinanceiraId_fkey" FOREIGN KEY ("operacaoFinanceiraId") REFERENCES "Operacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Safra" ADD CONSTRAINT "Safra_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManejoSanitario" ADD CONSTRAINT "ManejoSanitario_operacaoFinanceiraId_fkey" FOREIGN KEY ("operacaoFinanceiraId") REFERENCES "Operacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacaoComercial" ADD CONSTRAINT "OperacaoComercial_operacaoFinanceiraId_fkey" FOREIGN KEY ("operacaoFinanceiraId") REFERENCES "Operacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LancamentoCusto" ADD CONSTRAINT "LancamentoCusto_operacaoFinanceiraId_fkey" FOREIGN KEY ("operacaoFinanceiraId") REFERENCES "Operacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
