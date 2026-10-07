ALTER TABLE "pecuaria"."OcorrenciaSanitaria" ADD COLUMN "doencaNomeSnapshot" TEXT;

UPDATE "pecuaria"."OcorrenciaSanitaria" AS o
SET "doencaNomeSnapshot" = d."nome"
FROM "pecuaria"."Doenca" AS d
WHERE d."id" = o."doencaId";

UPDATE "pecuaria"."ExameAnimal" AS e
SET "formatoSnapshot" = e."formatoSnapshot" || jsonb_build_object('nome', t."nome")
FROM "pecuaria"."TipoExame" AS t
WHERE t."id" = e."tipoExameId" AND NOT (e."formatoSnapshot" ? 'nome');
