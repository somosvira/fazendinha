-- Escopa a produção de tanque/lote por propriedade. Quando há grupo, herda dele;
-- registros históricos de tanque geral ficam na propriedade principal.
ALTER TABLE "ProducaoLote" ADD COLUMN "propriedadeId" INTEGER;

UPDATE "ProducaoLote" AS p
SET "propriedadeId" = COALESCE(
  (SELECT g."propriedadeId" FROM "Grupo" AS g WHERE g."id" = p."grupoId"),
  (SELECT pr."id" FROM "Propriedade" AS pr ORDER BY pr."principal" DESC, pr."id" ASC LIMIT 1)
)
WHERE p."propriedadeId" IS NULL;

CREATE INDEX "ProducaoLote_propriedadeId_data_idx" ON "ProducaoLote"("propriedadeId", "data");
ALTER TABLE "ProducaoLote"
  ADD CONSTRAINT "ProducaoLote_propriedadeId_fkey"
  FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
