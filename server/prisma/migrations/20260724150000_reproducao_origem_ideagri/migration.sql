-- Preserva 1:1 os cinco fatos de REPRODUCAO do IDEAGRI e a origem da TE.
-- A aplicação em produção usa `prisma db push`; o SQL também documenta/aplica a
-- evolução em ambientes que usam migrate deploy.
ALTER TYPE "TipoEventoReprodutivo" ADD VALUE IF NOT EXISTS 'COBERTURA';
ALTER TYPE "TipoEventoReprodutivo" ADD VALUE IF NOT EXISTS 'TRANSFERENCIA_EMBRIAO';
ALTER TYPE "TipoEventoReprodutivo" ADD VALUE IF NOT EXISTS 'EXAME_GINECOLOGICO';
ALTER TYPE "TipoEventoReprodutivo" ADD VALUE IF NOT EXISTS 'DESMAME';

ALTER TABLE "Animal"
  ADD COLUMN IF NOT EXISTS "ehReceptora" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "EventoReprodutivo"
  ADD COLUMN IF NOT EXISTS "ideagriId" INTEGER,
  ADD COLUMN IF NOT EXISTS "ideagriEmbriaoId" INTEGER,
  ADD COLUMN IF NOT EXISTS "doadoraNumero" TEXT,
  ADD COLUMN IF NOT EXISTS "doadoraNome" TEXT,
  ADD COLUMN IF NOT EXISTS "doadoraId" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "EventoReprodutivo_ideagriId_key"
  ON "EventoReprodutivo"("ideagriId");
CREATE INDEX IF NOT EXISTS "EventoReprodutivo_ideagriEmbriaoId_idx"
  ON "EventoReprodutivo"("ideagriEmbriaoId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'EventoReprodutivo_doadoraId_fkey'
  ) THEN
    ALTER TABLE "EventoReprodutivo"
      ADD CONSTRAINT "EventoReprodutivo_doadoraId_fkey"
      FOREIGN KEY ("doadoraId") REFERENCES "Animal"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
