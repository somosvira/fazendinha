CREATE TABLE "RascunhoOperacao" (
    "id" SERIAL NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "criadoPorId" INTEGER NOT NULL,
    "dados" JSONB NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RascunhoOperacao_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DocumentoFinanceiro" ADD COLUMN "rascunhoId" INTEGER;

CREATE UNIQUE INDEX "RascunhoOperacao_propriedadeId_criadoPorId_key"
ON "RascunhoOperacao"("propriedadeId", "criadoPorId");

CREATE INDEX "RascunhoOperacao_criadoPorId_updatedAt_idx"
ON "RascunhoOperacao"("criadoPorId", "updatedAt");

CREATE INDEX "DocumentoFinanceiro_rascunhoId_idx"
ON "DocumentoFinanceiro"("rascunhoId");

ALTER TABLE "RascunhoOperacao"
ADD CONSTRAINT "RascunhoOperacao_propriedadeId_fkey"
FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RascunhoOperacao"
ADD CONSTRAINT "RascunhoOperacao_criadoPorId_fkey"
FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentoFinanceiro"
ADD CONSTRAINT "DocumentoFinanceiro_rascunhoId_fkey"
FOREIGN KEY ("rascunhoId") REFERENCES "RascunhoOperacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
