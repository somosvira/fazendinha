-- Correções conservam o vínculo original; a regularização é explícita e auditada.
ALTER TABLE "pecuaria"."TarefaIatf"
  ADD COLUMN "regularizacaoPendente" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "historicoRegularizacao" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "pecuaria"."ParticipanteVisita"
  ADD COLUMN "versaoRascunho" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "regularizacaoPendente" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "historicoRegularizacao" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "pecuaria"."ParticipanteVisita"
  ADD CONSTRAINT "ParticipanteVisita_versaoRascunho_nao_negativa"
  CHECK ("versaoRascunho" >= 0);
