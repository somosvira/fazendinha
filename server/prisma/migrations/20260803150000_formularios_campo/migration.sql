-- Modelos reutilizáveis e folhas de campo que retornam para lançamento no rebanho.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatusFolhaCampo') THEN
    CREATE TYPE "StatusFolhaCampo" AS ENUM ('RASCUNHO', 'EM_CAMPO', 'AGUARDANDO_LANCAMENTO', 'CONCLUIDA', 'CANCELADA');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatusLinhaFolha') THEN
    CREATE TYPE "StatusLinhaFolha" AS ENUM ('PENDENTE', 'PREENCHIDA', 'NAO_REALIZADO', 'REGISTRADA');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ModeloFormularioCampo" (
  "id" SERIAL NOT NULL,
  "nome" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "config" JSONB NOT NULL,
  "propriedadeId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModeloFormularioCampo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ModeloFormularioCampo_propriedadeId_templateId_idx" ON "ModeloFormularioCampo"("propriedadeId", "templateId");

CREATE TABLE IF NOT EXISTS "FolhaCampo" (
  "id" SERIAL NOT NULL,
  "nome" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "status" "StatusFolhaCampo" NOT NULL DEFAULT 'EM_CAMPO',
  "filtrosSnapshot" JSONB NOT NULL,
  "configSnapshot" JSONB NOT NULL,
  "modeloId" INTEGER,
  "totalLinhas" INTEGER NOT NULL,
  "linhasProntas" INTEGER NOT NULL DEFAULT 0,
  "propriedadeId" INTEGER,
  "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "concluidoEm" TIMESTAMP(3),
  CONSTRAINT "FolhaCampo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FolhaCampo_propriedadeId_status_idx" ON "FolhaCampo"("propriedadeId", "status");
CREATE INDEX IF NOT EXISTS "FolhaCampo_templateId_idx" ON "FolhaCampo"("templateId");

CREATE TABLE IF NOT EXISTS "LinhaFolhaCampo" (
  "id" SERIAL NOT NULL,
  "folhaId" INTEGER NOT NULL,
  "ordem" INTEGER NOT NULL,
  "animalId" INTEGER NOT NULL,
  "eventoOrigemId" INTEGER,
  "snapshot" JSONB NOT NULL,
  "status" "StatusLinhaFolha" NOT NULL DEFAULT 'PENDENTE',
  "respostas" JSONB,
  "motivoNaoRealizado" TEXT,
  "eventoGeradoId" INTEGER,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LinhaFolhaCampo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LinhaFolhaCampo_folhaId_ordem_key" ON "LinhaFolhaCampo"("folhaId", "ordem");
CREATE UNIQUE INDEX IF NOT EXISTS "LinhaFolhaCampo_eventoGeradoId_key" ON "LinhaFolhaCampo"("eventoGeradoId");
CREATE INDEX IF NOT EXISTS "LinhaFolhaCampo_folhaId_status_idx" ON "LinhaFolhaCampo"("folhaId", "status");
CREATE INDEX IF NOT EXISTS "LinhaFolhaCampo_animalId_idx" ON "LinhaFolhaCampo"("animalId");
CREATE INDEX IF NOT EXISTS "LinhaFolhaCampo_eventoOrigemId_idx" ON "LinhaFolhaCampo"("eventoOrigemId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ModeloFormularioCampo_propriedadeId_fkey') THEN
    ALTER TABLE "ModeloFormularioCampo" ADD CONSTRAINT "ModeloFormularioCampo_propriedadeId_fkey"
      FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FolhaCampo_modeloId_fkey') THEN
    ALTER TABLE "FolhaCampo" ADD CONSTRAINT "FolhaCampo_modeloId_fkey"
      FOREIGN KEY ("modeloId") REFERENCES "ModeloFormularioCampo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FolhaCampo_propriedadeId_fkey') THEN
    ALTER TABLE "FolhaCampo" ADD CONSTRAINT "FolhaCampo_propriedadeId_fkey"
      FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LinhaFolhaCampo_folhaId_fkey') THEN
    ALTER TABLE "LinhaFolhaCampo" ADD CONSTRAINT "LinhaFolhaCampo_folhaId_fkey"
      FOREIGN KEY ("folhaId") REFERENCES "FolhaCampo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LinhaFolhaCampo_animalId_fkey') THEN
    ALTER TABLE "LinhaFolhaCampo" ADD CONSTRAINT "LinhaFolhaCampo_animalId_fkey"
      FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LinhaFolhaCampo_eventoOrigemId_fkey') THEN
    ALTER TABLE "LinhaFolhaCampo" ADD CONSTRAINT "LinhaFolhaCampo_eventoOrigemId_fkey"
      FOREIGN KEY ("eventoOrigemId") REFERENCES "EventoReprodutivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LinhaFolhaCampo_eventoGeradoId_fkey') THEN
    ALTER TABLE "LinhaFolhaCampo" ADD CONSTRAINT "LinhaFolhaCampo_eventoGeradoId_fkey"
      FOREIGN KEY ("eventoGeradoId") REFERENCES "EventoReprodutivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
