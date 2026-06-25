-- CreateEnum
CREATE TYPE "StatusConfirmacaoWA" AS ENUM ('AGUARDANDO', 'CONFIRMADA', 'CANCELADA', 'EXPIRADA', 'ERRO_EXTRACAO');

-- CreateTable
CREATE TABLE "WhatsAppConfirmacaoPendente" (
    "id" SERIAL NOT NULL,
    "telefone" TEXT NOT NULL,
    "jid" TEXT NOT NULL,
    "mensagemId" TEXT NOT NULL,
    "storageDriver" TEXT NOT NULL,
    "bucket" TEXT,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "dadosExtraidos" JSONB NOT NULL,
    "modeloIa" TEXT NOT NULL,
    "tokensInput" INTEGER,
    "tokensOutput" INTEGER,
    "status" "StatusConfirmacaoWA" NOT NULL DEFAULT 'AGUARDANDO',
    "lancamentoId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "decididoEm" TIMESTAMP(3),

    CONSTRAINT "WhatsAppConfirmacaoPendente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConfirmacaoPendente_sha256_key" ON "WhatsAppConfirmacaoPendente"("sha256");

-- CreateIndex
CREATE INDEX "WhatsAppConfirmacaoPendente_telefone_status_idx" ON "WhatsAppConfirmacaoPendente"("telefone", "status");

-- CreateIndex
CREATE INDEX "WhatsAppConfirmacaoPendente_status_expiraEm_idx" ON "WhatsAppConfirmacaoPendente"("status", "expiraEm");

-- CreateIndex
CREATE INDEX "WhatsAppConfirmacaoPendente_mensagemId_idx" ON "WhatsAppConfirmacaoPendente"("mensagemId");

-- AddForeignKey
ALTER TABLE "WhatsAppConfirmacaoPendente" ADD CONSTRAINT "WhatsAppConfirmacaoPendente_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "Lancamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
