-- DropForeignKey
ALTER TABLE "CompromissoFinanceiro" DROP CONSTRAINT "CompromissoFinanceiro_operacaoId_fkey";

-- DropForeignKey
ALTER TABLE "CompromissoFinanceiro" DROP CONSTRAINT "CompromissoFinanceiro_parceiroId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentoFinanceiro" DROP CONSTRAINT "DocumentoFinanceiro_compromissoId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentoFinanceiro" DROP CONSTRAINT "DocumentoFinanceiro_operacaoId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentoFinanceiro" DROP CONSTRAINT "DocumentoFinanceiro_rascunhoId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentoFinanceiro" DROP CONSTRAINT "DocumentoFinanceiro_transacaoId_fkey";

-- DropForeignKey
ALTER TABLE "ItemOperacao" DROP CONSTRAINT "ItemOperacao_categoriaId_fkey";

-- DropForeignKey
ALTER TABLE "ItemOperacao" DROP CONSTRAINT "ItemOperacao_centroCustoId_fkey";

-- DropForeignKey
ALTER TABLE "ItemOperacao" DROP CONSTRAINT "ItemOperacao_operacaoId_fkey";

-- DropForeignKey
ALTER TABLE "ItemOperacao" DROP CONSTRAINT "ItemOperacao_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "LancamentoCusto" DROP CONSTRAINT "LancamentoCusto_operacaoFinanceiraId_fkey";

-- DropForeignKey
ALTER TABLE "Liquidacao" DROP CONSTRAINT "Liquidacao_compromissoId_fkey";

-- DropForeignKey
ALTER TABLE "Liquidacao" DROP CONSTRAINT "Liquidacao_transacaoId_fkey";

-- DropForeignKey
ALTER TABLE "MovimentoConta" DROP CONSTRAINT "MovimentoConta_contaId_fkey";

-- DropForeignKey
ALTER TABLE "MovimentoConta" DROP CONSTRAINT "MovimentoConta_transacaoId_fkey";

-- DropForeignKey
ALTER TABLE "MovimentoEstoque" DROP CONSTRAINT "MovimentoEstoque_centroCustoId_fkey";

-- DropForeignKey
ALTER TABLE "MovimentoEstoque" DROP CONSTRAINT "MovimentoEstoque_itemOperacaoId_fkey";

-- DropForeignKey
ALTER TABLE "MovimentoEstoque" DROP CONSTRAINT "MovimentoEstoque_operacaoId_fkey";

-- DropForeignKey
ALTER TABLE "MovimentoEstoque" DROP CONSTRAINT "MovimentoEstoque_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "MovimentoEstoque" DROP CONSTRAINT "MovimentoEstoque_reversaoDeId_fkey";

-- DropForeignKey
ALTER TABLE "Operacao" DROP CONSTRAINT "Operacao_categoriaId_fkey";

-- DropForeignKey
ALTER TABLE "Operacao" DROP CONSTRAINT "Operacao_centroCustoId_fkey";

-- DropForeignKey
ALTER TABLE "Operacao" DROP CONSTRAINT "Operacao_corrigeOperacaoId_fkey";

-- DropForeignKey
ALTER TABLE "Operacao" DROP CONSTRAINT "Operacao_parceiroId_fkey";

-- DropForeignKey
ALTER TABLE "OperacaoAgricola" DROP CONSTRAINT "OperacaoAgricola_movimentoEstoqueId_fkey";

-- DropForeignKey
ALTER TABLE "OperacaoAgricola" DROP CONSTRAINT "OperacaoAgricola_operacaoFinanceiraId_fkey";

-- DropForeignKey
ALTER TABLE "OperacaoAgricola" DROP CONSTRAINT "OperacaoAgricola_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "ParceiroPapel" DROP CONSTRAINT "ParceiroPapel_parceiroId_fkey";

-- DropForeignKey
ALTER TABLE "Produto" DROP CONSTRAINT "Produto_categoriaId_fkey";

-- DropForeignKey
ALTER TABLE "ProdutoCentroCusto" DROP CONSTRAINT "ProdutoCentroCusto_centroCustoId_fkey";

-- DropForeignKey
ALTER TABLE "ProdutoCentroCusto" DROP CONSTRAINT "ProdutoCentroCusto_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "ProdutoFornecedor" DROP CONSTRAINT "ProdutoFornecedor_fornecedorId_fkey";

-- DropForeignKey
ALTER TABLE "ProdutoFornecedor" DROP CONSTRAINT "ProdutoFornecedor_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "Safra" DROP CONSTRAINT "Safra_centroCustoId_fkey";

-- DropForeignKey
ALTER TABLE "TransacaoFinanceira" DROP CONSTRAINT "TransacaoFinanceira_operacaoId_fkey";

-- DropForeignKey
ALTER TABLE "TransacaoFinanceira" DROP CONSTRAINT "TransacaoFinanceira_parceiroId_fkey";

-- DropForeignKey
ALTER TABLE "TransacaoFinanceira" DROP CONSTRAINT "TransacaoFinanceira_reversaoDeId_fkey";

