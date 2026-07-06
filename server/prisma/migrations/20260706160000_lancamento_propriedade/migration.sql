-- Multi-propriedade — Fatia 3: financeiro por sítio.
-- Lancamento ganha propriedadeId (nullable), backfillado para a principal (id=1).
-- Aditivo: coluna nullable + backfill — o plano de contas segue compartilhado, o
-- consolidado (visão atual) continua o default; fazenda de 1 sítio não muda nada.

ALTER TABLE "Lancamento" ADD COLUMN "propriedadeId" INTEGER;
UPDATE "Lancamento" SET "propriedadeId" = 1;
CREATE INDEX "Lancamento_propriedadeId_idx" ON "Lancamento"("propriedadeId");
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_propriedadeId_fkey"
    FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
