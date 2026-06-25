-- CreateEnum
CREATE TYPE "StatusUploadPendente" AS ENUM ('AGUARDANDO', 'CONFIRMADO', 'CANCELADO', 'EXPIRADO');

-- CreateTable
CREATE TABLE "NotaFiscalUploadPendente" (
    "id" SERIAL NOT NULL,
    "storageDriver" TEXT NOT NULL,
    "bucket" TEXT,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "ocrTexto" TEXT,
    "status" "StatusUploadPendente" NOT NULL DEFAULT 'AGUARDANDO',
    "lancamentoId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "decididoEm" TIMESTAMP(3),

    CONSTRAINT "NotaFiscalUploadPendente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscalUploadPendente_storageKey_key" ON "NotaFiscalUploadPendente"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscalUploadPendente_sha256_key" ON "NotaFiscalUploadPendente"("sha256");

-- CreateIndex
CREATE INDEX "NotaFiscalUploadPendente_status_expiraEm_idx" ON "NotaFiscalUploadPendente"("status", "expiraEm");

-- AddForeignKey
ALTER TABLE "NotaFiscalUploadPendente" ADD CONSTRAINT "NotaFiscalUploadPendente_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "Lancamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
