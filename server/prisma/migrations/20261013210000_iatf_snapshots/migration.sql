-- Ausência de snapshot anterior permanece desconhecida, nunca é convertida em conformidade.
ALTER TABLE "pecuaria"."TarefaIatf"
  ADD COLUMN "planejadoSnapshot" JSONB,
  ADD COLUMN "realizadoSnapshot" JSONB,
  ADD COLUMN "desviosSnapshot" JSONB;
