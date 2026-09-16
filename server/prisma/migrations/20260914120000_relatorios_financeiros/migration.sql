-- CreateEnum
CREATE TYPE "StatusRelatorioFinanceiro" AS ENUM ('PROCESSANDO', 'CONCLUIDO', 'FALHOU');

-- CreateTable
CREATE TABLE "RascunhoRelatorioFinanceiro" (
    "id" SERIAL NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "criadoPorId" INTEGER NOT NULL,
    "configuracao" JSONB NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RascunhoRelatorioFinanceiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelatorioFinanceiro" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "status" "StatusRelatorioFinanceiro" NOT NULL DEFAULT 'PROCESSANDO',
    "parametros" JSONB NOT NULL,
    "snapshot" JSONB,
    "storageKey" TEXT,
    "erro" TEXT,
    "propriedadeId" INTEGER NOT NULL,
    "autorId" INTEGER,
    "autorNome" TEXT NOT NULL,
    "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" TIMESTAMP(3),

    CONSTRAINT "RelatorioFinanceiro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RascunhoRelatorioFinanceiro_propriedadeId_criadoPorId_key" ON "RascunhoRelatorioFinanceiro"("propriedadeId", "criadoPorId");

-- CreateIndex
CREATE UNIQUE INDEX "RelatorioFinanceiro_storageKey_key" ON "RelatorioFinanceiro"("storageKey");

-- CreateIndex
CREATE INDEX "RelatorioFinanceiro_propriedadeId_geradoEm_idx" ON "RelatorioFinanceiro"("propriedadeId", "geradoEm");

-- AddForeignKey
ALTER TABLE "RascunhoRelatorioFinanceiro" ADD CONSTRAINT "RascunhoRelatorioFinanceiro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RascunhoRelatorioFinanceiro" ADD CONSTRAINT "RascunhoRelatorioFinanceiro_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatorioFinanceiro" ADD CONSTRAINT "RelatorioFinanceiro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatorioFinanceiro" ADD CONSTRAINT "RelatorioFinanceiro_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
