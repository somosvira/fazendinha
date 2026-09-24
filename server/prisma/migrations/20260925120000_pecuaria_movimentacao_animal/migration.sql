-- Itens da movimentação: um por animal movido, com a origem gravada. Nunca é apagado:
-- desfazer marca "desfeitoEm" e a FK para a linha de localização vira nula (SET NULL).
-- Não toca os índices únicos parciais.

-- CreateTable
CREATE TABLE "pecuaria"."MovimentacaoAnimal" (
    "id" TEXT NOT NULL,
    "movimentacaoId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "origemPropriedadeId" INTEGER,
    "origemLoteId" TEXT,
    "localizacaoId" TEXT,
    "desfeitoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentacaoAnimal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MovimentacaoAnimal_localizacaoId_key" ON "pecuaria"."MovimentacaoAnimal"("localizacaoId");

-- CreateIndex
CREATE INDEX "MovimentacaoAnimal_animalId_idx" ON "pecuaria"."MovimentacaoAnimal"("animalId");

-- CreateIndex
CREATE INDEX "MovimentacaoAnimal_origemLoteId_idx" ON "pecuaria"."MovimentacaoAnimal"("origemLoteId");

-- CreateIndex
CREATE INDEX "MovimentacaoAnimal_origemPropriedadeId_idx" ON "pecuaria"."MovimentacaoAnimal"("origemPropriedadeId");

-- CreateIndex
CREATE UNIQUE INDEX "MovimentacaoAnimal_movimentacaoId_animalId_key" ON "pecuaria"."MovimentacaoAnimal"("movimentacaoId", "animalId");

-- AddForeignKey
ALTER TABLE "pecuaria"."MovimentacaoAnimal" ADD CONSTRAINT "MovimentacaoAnimal_movimentacaoId_fkey" FOREIGN KEY ("movimentacaoId") REFERENCES "pecuaria"."Movimentacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."MovimentacaoAnimal" ADD CONSTRAINT "MovimentacaoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."MovimentacaoAnimal" ADD CONSTRAINT "MovimentacaoAnimal_origemPropriedadeId_fkey" FOREIGN KEY ("origemPropriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."MovimentacaoAnimal" ADD CONSTRAINT "MovimentacaoAnimal_origemLoteId_fkey" FOREIGN KEY ("origemLoteId") REFERENCES "pecuaria"."Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."MovimentacaoAnimal" ADD CONSTRAINT "MovimentacaoAnimal_localizacaoId_fkey" FOREIGN KEY ("localizacaoId") REFERENCES "pecuaria"."LocalizacaoAnimal"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: um item para cada linha aberta por uma movimentação. A origem é a linha anterior
-- do mesmo animal (fechada no dia em que a nova começa, criada antes dela). Movimentações já
-- desfeitas antes desta migration perderam as linhas e ficam sem itens.
INSERT INTO "pecuaria"."MovimentacaoAnimal" ("id", "movimentacaoId", "animalId", "origemPropriedadeId", "origemLoteId", "localizacaoId", "criadoEm")
SELECT gen_random_uuid()::text, l."movimentacaoId", l."animalId", ant."propriedadeId", ant."loteId", l."id", l."criadoEm"
FROM "pecuaria"."LocalizacaoAnimal" l
LEFT JOIN LATERAL (
  SELECT p."propriedadeId", p."loteId"
  FROM "pecuaria"."LocalizacaoAnimal" p
  WHERE p."animalId" = l."animalId" AND p."ate" = l."desde" AND p."criadoEm" < l."criadoEm"
  ORDER BY p."criadoEm" DESC
  LIMIT 1
) ant ON TRUE
WHERE l."movimentacaoId" IS NOT NULL;
