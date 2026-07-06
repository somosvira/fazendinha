-- Multi-propriedade — Fatia 4B: plantio (café) por sítio.
-- Talhao e Lavoura ganham propriedadeId (nullable), backfillado para a principal.
-- Aditivo: colunas nullable + backfill — fazenda de 1 sítio não muda nada.
-- Os filhos do talhão (operações, inspeções, passadas de colheita…) herdam o
-- escopo via talhao.propriedadeId nas leituras; não precisam de coluna própria.

ALTER TABLE "Talhao" ADD COLUMN "propriedadeId" INTEGER;
UPDATE "Talhao" SET "propriedadeId" = 1;
CREATE INDEX "Talhao_propriedadeId_idx" ON "Talhao"("propriedadeId");
ALTER TABLE "Talhao" ADD CONSTRAINT "Talhao_propriedadeId_fkey"
    FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Lavoura" ADD COLUMN "propriedadeId" INTEGER;
UPDATE "Lavoura" SET "propriedadeId" = 1;
CREATE INDEX "Lavoura_propriedadeId_idx" ON "Lavoura"("propriedadeId");
ALTER TABLE "Lavoura" ADD CONSTRAINT "Lavoura_propriedadeId_fkey"
    FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
