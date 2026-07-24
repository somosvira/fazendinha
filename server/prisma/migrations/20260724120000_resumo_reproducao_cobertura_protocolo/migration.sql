ALTER TABLE "ResumoAnimal"
ADD COLUMN "ultimaInseminacao" DATE,
ADD COLUMN "protocoloAtual" TEXT;

WITH "UltimaCobertura" AS (
  SELECT DISTINCT ON ("animalId")
    "animalId",
    "data",
    "protocolo"
  FROM "EventoReprodutivo"
  WHERE "tipo" IN ('INSEMINACAO', 'COBERTURA', 'TRANSFERENCIA_EMBRIAO')
  ORDER BY "animalId", "data" DESC, "id" DESC
)
UPDATE "ResumoAnimal" AS "resumo"
SET
  "ultimaInseminacao" = "cobertura"."data",
  "protocoloAtual" = "cobertura"."protocolo"
FROM "UltimaCobertura" AS "cobertura"
WHERE "resumo"."animalId" = "cobertura"."animalId";
