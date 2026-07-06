-- Multi-propriedade — Fatia 0 (fundação invisível).
-- Cria Propriedade, semeia 1 linha principal (Fazenda Rio Novo) e escopa Animal
-- e Grupo com propriedadeId nullable, backfillado para a principal.
-- Aditivo: colunas nullable, backfill explícito — fazenda de 1 sítio não muda.

CREATE TABLE "Propriedade" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "apelido" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Propriedade_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Propriedade_nome_key" ON "Propriedade"("nome");

-- Semeia a propriedade principal com id=1 e avança a sequência.
INSERT INTO "Propriedade" ("id", "nome", "apelido", "principal", "ativo", "ordem", "updatedAt")
VALUES (1, 'Fazenda Rio Novo', 'Sede', true, true, 0, CURRENT_TIMESTAMP);
SELECT setval(pg_get_serial_sequence('"Propriedade"', 'id'), 1, true);

-- Escopo em Animal + backfill para a principal.
ALTER TABLE "Animal" ADD COLUMN "propriedadeId" INTEGER;
UPDATE "Animal" SET "propriedadeId" = 1;
CREATE INDEX "Animal_propriedadeId_idx" ON "Animal"("propriedadeId");
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_propriedadeId_fkey"
    FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Escopo em Grupo + backfill para a principal.
ALTER TABLE "Grupo" ADD COLUMN "propriedadeId" INTEGER;
UPDATE "Grupo" SET "propriedadeId" = 1;
CREATE INDEX "Grupo_propriedadeId_idx" ON "Grupo"("propriedadeId");
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_propriedadeId_fkey"
    FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
