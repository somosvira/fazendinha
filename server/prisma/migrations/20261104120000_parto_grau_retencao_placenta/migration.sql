ALTER TABLE "pecuaria"."PartoAnimal" ADD COLUMN "grauRetencaoPlacenta" INTEGER;
ALTER TABLE "pecuaria"."PartoAnimal" ADD CONSTRAINT "PartoAnimal_grauRetencaoPlacenta_check"
CHECK ("grauRetencaoPlacenta" IS NULL OR ("grauRetencaoPlacenta" BETWEEN 1 AND 3 AND "retencaoPlacenta" IS TRUE));
