-- CreateTable
CREATE TABLE "FechamentoMensal" (
    "id" SERIAL NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "fechadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacao" TEXT,

    CONSTRAINT "FechamentoMensal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FechamentoMensal_ano_mes_key" ON "FechamentoMensal"("ano", "mes");
