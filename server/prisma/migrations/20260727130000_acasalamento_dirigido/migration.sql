-- Medidas compartilhadas e planos versionados de acasalamento dirigido por propriedade.
CREATE TABLE IF NOT EXISTS "MedidaAcasalamento" (
  "id" SERIAL NOT NULL,
  "ideagriId" INTEGER,
  "nome" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "consanguinidadeMax" DECIMAL(5,4),
  "exigePedigree" BOOLEAN NOT NULL DEFAULT false,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MedidaAcasalamento_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MedidaAcasalamento_ideagriId_key" ON "MedidaAcasalamento"("ideagriId");
CREATE UNIQUE INDEX IF NOT EXISTS "MedidaAcasalamento_nome_key" ON "MedidaAcasalamento"("nome");

CREATE TABLE IF NOT EXISTS "ItemMedidaAcasalamento" (
  "id" SERIAL NOT NULL,
  "medidaId" INTEGER NOT NULL,
  "indicadorId" INTEGER NOT NULL,
  "peso" DECIMAL(8,4) NOT NULL DEFAULT 1,
  "minimo" DECIMAL(12,3),
  "maximo" DECIMAL(12,3),
  CONSTRAINT "ItemMedidaAcasalamento_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ItemMedidaAcasalamento_medidaId_indicadorId_key" ON "ItemMedidaAcasalamento"("medidaId", "indicadorId");
CREATE INDEX IF NOT EXISTS "ItemMedidaAcasalamento_indicadorId_idx" ON "ItemMedidaAcasalamento"("indicadorId");

CREATE TABLE IF NOT EXISTS "CombinacaoMedidaAcasalamento" (
  "id" SERIAL NOT NULL,
  "ideagriId" INTEGER,
  "nome" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CombinacaoMedidaAcasalamento_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CombinacaoMedidaAcasalamento_ideagriId_key" ON "CombinacaoMedidaAcasalamento"("ideagriId");
CREATE UNIQUE INDEX IF NOT EXISTS "CombinacaoMedidaAcasalamento_nome_key" ON "CombinacaoMedidaAcasalamento"("nome");

CREATE TABLE IF NOT EXISTS "ItemCombinacaoMedida" (
  "id" SERIAL NOT NULL,
  "combinacaoId" INTEGER NOT NULL,
  "medidaId" INTEGER NOT NULL,
  "peso" DECIMAL(8,4) NOT NULL DEFAULT 1,
  "obrigatoria" BOOLEAN NOT NULL DEFAULT false,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ItemCombinacaoMedida_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ItemCombinacaoMedida_combinacaoId_medidaId_key" ON "ItemCombinacaoMedida"("combinacaoId", "medidaId");
CREATE INDEX IF NOT EXISTS "ItemCombinacaoMedida_medidaId_idx" ON "ItemCombinacaoMedida"("medidaId");

CREATE TABLE IF NOT EXISTS "PlanoAcasalamento" (
  "id" SERIAL NOT NULL,
  "grupoId" INTEGER NOT NULL,
  "combinacaoId" INTEGER NOT NULL,
  "nome" TEXT NOT NULL,
  "propriedadeId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlanoAcasalamento_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PlanoAcasalamento_grupoId_idx" ON "PlanoAcasalamento"("grupoId");
CREATE INDEX IF NOT EXISTS "PlanoAcasalamento_combinacaoId_idx" ON "PlanoAcasalamento"("combinacaoId");
CREATE INDEX IF NOT EXISTS "PlanoAcasalamento_propriedadeId_idx" ON "PlanoAcasalamento"("propriedadeId");

CREATE TABLE IF NOT EXISTS "VersaoPlanoAcasalamento" (
  "id" SERIAL NOT NULL,
  "planoId" INTEGER NOT NULL,
  "versao" INTEGER NOT NULL,
  "configSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VersaoPlanoAcasalamento_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "VersaoPlanoAcasalamento_planoId_versao_key" ON "VersaoPlanoAcasalamento"("planoId", "versao");

CREATE TABLE IF NOT EXISTS "LinhaPlanoAcasalamento" (
  "id" SERIAL NOT NULL,
  "versaoId" INTEGER NOT NULL,
  "femeaId" INTEGER NOT NULL,
  "rankingSnapshot" JSONB NOT NULL,
  "reprodutorEscolhidoId" INTEGER,
  "confirmadoNaoVerificavel" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "LinhaPlanoAcasalamento_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LinhaPlanoAcasalamento_versaoId_femeaId_key" ON "LinhaPlanoAcasalamento"("versaoId", "femeaId");
CREATE INDEX IF NOT EXISTS "LinhaPlanoAcasalamento_femeaId_idx" ON "LinhaPlanoAcasalamento"("femeaId");
CREATE INDEX IF NOT EXISTS "LinhaPlanoAcasalamento_reprodutorEscolhidoId_idx" ON "LinhaPlanoAcasalamento"("reprodutorEscolhidoId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ItemMedidaAcasalamento_medidaId_fkey') THEN
    ALTER TABLE "ItemMedidaAcasalamento" ADD CONSTRAINT "ItemMedidaAcasalamento_medidaId_fkey"
      FOREIGN KEY ("medidaId") REFERENCES "MedidaAcasalamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ItemMedidaAcasalamento_indicadorId_fkey') THEN
    ALTER TABLE "ItemMedidaAcasalamento" ADD CONSTRAINT "ItemMedidaAcasalamento_indicadorId_fkey"
      FOREIGN KEY ("indicadorId") REFERENCES "IndicadorGenetico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ItemCombinacaoMedida_combinacaoId_fkey') THEN
    ALTER TABLE "ItemCombinacaoMedida" ADD CONSTRAINT "ItemCombinacaoMedida_combinacaoId_fkey"
      FOREIGN KEY ("combinacaoId") REFERENCES "CombinacaoMedidaAcasalamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ItemCombinacaoMedida_medidaId_fkey') THEN
    ALTER TABLE "ItemCombinacaoMedida" ADD CONSTRAINT "ItemCombinacaoMedida_medidaId_fkey"
      FOREIGN KEY ("medidaId") REFERENCES "MedidaAcasalamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanoAcasalamento_grupoId_fkey') THEN
    ALTER TABLE "PlanoAcasalamento" ADD CONSTRAINT "PlanoAcasalamento_grupoId_fkey"
      FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanoAcasalamento_combinacaoId_fkey') THEN
    ALTER TABLE "PlanoAcasalamento" ADD CONSTRAINT "PlanoAcasalamento_combinacaoId_fkey"
      FOREIGN KEY ("combinacaoId") REFERENCES "CombinacaoMedidaAcasalamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanoAcasalamento_propriedadeId_fkey') THEN
    ALTER TABLE "PlanoAcasalamento" ADD CONSTRAINT "PlanoAcasalamento_propriedadeId_fkey"
      FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VersaoPlanoAcasalamento_planoId_fkey') THEN
    ALTER TABLE "VersaoPlanoAcasalamento" ADD CONSTRAINT "VersaoPlanoAcasalamento_planoId_fkey"
      FOREIGN KEY ("planoId") REFERENCES "PlanoAcasalamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LinhaPlanoAcasalamento_versaoId_fkey') THEN
    ALTER TABLE "LinhaPlanoAcasalamento" ADD CONSTRAINT "LinhaPlanoAcasalamento_versaoId_fkey"
      FOREIGN KEY ("versaoId") REFERENCES "VersaoPlanoAcasalamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LinhaPlanoAcasalamento_femeaId_fkey') THEN
    ALTER TABLE "LinhaPlanoAcasalamento" ADD CONSTRAINT "LinhaPlanoAcasalamento_femeaId_fkey"
      FOREIGN KEY ("femeaId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LinhaPlanoAcasalamento_reprodutorEscolhidoId_fkey') THEN
    ALTER TABLE "LinhaPlanoAcasalamento" ADD CONSTRAINT "LinhaPlanoAcasalamento_reprodutorEscolhidoId_fkey"
      FOREIGN KEY ("reprodutorEscolhidoId") REFERENCES "Reprodutor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
