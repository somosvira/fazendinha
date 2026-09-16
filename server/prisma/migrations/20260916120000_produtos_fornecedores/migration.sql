-- CreateTable
CREATE TABLE "ProdutoFornecedor" (
    "produtoId" INTEGER NOT NULL,
    "fornecedorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProdutoFornecedor_pkey" PRIMARY KEY ("produtoId", "fornecedorId")
);

-- CreateIndex
CREATE INDEX "ProdutoFornecedor_fornecedorId_idx" ON "ProdutoFornecedor"("fornecedorId");

-- AddForeignKey
ALTER TABLE "ProdutoFornecedor" ADD CONSTRAINT "ProdutoFornecedor_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoFornecedor" ADD CONSTRAINT "ProdutoFornecedor_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Parceiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
