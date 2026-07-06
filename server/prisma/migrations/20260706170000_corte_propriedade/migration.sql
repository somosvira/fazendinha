-- Multi-propriedade — Fatia 4A: gado de corte por sítio.
-- LoteCorte e Piquete ganham propriedadeId (nullable), backfillado para a principal.
-- Aditivo: colunas nullable + backfill — fazenda de 1 sítio não muda nada.

ALTER TABLE "LoteCorte" ADD COLUMN "propriedadeId" INTEGER;
UPDATE "LoteCorte" SET "propriedadeId" = 1;
CREATE INDEX "LoteCorte_propriedadeId_idx" ON "LoteCorte"("propriedadeId");
ALTER TABLE "LoteCorte" ADD CONSTRAINT "LoteCorte_propriedadeId_fkey"
    FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Piquete" ADD COLUMN "propriedadeId" INTEGER;
UPDATE "Piquete" SET "propriedadeId" = 1;
CREATE INDEX "Piquete_propriedadeId_idx" ON "Piquete"("propriedadeId");
ALTER TABLE "Piquete" ADD CONSTRAINT "Piquete_propriedadeId_fkey"
    FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
