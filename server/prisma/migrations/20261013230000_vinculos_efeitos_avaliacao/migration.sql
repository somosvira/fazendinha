ALTER TABLE "pecuaria"."AvaliacaoReprodutiva" ADD COLUMN "gestacaoCriada" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "pecuaria"."AvaliacaoReprodutiva" ADD COLUMN "restricaoId" TEXT;
CREATE UNIQUE INDEX "AvaliacaoReprodutiva_restricaoId_key" ON "pecuaria"."AvaliacaoReprodutiva"("restricaoId");
ALTER TABLE "pecuaria"."AvaliacaoReprodutiva" ADD CONSTRAINT "AvaliacaoReprodutiva_restricaoId_fkey" FOREIGN KEY ("restricaoId") REFERENCES "pecuaria"."RestricaoReprodutiva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
