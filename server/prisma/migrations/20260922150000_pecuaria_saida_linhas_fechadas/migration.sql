-- AlterTable
ALTER TABLE "pecuaria"."SaidaAnimal" ADD COLUMN     "destinoFechadoId" TEXT,
ADD COLUMN     "localizacaoFechadaId" TEXT;

-- CreateIndex
CREATE INDEX "SaidaAnimal_localizacaoFechadaId_idx" ON "pecuaria"."SaidaAnimal"("localizacaoFechadaId");

-- CreateIndex
CREATE INDEX "SaidaAnimal_destinoFechadoId_idx" ON "pecuaria"."SaidaAnimal"("destinoFechadoId");

-- AddForeignKey
ALTER TABLE "pecuaria"."SaidaAnimal" ADD CONSTRAINT "SaidaAnimal_localizacaoFechadaId_fkey" FOREIGN KEY ("localizacaoFechadaId") REFERENCES "pecuaria"."LocalizacaoAnimal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."SaidaAnimal" ADD CONSTRAINT "SaidaAnimal_destinoFechadoId_fkey" FOREIGN KEY ("destinoFechadoId") REFERENCES "pecuaria"."DestinoAnimal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Backfill (melhor esforço) das saídas já gravadas: a linha fechada é a de `ate` igual à
-- data da saída com o `desde` mais recente (mesma heurística usada antes desta coluna).
UPDATE "pecuaria"."SaidaAnimal" s
SET "localizacaoFechadaId" = (
  SELECT l."id" FROM "pecuaria"."LocalizacaoAnimal" l
  WHERE l."animalId" = s."animalId" AND l."ate" = s."data"
  ORDER BY l."desde" DESC, l."criadoEm" DESC LIMIT 1
)
WHERE s."localizacaoFechadaId" IS NULL;

UPDATE "pecuaria"."SaidaAnimal" s
SET "destinoFechadoId" = (
  SELECT d."id" FROM "pecuaria"."DestinoAnimal" d
  WHERE d."animalId" = s."animalId" AND d."ate" = s."data"
  ORDER BY d."desde" DESC, d."criadoEm" DESC LIMIT 1
)
WHERE s."destinoFechadoId" IS NULL;

-- Índices únicos parciais (não expressáveis no Prisma):
-- no máximo um destino aberto e uma saída não estornada por animal.
CREATE UNIQUE INDEX "DestinoAnimal_animalId_aberto_key" ON "pecuaria"."DestinoAnimal"("animalId") WHERE "ate" IS NULL;
CREATE UNIQUE INDEX "SaidaAnimal_animalId_ativa_key" ON "pecuaria"."SaidaAnimal"("animalId") WHERE "estornadaEm" IS NULL;
