BEGIN;
ALTER TABLE pecuaria."TipoExame" ADD COLUMN "versaoAnteriorId" TEXT REFERENCES pecuaria."TipoExame"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE pecuaria."TipoExame" ADD CONSTRAINT "TipoExame_versao_check" CHECK ("versaoFormato">0 AND "versaoAnteriorId" IS DISTINCT FROM id);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pecuaria."ParticipanteVisita" WHERE "tarefaSanitariaId" IS NOT NULL AND "tarefaIatfId" IS NOT NULL)
 THEN RAISE EXCEPTION 'Participante com duas tarefas; concilie a origem antes da migração'; END IF;
END $$;
ALTER TABLE pecuaria."ParticipanteVisita" ADD COLUMN "tarefaId" TEXT REFERENCES pecuaria."TarefaProtocolo"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
UPDATE pecuaria."ParticipanteVisita" SET "tarefaId"=COALESCE("tarefaSanitariaId","tarefaIatfId");
ALTER TABLE pecuaria."ParticipanteVisita" DROP COLUMN "tarefaSanitariaId", DROP COLUMN "tarefaIatfId";
CREATE INDEX "ParticipanteVisita_tarefaId_idx" ON pecuaria."ParticipanteVisita"("tarefaId");
COMMIT;
