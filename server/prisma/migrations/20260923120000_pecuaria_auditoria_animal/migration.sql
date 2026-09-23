-- Trilha de auditoria por animal: a coluna permite achar entradas de linhas já apagadas
-- (pesagem excluída, movimentação/destino desfeitos), que o filtro por id de entidade perdia.
ALTER TABLE "pecuaria"."AuditoriaPecuaria" ADD COLUMN "animalId" TEXT;

CREATE INDEX "AuditoriaPecuaria_animalId_em_idx" ON "pecuaria"."AuditoriaPecuaria"("animalId", "em");

-- Backfill das entradas existentes.
UPDATE "pecuaria"."AuditoriaPecuaria"
SET "animalId" = "entidadeId"
WHERE "animalId" IS NULL AND "entidade" IN ('Animal', 'ComposicaoRacial');

UPDATE "pecuaria"."AuditoriaPecuaria"
SET "animalId" = COALESCE(
  "depois" ->> 'animalId',
  "antes" ->> 'animalId',
  "antes" -> 'removida' ->> 'animalId',
  "depois" -> 'reaberta' ->> 'animalId'
)
WHERE "animalId" IS NULL
  AND "entidade" IN ('LocalizacaoAnimal', 'DestinoAnimal', 'SaidaAnimal', 'Pesagem');
