-- Movimentação vira evento próprio: um cabeçalho (data, destino, motivo, quem fez) e as
-- linhas de LocalizacaoAnimal que ela abriu apontando para ele. O motivo sai da linha.
-- Não toca os índices únicos parciais (LocalizacaoAnimal_animalId_aberta_key etc.).

-- CreateTable
CREATE TABLE "pecuaria"."Movimentacao" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "propriedadeDestinoId" INTEGER NOT NULL,
    "loteDestinoId" TEXT,
    "motivo" TEXT,
    "quantidade" INTEGER NOT NULL,
    "desfeitaEm" TIMESTAMP(3),
    "desfeitaMotivo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Movimentacao_pkey" PRIMARY KEY ("id")
);

-- Backfill: cada movimentacaoId já gravado vira um cabeçalho, com data, destino e motivo
-- tirados das próprias linhas (todas as linhas de uma movimentação têm os mesmos valores).
INSERT INTO "pecuaria"."Movimentacao" ("id", "data", "propriedadeDestinoId", "loteDestinoId", "motivo", "quantidade", "criadoEm", "criadoPorId", "atualizadoEm")
SELECT "movimentacaoId", MIN("desde"), MIN("propriedadeId"), MIN("loteId"), MIN("motivo"), COUNT(*)::int, MIN("criadoEm"), MIN("criadoPorId"), CURRENT_TIMESTAMP
FROM "pecuaria"."LocalizacaoAnimal"
WHERE "movimentacaoId" IS NOT NULL
GROUP BY "movimentacaoId";

-- AlterTable
ALTER TABLE "pecuaria"."LocalizacaoAnimal" DROP COLUMN "motivo";

-- CreateIndex
CREATE INDEX "Movimentacao_loteDestinoId_data_idx" ON "pecuaria"."Movimentacao"("loteDestinoId", "data");

-- CreateIndex
CREATE INDEX "Movimentacao_propriedadeDestinoId_data_idx" ON "pecuaria"."Movimentacao"("propriedadeDestinoId", "data");

-- CreateIndex
CREATE INDEX "Movimentacao_data_idx" ON "pecuaria"."Movimentacao"("data");

-- AddForeignKey
ALTER TABLE "pecuaria"."LocalizacaoAnimal" ADD CONSTRAINT "LocalizacaoAnimal_movimentacaoId_fkey" FOREIGN KEY ("movimentacaoId") REFERENCES "pecuaria"."Movimentacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."Movimentacao" ADD CONSTRAINT "Movimentacao_propriedadeDestinoId_fkey" FOREIGN KEY ("propriedadeDestinoId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."Movimentacao" ADD CONSTRAINT "Movimentacao_loteDestinoId_fkey" FOREIGN KEY ("loteDestinoId") REFERENCES "pecuaria"."Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."Movimentacao" ADD CONSTRAINT "Movimentacao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
