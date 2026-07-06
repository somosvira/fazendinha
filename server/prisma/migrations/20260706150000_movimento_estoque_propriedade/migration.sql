-- Multi-propriedade — Fatia 2: estoque por sítio.
-- MovimentoEstoque ganha propriedadeId (nullable), backfillado para a principal.
-- Aditivo: coluna nullable + backfill — fazenda de 1 sítio não muda.

ALTER TABLE "MovimentoEstoque" ADD COLUMN "propriedadeId" INTEGER;
UPDATE "MovimentoEstoque" SET "propriedadeId" = 1;
CREATE INDEX "MovimentoEstoque_propriedadeId_idx" ON "MovimentoEstoque"("propriedadeId");
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_propriedadeId_fkey"
    FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
