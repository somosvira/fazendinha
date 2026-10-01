-- CreateEnum
CREATE TYPE "StatusImportacaoFinanceira" AS ENUM ('PROCESSANDO', 'CONCLUIDA', 'FALHOU');

-- CreateEnum
CREATE TYPE "StatusLinhaImportacaoFinanceira" AS ENUM ('PRONTA', 'IMPORTADA', 'AGRUPADA', 'IGNORADA', 'REVISAO', 'REJEITADA');

-- CreateTable
CREATE TABLE "ImportacaoFinanceira" (
    "id" TEXT NOT NULL,
    "arquivo" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "fonte" TEXT NOT NULL,
    "versaoFormato" INTEGER NOT NULL,
    "versaoMatriz" INTEGER NOT NULL,
    "status" "StatusImportacaoFinanceira" NOT NULL DEFAULT 'PROCESSANDO',
    "opcoes" JSONB NOT NULL,
    "resumo" JSONB,
    "erro" TEXT,
    "propriedadeId" INTEGER NOT NULL,
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" TIMESTAMP(3),

    CONSTRAINT "ImportacaoFinanceira_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinhaImportacaoFinanceira" (
    "id" TEXT NOT NULL,
    "importacaoId" TEXT NOT NULL,
    "indiceCache" INTEGER NOT NULL,
    "hashLinha" TEXT NOT NULL,
    "status" "StatusLinhaImportacaoFinanceira" NOT NULL,
    "rota" TEXT,
    "chaveEvento" TEXT,
    "motivo" TEXT,
    "origem" JSONB NOT NULL,
    "destino" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinhaImportacaoFinanceira_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportacaoFinanceira_sha256_key" ON "ImportacaoFinanceira"("sha256");

-- CreateIndex
CREATE INDEX "ImportacaoFinanceira_propriedadeId_iniciadoEm_idx" ON "ImportacaoFinanceira"("propriedadeId", "iniciadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "LinhaImportacaoFinanceira_importacaoId_indiceCache_key" ON "LinhaImportacaoFinanceira"("importacaoId", "indiceCache");

-- CreateIndex
CREATE INDEX "LinhaImportacaoFinanceira_importacaoId_status_idx" ON "LinhaImportacaoFinanceira"("importacaoId", "status");

-- CreateIndex
CREATE INDEX "LinhaImportacaoFinanceira_chaveEvento_idx" ON "LinhaImportacaoFinanceira"("chaveEvento");

-- AddForeignKey
ALTER TABLE "ImportacaoFinanceira" ADD CONSTRAINT "ImportacaoFinanceira_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinhaImportacaoFinanceira" ADD CONSTRAINT "LinhaImportacaoFinanceira_importacaoId_fkey" FOREIGN KEY ("importacaoId") REFERENCES "ImportacaoFinanceira"("id") ON DELETE CASCADE ON UPDATE CASCADE;
