-- Categorias configuráveis do rebanho + categoria manual com histórico.
-- A categoria continua calculada na leitura (nunca gravada no Animal); estas tabelas guardam
-- as regras da fazenda e as trocas manuais. Não toca os índices parciais existentes.

-- CreateEnum
CREATE TYPE "pecuaria"."CriterioPartos" AS ENUM ('QUALQUER', 'SEM', 'COM');

-- CreateTable
CREATE TABLE "pecuaria"."CategoriaAnimal" (
    "id" TEXT NOT NULL,
    "ideagriId" INTEGER,
    "chavePadrao" TEXT,
    "nome" TEXT NOT NULL,
    "sexo" "pecuaria"."SexoBovino" NOT NULL,
    "automatica" BOOLEAN NOT NULL DEFAULT true,
    "idadeMinMeses" INTEGER,
    "idadeMaxMeses" INTEGER,
    "partos" "pecuaria"."CriterioPartos" NOT NULL DEFAULT 'QUALQUER',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoriaAnimal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."CategoriaManualAnimal" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "desde" DATE NOT NULL,
    "ate" DATE,
    "motivo" TEXT NOT NULL,
    "motivoEncerramento" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoriaManualAnimal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaAnimal_ideagriId_key" ON "pecuaria"."CategoriaAnimal"("ideagriId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaAnimal_chavePadrao_key" ON "pecuaria"."CategoriaAnimal"("chavePadrao");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaAnimal_sexo_nome_key" ON "pecuaria"."CategoriaAnimal"("sexo", "nome");

-- CreateIndex
CREATE INDEX "CategoriaManualAnimal_animalId_ate_idx" ON "pecuaria"."CategoriaManualAnimal"("animalId", "ate");

-- CreateIndex
CREATE INDEX "CategoriaManualAnimal_categoriaId_ate_idx" ON "pecuaria"."CategoriaManualAnimal"("categoriaId", "ate");

-- AddForeignKey
ALTER TABLE "pecuaria"."CategoriaAnimal" ADD CONSTRAINT "CategoriaAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."CategoriaManualAnimal" ADD CONSTRAINT "CategoriaManualAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."CategoriaManualAnimal" ADD CONSTRAINT "CategoriaManualAnimal_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "pecuaria"."CategoriaAnimal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."CategoriaManualAnimal" ADD CONSTRAINT "CategoriaManualAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- No máximo uma categoria manual aberta por animal.
CREATE UNIQUE INDEX "CategoriaManualAnimal_animalId_aberta_key" ON "pecuaria"."CategoriaManualAnimal"("animalId") WHERE "ate" IS NULL;

-- Padrões de fábrica: as categorias do IDEAGRI (CATEGORIA, códigos 1–7). Mesmos valores de
-- CATEGORIAS_PADRAO em services/pecuaria/rebanho/categorias.ts ("Restaurar padrões").
INSERT INTO "pecuaria"."CategoriaAnimal" ("id", "ideagriId", "chavePadrao", "nome", "sexo", "automatica", "idadeMinMeses", "idadeMaxMeses", "partos", "ordem", "atualizadoEm") VALUES
  (gen_random_uuid()::text, 7, 'F_VACA',           'Vaca',           'F', true,  NULL, NULL, 'COM',      10, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 5, 'F_EM_CRESCIMENTO', 'Em crescimento', 'F', true,  NULL, 12,   'SEM',      20, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 6, 'F_NOVILHA',        'Novilha',        'F', true,  12,   NULL, 'SEM',      30, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 1, 'M_EM_CRESCIMENTO', 'Em crescimento', 'M', true,  NULL, NULL, 'QUALQUER', 40, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 2, 'M_REPRODUTOR',     'Reprodutor',     'M', false, NULL, NULL, 'QUALQUER', 50, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 3, 'M_BOI_CARREIRO',   'Boi carreiro',   'M', false, NULL, NULL, 'QUALQUER', 60, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 4, 'M_RUFIAO',         'Rufião',         'M', false, NULL, NULL, 'QUALQUER', 70, CURRENT_TIMESTAMP);
