-- Composição da dieta: quanto de cada produto por cabeça/dia.
-- Alimenta o motor de consumo (dieta × cabeças × dias → baixa de estoque, Fatia 2).
-- Aditivo: cria uma tabela nova; nenhuma linha existente é afetada.

CREATE TABLE "DietaItem" (
    "id" SERIAL NOT NULL,
    "dietaId" INTEGER NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "qtdPorCabecaDia" DECIMAL(12,4) NOT NULL,
    "unidade" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DietaItem_pkey" PRIMARY KEY ("id")
);

-- Idempotência da composição: um produto só entra uma vez por dieta.
CREATE UNIQUE INDEX "DietaItem_dietaId_produtoId_key" ON "DietaItem"("dietaId", "produtoId");
CREATE INDEX "DietaItem_dietaId_idx" ON "DietaItem"("dietaId");

ALTER TABLE "DietaItem" ADD CONSTRAINT "DietaItem_dietaId_fkey"
    FOREIGN KEY ("dietaId") REFERENCES "Dieta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DietaItem" ADD CONSTRAINT "DietaItem_produtoId_fkey"
    FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
