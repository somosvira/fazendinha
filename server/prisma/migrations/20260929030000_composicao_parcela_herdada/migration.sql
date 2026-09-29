ALTER TABLE "pecuaria"."ComposicaoRacial"
ADD COLUMN "fracaoCalculada64" INTEGER NOT NULL DEFAULT 0;

UPDATE "pecuaria"."ComposicaoRacial"
SET "fracaoCalculada64" = "fracao64"
WHERE "origem" = 'CALCULADA';

ALTER TABLE "pecuaria"."ComposicaoRacial"
ADD CONSTRAINT "ComposicaoRacial_fracaoCalculada64_check"
CHECK ("fracaoCalculada64" >= 0 AND "fracaoCalculada64" <= "fracao64");
