ALTER TABLE "pecuaria"."MaterialGenetico" DROP CONSTRAINT "MaterialGenetico_doadora_chk";

ALTER TABLE "pecuaria"."MaterialGenetico" ADD CONSTRAINT "MaterialGenetico_doadora_chk"
  CHECK (
    ("tipo" = 'EMBRIAO' AND NOT ("doadoraId" IS NOT NULL AND "doadoraExternaId" IS NOT NULL))
    OR ("tipo" = 'SEMEN' AND "doadoraId" IS NULL AND "doadoraExternaId" IS NULL)
  );