-- AlterTable
ALTER TABLE "AuditoriaFinanceira" DROP CONSTRAINT "AuditoriaFinanceira_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "AuditoriaFinanceira_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "AuditoriaFinanceira_id_seq";

-- AlterTable
ALTER TABLE "Categoria" DROP CONSTRAINT "Categoria_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Categoria_id_seq";

-- AlterTable
ALTER TABLE "CentroCusto" DROP CONSTRAINT "CentroCusto_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "CentroCusto_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "CentroCusto_id_seq";

-- AlterTable
ALTER TABLE "CompromissoFinanceiro" DROP CONSTRAINT "CompromissoFinanceiro_pkey",
ADD COLUMN     "seq" SERIAL NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "operacaoId" SET DATA TYPE TEXT,
ALTER COLUMN "parceiroId" SET DATA TYPE TEXT,
ADD CONSTRAINT "CompromissoFinanceiro_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "CompromissoFinanceiro_id_seq";

-- AlterTable
ALTER TABLE "ContaFinanceira" DROP CONSTRAINT "ContaFinanceira_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "ContaFinanceira_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "ContaFinanceira_id_seq";

-- AlterTable
ALTER TABLE "DocumentoFinanceiro" DROP CONSTRAINT "DocumentoFinanceiro_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "operacaoId" SET DATA TYPE TEXT,
ALTER COLUMN "transacaoId" SET DATA TYPE TEXT,
ALTER COLUMN "compromissoId" SET DATA TYPE TEXT,
ALTER COLUMN "rascunhoId" SET DATA TYPE TEXT,
ADD CONSTRAINT "DocumentoFinanceiro_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "DocumentoFinanceiro_id_seq";

-- AlterTable
ALTER TABLE "ItemOperacao" DROP CONSTRAINT "ItemOperacao_pkey",
ADD COLUMN     "ordem" INTEGER NOT NULL,
ALTER COLUMN "categoriaId" SET DATA TYPE TEXT,
ALTER COLUMN "centroCustoId" SET DATA TYPE TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "operacaoId" SET DATA TYPE TEXT,
ALTER COLUMN "produtoId" SET DATA TYPE TEXT,
ADD CONSTRAINT "ItemOperacao_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "ItemOperacao_id_seq";

-- AlterTable
ALTER TABLE "LancamentoCusto" ALTER COLUMN "operacaoFinanceiraId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Liquidacao" DROP CONSTRAINT "Liquidacao_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "compromissoId" SET DATA TYPE TEXT,
ALTER COLUMN "transacaoId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Liquidacao_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Liquidacao_id_seq";

-- AlterTable
ALTER TABLE "MovimentoConta" DROP CONSTRAINT "MovimentoConta_pkey",
ADD COLUMN     "seq" SERIAL NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "transacaoId" SET DATA TYPE TEXT,
ALTER COLUMN "contaId" SET DATA TYPE TEXT,
ADD CONSTRAINT "MovimentoConta_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "MovimentoConta_id_seq";

-- AlterTable
ALTER TABLE "MovimentoEstoque" DROP CONSTRAINT "MovimentoEstoque_pkey",
ADD COLUMN     "seq" SERIAL NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "produtoId" SET DATA TYPE TEXT,
ALTER COLUMN "operacaoId" SET DATA TYPE TEXT,
ALTER COLUMN "itemOperacaoId" SET DATA TYPE TEXT,
ALTER COLUMN "centroCustoId" SET DATA TYPE TEXT,
ALTER COLUMN "reversaoDeId" SET DATA TYPE TEXT,
ADD CONSTRAINT "MovimentoEstoque_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "MovimentoEstoque_id_seq";

-- AlterTable
ALTER TABLE "Operacao" DROP CONSTRAINT "Operacao_pkey",
ADD COLUMN     "numero" SERIAL NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "parceiroId" SET DATA TYPE TEXT,
ALTER COLUMN "categoriaId" SET DATA TYPE TEXT,
ALTER COLUMN "centroCustoId" SET DATA TYPE TEXT,
ALTER COLUMN "corrigeOperacaoId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Operacao_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Operacao_id_seq";

-- AlterTable
ALTER TABLE "OperacaoAgricola" ALTER COLUMN "produtoId" SET DATA TYPE TEXT,
ALTER COLUMN "movimentoEstoqueId" SET DATA TYPE TEXT,
ALTER COLUMN "operacaoFinanceiraId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Parceiro" DROP CONSTRAINT "Parceiro_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Parceiro_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Parceiro_id_seq";

-- AlterTable
ALTER TABLE "ParceiroPapel" DROP CONSTRAINT "ParceiroPapel_pkey",
ALTER COLUMN "parceiroId" SET DATA TYPE TEXT,
ADD CONSTRAINT "ParceiroPapel_pkey" PRIMARY KEY ("parceiroId", "papel");

