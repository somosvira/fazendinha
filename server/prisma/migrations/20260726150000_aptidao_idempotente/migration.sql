-- Garante idempotência concorrente da aptidão por animal, dia e origem.
DELETE FROM "AptidaoAnimal" antiga
USING "AptidaoAnimal" recente
WHERE antiga."animalId" = recente."animalId"
  AND antiga."data" = recente."data"
  AND antiga."origem" = recente."origem"
  AND antiga."id" < recente."id";

CREATE UNIQUE INDEX IF NOT EXISTS "AptidaoAnimal_animalId_data_origem_key"
  ON "AptidaoAnimal"("animalId", "data", "origem");
