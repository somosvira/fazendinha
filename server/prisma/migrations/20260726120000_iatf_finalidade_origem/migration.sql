-- Finalidade IATF/TETF + identidade de origem para import idempotente.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FinalidadeIATF') THEN
    CREATE TYPE "FinalidadeIATF" AS ENUM ('IATF', 'TETF');
  END IF;
END $$;

ALTER TABLE "ProtocoloIATF"
  ADD COLUMN IF NOT EXISTS "finalidade" "FinalidadeIATF" NOT NULL DEFAULT 'IATF',
  ADD COLUMN IF NOT EXISTS "ideagriId" INTEGER;
ALTER TABLE "ProgramacaoIATFLote" ADD COLUMN IF NOT EXISTS "ideagriId" INTEGER;
ALTER TABLE "AplicacaoProtocoloIATF" ADD COLUMN IF NOT EXISTS "ideagriId" INTEGER;
ALTER TABLE "EventoReprodutivo" ADD COLUMN IF NOT EXISTS "origemExecucaoId" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "ProtocoloIATF_ideagriId_key" ON "ProtocoloIATF"("ideagriId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProgramacaoIATFLote_ideagriId_key" ON "ProgramacaoIATFLote"("ideagriId");
CREATE UNIQUE INDEX IF NOT EXISTS "AplicacaoProtocoloIATF_ideagriId_key" ON "AplicacaoProtocoloIATF"("ideagriId");
CREATE UNIQUE INDEX IF NOT EXISTS "EventoReprodutivo_origemExecucaoId_key" ON "EventoReprodutivo"("origemExecucaoId");