-- AlterTable
ALTER TABLE "PeriodoFinanceiro" DROP CONSTRAINT "PeriodoFinanceiro_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "PeriodoFinanceiro_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "PeriodoFinanceiro_id_seq";

-- AlterTable
ALTER TABLE "Produto" DROP CONSTRAINT "Produto_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "categoriaId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Produto_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Produto_id_seq";

-- AlterTable
ALTER TABLE "ProdutoCentroCusto" DROP CONSTRAINT "ProdutoCentroCusto_pkey",
ALTER COLUMN "produtoId" SET DATA TYPE TEXT,
ALTER COLUMN "centroCustoId" SET DATA TYPE TEXT,
ADD CONSTRAINT "ProdutoCentroCusto_pkey" PRIMARY KEY ("produtoId", "centroCustoId");

-- AlterTable
ALTER TABLE "ProdutoFornecedor" DROP CONSTRAINT "ProdutoFornecedor_pkey",
ALTER COLUMN "produtoId" SET DATA TYPE TEXT,
ALTER COLUMN "fornecedorId" SET DATA TYPE TEXT,
ADD CONSTRAINT "ProdutoFornecedor_pkey" PRIMARY KEY ("produtoId", "fornecedorId");

-- AlterTable
ALTER TABLE "RascunhoOperacao" DROP CONSTRAINT "RascunhoOperacao_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "RascunhoOperacao_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "RascunhoOperacao_id_seq";

-- AlterTable
ALTER TABLE "RascunhoRelatorioFinanceiro" DROP CONSTRAINT "RascunhoRelatorioFinanceiro_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "RascunhoRelatorioFinanceiro_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "RascunhoRelatorioFinanceiro_id_seq";

-- AlterTable
ALTER TABLE "RelatorioFinanceiro" DROP CONSTRAINT "RelatorioFinanceiro_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "RelatorioFinanceiro_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "RelatorioFinanceiro_id_seq";

-- AlterTable
ALTER TABLE "Safra" ALTER COLUMN "centroCustoId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "TransacaoFinanceira" DROP CONSTRAINT "TransacaoFinanceira_pkey",
ADD COLUMN     "seq" SERIAL NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "operacaoId" SET DATA TYPE TEXT,
ALTER COLUMN "parceiroId" SET DATA TYPE TEXT,
ALTER COLUMN "reversaoDeId" SET DATA TYPE TEXT,
ADD CONSTRAINT "TransacaoFinanceira_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "TransacaoFinanceira_id_seq";

-- CreateIndex
CREATE UNIQUE INDEX "CompromissoFinanceiro_seq_key" ON "CompromissoFinanceiro"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "ItemOperacao_operacaoId_ordem_key" ON "ItemOperacao"("operacaoId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "MovimentoConta_seq_key" ON "MovimentoConta"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "MovimentoEstoque_seq_key" ON "MovimentoEstoque"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "Operacao_numero_key" ON "Operacao"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "TransacaoFinanceira_seq_key" ON "TransacaoFinanceira"("seq");

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoFornecedor" ADD CONSTRAINT "ProdutoFornecedor_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoFornecedor" ADD CONSTRAINT "ProdutoFornecedor_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Parceiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoCentroCusto" ADD CONSTRAINT "ProdutoCentroCusto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoCentroCusto" ADD CONSTRAINT "ProdutoCentroCusto_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParceiroPapel" ADD CONSTRAINT "ParceiroPapel_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES "Parceiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operacao" ADD CONSTRAINT "Operacao_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES "Parceiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operacao" ADD CONSTRAINT "Operacao_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operacao" ADD CONSTRAINT "Operacao_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operacao" ADD CONSTRAINT "Operacao_corrigeOperacaoId_fkey" FOREIGN KEY ("corrigeOperacaoId") REFERENCES "Operacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOperacao" ADD CONSTRAINT "ItemOperacao_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOperacao" ADD CONSTRAINT "ItemOperacao_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOperacao" ADD CONSTRAINT "ItemOperacao_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES "Operacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOperacao" ADD CONSTRAINT "ItemOperacao_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES "Operacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_itemOperacaoId_fkey" FOREIGN KEY ("itemOperacaoId") REFERENCES "ItemOperacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_reversaoDeId_fkey" FOREIGN KEY ("reversaoDeId") REFERENCES "MovimentoEstoque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacaoAgricola" ADD CONSTRAINT "OperacaoAgricola_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacaoAgricola" ADD CONSTRAINT "OperacaoAgricola_movimentoEstoqueId_fkey" FOREIGN KEY ("movimentoEstoqueId") REFERENCES "MovimentoEstoque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacaoAgricola" ADD CONSTRAINT "OperacaoAgricola_operacaoFinanceiraId_fkey" FOREIGN KEY ("operacaoFinanceiraId") REFERENCES "Operacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Safra" ADD CONSTRAINT "Safra_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LancamentoCusto" ADD CONSTRAINT "LancamentoCusto_operacaoFinanceiraId_fkey" FOREIGN KEY ("operacaoFinanceiraId") REFERENCES "Operacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

