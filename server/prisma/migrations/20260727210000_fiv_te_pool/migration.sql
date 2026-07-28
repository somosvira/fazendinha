-- FIV/TE operacional: coletas, fertilizações, embriões e pool de doadoras.
CREATE TABLE IF NOT EXISTS "EmbriaoClassificacao" (
  "id" SERIAL NOT NULL,
  "ideagriId" INTEGER,
  "sigla" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "EmbriaoClassificacao_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EmbriaoClassificacao_ideagriId_key" ON "EmbriaoClassificacao"("ideagriId");
CREATE UNIQUE INDEX IF NOT EXISTS "EmbriaoClassificacao_sigla_key" ON "EmbriaoClassificacao"("sigla");

CREATE TABLE IF NOT EXISTS "Coleta" (
  "id" SERIAL NOT NULL,
  "ideagriId" INTEGER,
  "doadoraId" INTEGER NOT NULL,
  "data" DATE NOT NULL,
  "tecnico" TEXT,
  "metodo" TEXT NOT NULL,
  "laboratorio" TEXT,
  "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
  "canceladaEm" TIMESTAMP(3),
  "motivoCancelamento" TEXT,
  "observacao" TEXT,
  "aplicacaoPoolId" INTEGER,
  "propriedadeId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Coleta_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Coleta_ideagriId_key" ON "Coleta"("ideagriId");
CREATE INDEX IF NOT EXISTS "Coleta_doadoraId_idx" ON "Coleta"("doadoraId");
CREATE INDEX IF NOT EXISTS "Coleta_propriedadeId_idx" ON "Coleta"("propriedadeId");
CREATE INDEX IF NOT EXISTS "Coleta_aplicacaoPoolId_idx" ON "Coleta"("aplicacaoPoolId");

CREATE TABLE IF NOT EXISTS "OocitoColeta" (
  "id" SERIAL NOT NULL,
  "coletaId" INTEGER NOT NULL,
  "qualidade" TEXT NOT NULL,
  "viavel" BOOLEAN NOT NULL,
  "quantidade" INTEGER NOT NULL,
  CONSTRAINT "OocitoColeta_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OocitoColeta_coletaId_qualidade_viavel_key" ON "OocitoColeta"("coletaId", "qualidade", "viavel");

CREATE TABLE IF NOT EXISTS "FertilizacaoColeta" (
  "id" SERIAL NOT NULL,
  "ideagriId" INTEGER,
  "coletaId" INTEGER NOT NULL,
  "reprodutorId" INTEGER NOT NULL,
  "estoqueSemenId" INTEGER,
  "doseBaixada" BOOLEAN NOT NULL DEFAULT false,
  "data" DATE,
  "tecnica" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ATIVA',
  "canceladaEm" TIMESTAMP(3),
  "motivoCancelamento" TEXT,
  CONSTRAINT "FertilizacaoColeta_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FertilizacaoColeta_ideagriId_key" ON "FertilizacaoColeta"("ideagriId");
CREATE INDEX IF NOT EXISTS "FertilizacaoColeta_coletaId_idx" ON "FertilizacaoColeta"("coletaId");
CREATE INDEX IF NOT EXISTS "FertilizacaoColeta_reprodutorId_idx" ON "FertilizacaoColeta"("reprodutorId");
CREATE INDEX IF NOT EXISTS "FertilizacaoColeta_estoqueSemenId_idx" ON "FertilizacaoColeta"("estoqueSemenId");

CREATE TABLE IF NOT EXISTS "EmbriaoColeta" (
  "id" SERIAL NOT NULL,
  "ideagriId" INTEGER,
  "fertilizacaoId" INTEGER NOT NULL,
  "classificacaoId" INTEGER,
  "codigoInterno" TEXT,
  "estagio" TEXT,
  "viavel" BOOLEAN NOT NULL DEFAULT true,
  "estado" TEXT NOT NULL DEFAULT 'DISPONIVEL',
  "propriedadeId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmbriaoColeta_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EmbriaoColeta_ideagriId_key" ON "EmbriaoColeta"("ideagriId");
CREATE INDEX IF NOT EXISTS "EmbriaoColeta_fertilizacaoId_idx" ON "EmbriaoColeta"("fertilizacaoId");
CREATE INDEX IF NOT EXISTS "EmbriaoColeta_classificacaoId_idx" ON "EmbriaoColeta"("classificacaoId");
CREATE INDEX IF NOT EXISTS "EmbriaoColeta_estado_idx" ON "EmbriaoColeta"("estado");
CREATE INDEX IF NOT EXISTS "EmbriaoColeta_propriedadeId_idx" ON "EmbriaoColeta"("propriedadeId");

CREATE TABLE IF NOT EXISTS "GrupoPoolDoadora" (
  "id" SERIAL NOT NULL,
  "ideagriId" INTEGER,
  "nome" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "propriedadeId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrupoPoolDoadora_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GrupoPoolDoadora_ideagriId_key" ON "GrupoPoolDoadora"("ideagriId");
CREATE INDEX IF NOT EXISTS "GrupoPoolDoadora_propriedadeId_idx" ON "GrupoPoolDoadora"("propriedadeId");

CREATE TABLE IF NOT EXISTS "ItemGrupoPoolDoadora" (
  "id" SERIAL NOT NULL,
  "grupoId" INTEGER NOT NULL,
  "doadoraId" INTEGER NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "ItemGrupoPoolDoadora_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ItemGrupoPoolDoadora_grupoId_doadoraId_key" ON "ItemGrupoPoolDoadora"("grupoId", "doadoraId");

CREATE TABLE IF NOT EXISTS "AplicacaoPoolDoadora" (
  "id" SERIAL NOT NULL,
  "grupoId" INTEGER NOT NULL,
  "data" DATE NOT NULL,
  "tecnico" TEXT,
  "propriedadeId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AplicacaoPoolDoadora_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AplicacaoPoolDoadora_grupoId_data_key" ON "AplicacaoPoolDoadora"("grupoId", "data");
CREATE INDEX IF NOT EXISTS "AplicacaoPoolDoadora_grupoId_idx" ON "AplicacaoPoolDoadora"("grupoId");
CREATE INDEX IF NOT EXISTS "AplicacaoPoolDoadora_propriedadeId_idx" ON "AplicacaoPoolDoadora"("propriedadeId");

ALTER TABLE "EventoReprodutivo" ADD COLUMN IF NOT EXISTS "embriaoColetaId" INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS "EventoReprodutivo_embriaoColetaId_key" ON "EventoReprodutivo"("embriaoColetaId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Coleta_doadoraId_fkey') THEN ALTER TABLE "Coleta" ADD CONSTRAINT "Coleta_doadoraId_fkey" FOREIGN KEY ("doadoraId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Coleta_aplicacaoPoolId_fkey') THEN ALTER TABLE "Coleta" ADD CONSTRAINT "Coleta_aplicacaoPoolId_fkey" FOREIGN KEY ("aplicacaoPoolId") REFERENCES "AplicacaoPoolDoadora"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Coleta_propriedadeId_fkey') THEN ALTER TABLE "Coleta" ADD CONSTRAINT "Coleta_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OocitoColeta_coletaId_fkey') THEN ALTER TABLE "OocitoColeta" ADD CONSTRAINT "OocitoColeta_coletaId_fkey" FOREIGN KEY ("coletaId") REFERENCES "Coleta"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FertilizacaoColeta_coletaId_fkey') THEN ALTER TABLE "FertilizacaoColeta" ADD CONSTRAINT "FertilizacaoColeta_coletaId_fkey" FOREIGN KEY ("coletaId") REFERENCES "Coleta"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FertilizacaoColeta_reprodutorId_fkey') THEN ALTER TABLE "FertilizacaoColeta" ADD CONSTRAINT "FertilizacaoColeta_reprodutorId_fkey" FOREIGN KEY ("reprodutorId") REFERENCES "Reprodutor"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FertilizacaoColeta_estoqueSemenId_fkey') THEN ALTER TABLE "FertilizacaoColeta" ADD CONSTRAINT "FertilizacaoColeta_estoqueSemenId_fkey" FOREIGN KEY ("estoqueSemenId") REFERENCES "EstoqueSemen"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmbriaoColeta_fertilizacaoId_fkey') THEN ALTER TABLE "EmbriaoColeta" ADD CONSTRAINT "EmbriaoColeta_fertilizacaoId_fkey" FOREIGN KEY ("fertilizacaoId") REFERENCES "FertilizacaoColeta"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmbriaoColeta_classificacaoId_fkey') THEN ALTER TABLE "EmbriaoColeta" ADD CONSTRAINT "EmbriaoColeta_classificacaoId_fkey" FOREIGN KEY ("classificacaoId") REFERENCES "EmbriaoClassificacao"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmbriaoColeta_propriedadeId_fkey') THEN ALTER TABLE "EmbriaoColeta" ADD CONSTRAINT "EmbriaoColeta_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GrupoPoolDoadora_propriedadeId_fkey') THEN ALTER TABLE "GrupoPoolDoadora" ADD CONSTRAINT "GrupoPoolDoadora_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ItemGrupoPoolDoadora_grupoId_fkey') THEN ALTER TABLE "ItemGrupoPoolDoadora" ADD CONSTRAINT "ItemGrupoPoolDoadora_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "GrupoPoolDoadora"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ItemGrupoPoolDoadora_doadoraId_fkey') THEN ALTER TABLE "ItemGrupoPoolDoadora" ADD CONSTRAINT "ItemGrupoPoolDoadora_doadoraId_fkey" FOREIGN KEY ("doadoraId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AplicacaoPoolDoadora_grupoId_fkey') THEN ALTER TABLE "AplicacaoPoolDoadora" ADD CONSTRAINT "AplicacaoPoolDoadora_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "GrupoPoolDoadora"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AplicacaoPoolDoadora_propriedadeId_fkey') THEN ALTER TABLE "AplicacaoPoolDoadora" ADD CONSTRAINT "AplicacaoPoolDoadora_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventoReprodutivo_embriaoColetaId_fkey') THEN ALTER TABLE "EventoReprodutivo" ADD CONSTRAINT "EventoReprodutivo_embriaoColetaId_fkey" FOREIGN KEY ("embriaoColetaId") REFERENCES "EmbriaoColeta"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF;
END $$;
