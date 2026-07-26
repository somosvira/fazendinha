-- Genética estruturada, pedigree, tipos e estoque de sêmen por propriedade.
CREATE TABLE IF NOT EXISTS "IndicadorGenetico" (
  "id" SERIAL NOT NULL,
  "ideagriId" INTEGER,
  "sigla" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "unidade" TEXT,
  "direcao" TEXT NOT NULL DEFAULT 'maior_melhor',
  "colunaLegada" TEXT,
  "ranking" BOOLEAN NOT NULL DEFAULT false,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IndicadorGenetico_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IndicadorGenetico_ideagriId_key" ON "IndicadorGenetico"("ideagriId");
CREATE UNIQUE INDEX IF NOT EXISTS "IndicadorGenetico_sigla_key" ON "IndicadorGenetico"("sigla");

CREATE TABLE IF NOT EXISTS "ValorIndicadorReprodutor" (
  "id" SERIAL NOT NULL,
  "reprodutorId" INTEGER NOT NULL,
  "indicadorId" INTEGER NOT NULL,
  "valor" DECIMAL(12,3) NOT NULL,
  CONSTRAINT "ValorIndicadorReprodutor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ValorIndicadorReprodutor_reprodutorId_indicadorId_key" ON "ValorIndicadorReprodutor"("reprodutorId", "indicadorId");
CREATE INDEX IF NOT EXISTS "ValorIndicadorReprodutor_indicadorId_idx" ON "ValorIndicadorReprodutor"("indicadorId");

CREATE TABLE IF NOT EXISTS "MarcadorGenetico" (
  "id" SERIAL NOT NULL,
  "ideagriId" INTEGER,
  "sigla" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  CONSTRAINT "MarcadorGenetico_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MarcadorGenetico_ideagriId_key" ON "MarcadorGenetico"("ideagriId");
CREATE UNIQUE INDEX IF NOT EXISTS "MarcadorGenetico_sigla_key" ON "MarcadorGenetico"("sigla");

CREATE TABLE IF NOT EXISTS "ValorMarcadorReprodutor" (
  "id" SERIAL NOT NULL,
  "reprodutorId" INTEGER NOT NULL,
  "marcadorId" INTEGER NOT NULL,
  "resultado" TEXT NOT NULL,
  CONSTRAINT "ValorMarcadorReprodutor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ValorMarcadorReprodutor_reprodutorId_marcadorId_key" ON "ValorMarcadorReprodutor"("reprodutorId", "marcadorId");
CREATE INDEX IF NOT EXISTS "ValorMarcadorReprodutor_marcadorId_idx" ON "ValorMarcadorReprodutor"("marcadorId");

CREATE TABLE IF NOT EXISTS "Caseina" (
  "id" SERIAL NOT NULL,
  "ideagriId" INTEGER,
  "sigla" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  CONSTRAINT "Caseina_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Caseina_ideagriId_key" ON "Caseina"("ideagriId");
CREATE UNIQUE INDEX IF NOT EXISTS "Caseina_sigla_key" ON "Caseina"("sigla");

CREATE TABLE IF NOT EXISTS "ValorCaseinaReprodutor" (
  "id" SERIAL NOT NULL,
  "reprodutorId" INTEGER NOT NULL,
  "caseinaId" INTEGER NOT NULL,
  "genotipo" TEXT NOT NULL,
  CONSTRAINT "ValorCaseinaReprodutor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ValorCaseinaReprodutor_reprodutorId_caseinaId_key" ON "ValorCaseinaReprodutor"("reprodutorId", "caseinaId");
CREATE INDEX IF NOT EXISTS "ValorCaseinaReprodutor_caseinaId_idx" ON "ValorCaseinaReprodutor"("caseinaId");

CREATE TABLE IF NOT EXISTS "PedigreeReprodutor" (
  "id" SERIAL NOT NULL,
  "reprodutorId" INTEGER NOT NULL,
  "ideagriId" INTEGER,
  "paiNome" TEXT,
  "paiCodigo" TEXT,
  "maeNome" TEXT,
  "maeCodigo" TEXT,
  "avoMaternoNome" TEXT,
  "avoMaternoCodigo" TEXT,
  "avoPaternoNome" TEXT,
  "avoPaternoCodigo" TEXT,
  CONSTRAINT "PedigreeReprodutor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PedigreeReprodutor_reprodutorId_key" ON "PedigreeReprodutor"("reprodutorId");
CREATE UNIQUE INDEX IF NOT EXISTS "PedigreeReprodutor_ideagriId_key" ON "PedigreeReprodutor"("ideagriId");

CREATE TABLE IF NOT EXISTS "TipoSemen" (
  "id" SERIAL NOT NULL,
  "ideagriId" INTEGER,
  "sigla" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  CONSTRAINT "TipoSemen_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TipoSemen_ideagriId_key" ON "TipoSemen"("ideagriId");
CREATE UNIQUE INDEX IF NOT EXISTS "TipoSemen_sigla_key" ON "TipoSemen"("sigla");

CREATE TABLE IF NOT EXISTS "EstoqueSemen" (
  "id" SERIAL NOT NULL,
  "reprodutorId" INTEGER NOT NULL,
  "tipoSemenId" INTEGER,
  "lote" TEXT,
  "localizacao" TEXT,
  "dosesDisponiveis" INTEGER NOT NULL DEFAULT 0,
  "ideagriId" INTEGER,
  "propriedadeId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EstoqueSemen_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EstoqueSemen_ideagriId_key" ON "EstoqueSemen"("ideagriId");
CREATE INDEX IF NOT EXISTS "EstoqueSemen_reprodutorId_idx" ON "EstoqueSemen"("reprodutorId");
CREATE INDEX IF NOT EXISTS "EstoqueSemen_propriedadeId_idx" ON "EstoqueSemen"("propriedadeId");

ALTER TABLE "Reprodutor" ADD COLUMN IF NOT EXISTS "ideagriId" INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS "Reprodutor_ideagriId_key" ON "Reprodutor"("ideagriId");

ALTER TABLE "EventoReprodutivo"
  ADD COLUMN IF NOT EXISTS "estoqueSemenId" INTEGER,
  ADD COLUMN IF NOT EXISTS "estoqueSemenDoseBaixada" BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ValorIndicadorReprodutor_reprodutorId_fkey') THEN
    ALTER TABLE "ValorIndicadorReprodutor" ADD CONSTRAINT "ValorIndicadorReprodutor_reprodutorId_fkey"
      FOREIGN KEY ("reprodutorId") REFERENCES "Reprodutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ValorIndicadorReprodutor_indicadorId_fkey') THEN
    ALTER TABLE "ValorIndicadorReprodutor" ADD CONSTRAINT "ValorIndicadorReprodutor_indicadorId_fkey"
      FOREIGN KEY ("indicadorId") REFERENCES "IndicadorGenetico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ValorMarcadorReprodutor_reprodutorId_fkey') THEN
    ALTER TABLE "ValorMarcadorReprodutor" ADD CONSTRAINT "ValorMarcadorReprodutor_reprodutorId_fkey"
      FOREIGN KEY ("reprodutorId") REFERENCES "Reprodutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ValorMarcadorReprodutor_marcadorId_fkey') THEN
    ALTER TABLE "ValorMarcadorReprodutor" ADD CONSTRAINT "ValorMarcadorReprodutor_marcadorId_fkey"
      FOREIGN KEY ("marcadorId") REFERENCES "MarcadorGenetico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ValorCaseinaReprodutor_reprodutorId_fkey') THEN
    ALTER TABLE "ValorCaseinaReprodutor" ADD CONSTRAINT "ValorCaseinaReprodutor_reprodutorId_fkey"
      FOREIGN KEY ("reprodutorId") REFERENCES "Reprodutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ValorCaseinaReprodutor_caseinaId_fkey') THEN
    ALTER TABLE "ValorCaseinaReprodutor" ADD CONSTRAINT "ValorCaseinaReprodutor_caseinaId_fkey"
      FOREIGN KEY ("caseinaId") REFERENCES "Caseina"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PedigreeReprodutor_reprodutorId_fkey') THEN
    ALTER TABLE "PedigreeReprodutor" ADD CONSTRAINT "PedigreeReprodutor_reprodutorId_fkey"
      FOREIGN KEY ("reprodutorId") REFERENCES "Reprodutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EstoqueSemen_reprodutorId_fkey') THEN
    ALTER TABLE "EstoqueSemen" ADD CONSTRAINT "EstoqueSemen_reprodutorId_fkey"
      FOREIGN KEY ("reprodutorId") REFERENCES "Reprodutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EstoqueSemen_tipoSemenId_fkey') THEN
    ALTER TABLE "EstoqueSemen" ADD CONSTRAINT "EstoqueSemen_tipoSemenId_fkey"
      FOREIGN KEY ("tipoSemenId") REFERENCES "TipoSemen"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EstoqueSemen_propriedadeId_fkey') THEN
    ALTER TABLE "EstoqueSemen" ADD CONSTRAINT "EstoqueSemen_propriedadeId_fkey"
      FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventoReprodutivo_estoqueSemenId_fkey') THEN
    ALTER TABLE "EventoReprodutivo" ADD CONSTRAINT "EventoReprodutivo_estoqueSemenId_fkey"
      FOREIGN KEY ("estoqueSemenId") REFERENCES "EstoqueSemen"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
