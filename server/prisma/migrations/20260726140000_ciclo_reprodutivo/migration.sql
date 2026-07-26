-- Ciclo reprodutivo: aptidão, dicionário ginecológico oficial e vínculo de cria no parto.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrigemAptidao') THEN
    CREATE TYPE "OrigemAptidao" AS ENUM ('MANUAL', 'AUTOMATICA');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "AptidaoAnimal" (
  "id" SERIAL NOT NULL,
  "animalId" INTEGER NOT NULL,
  "data" DATE NOT NULL,
  "apta" BOOLEAN NOT NULL,
  "motivo" TEXT,
  "origem" "OrigemAptidao" NOT NULL DEFAULT 'MANUAL',
  "propriedadeId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AptidaoAnimal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AptidaoAnimal_animalId_idx" ON "AptidaoAnimal"("animalId");
CREATE INDEX IF NOT EXISTS "AptidaoAnimal_propriedadeId_idx" ON "AptidaoAnimal"("propriedadeId");

CREATE TABLE IF NOT EXISTS "ResultadoExameGinecologico" (
  "id" SERIAL NOT NULL,
  "codigo" INTEGER NOT NULL,
  "nomeResumido" TEXT NOT NULL,
  "nomeCompleto" TEXT,
  "tipo" TEXT,
  "padrao" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "ResultadoExameGinecologico_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ResultadoExameGinecologico_codigo_key" ON "ResultadoExameGinecologico"("codigo");

ALTER TABLE "EventoReprodutivo"
  ADD COLUMN IF NOT EXISTS "resultadoGinecologicoId" INTEGER,
  ADD COLUMN IF NOT EXISTS "criaId" INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS "EventoReprodutivo_criaId_key" ON "EventoReprodutivo"("criaId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AptidaoAnimal_animalId_fkey') THEN
    ALTER TABLE "AptidaoAnimal" ADD CONSTRAINT "AptidaoAnimal_animalId_fkey"
      FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AptidaoAnimal_propriedadeId_fkey') THEN
    ALTER TABLE "AptidaoAnimal" ADD CONSTRAINT "AptidaoAnimal_propriedadeId_fkey"
      FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventoReprodutivo_resultadoGinecologicoId_fkey') THEN
    ALTER TABLE "EventoReprodutivo" ADD CONSTRAINT "EventoReprodutivo_resultadoGinecologicoId_fkey"
      FOREIGN KEY ("resultadoGinecologicoId") REFERENCES "ResultadoExameGinecologico"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventoReprodutivo_criaId_fkey') THEN
    ALTER TABLE "EventoReprodutivo" ADD CONSTRAINT "EventoReprodutivo_criaId_fkey"
      FOREIGN KEY ("criaId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
