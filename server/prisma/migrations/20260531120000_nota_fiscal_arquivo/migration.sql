-- CreateEnum
CREATE TYPE "StatusValidacaoNF" AS ENUM ('PENDENTE', 'VALIDA', 'ATENCAO', 'REJEITADA');

-- CreateTable
CREATE TABLE "NotaFiscalArquivo" (
    "id" SERIAL NOT NULL,
    "lancamentoId" INTEGER NOT NULL,
    "storageDriver" TEXT NOT NULL,
    "bucket" TEXT,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "statusValidacao" "StatusValidacaoNF" NOT NULL DEFAULT 'PENDENTE',
    "mensagemValidacao" TEXT,
    "ocrTexto" TEXT,
    "cnpjEmissor" TEXT,
    "chaveAcessoNfe" VARCHAR(44),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validadoEm" TIMESTAMP(3),

    CONSTRAINT "NotaFiscalArquivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscalArquivo_storageKey_key" ON "NotaFiscalArquivo"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscalArquivo_sha256_key" ON "NotaFiscalArquivo"("sha256");

-- CreateIndex
CREATE INDEX "NotaFiscalArquivo_lancamentoId_statusValidacao_idx" ON "NotaFiscalArquivo"("lancamentoId", "statusValidacao");

-- AddForeignKey
ALTER TABLE "NotaFiscalArquivo" ADD CONSTRAINT "NotaFiscalArquivo_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "Lancamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
