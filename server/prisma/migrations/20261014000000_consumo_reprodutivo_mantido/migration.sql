ALTER TABLE "pecuaria"."TentativaReprodutiva" ADD COLUMN "consumoMantido" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "pecuaria"."TentativaReprodutiva" ADD CONSTRAINT "Tentativa_consumo_mantido" CHECK (NOT "consumoMantido" OR ("movimentoEstoqueId" IS NOT NULL AND "status"='ANULADO'));
