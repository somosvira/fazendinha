BEGIN;
CREATE TYPE pecuaria."OrigemCalendarioProtocolo" AS ENUM ('REFERENCIA_PROGRAMADA', 'INICIO_EFETIVO_LEGADO');
CREATE TYPE pecuaria."TipoEventoTarefaProtocolo" AS ENUM ('NAO_ATENDIDO', 'ADIAMENTO', 'RETIFICACAO_JUSTIFICATIVA');
ALTER TABLE pecuaria."ParticipacaoProtocolo" ADD COLUMN "origemCalendario" pecuaria."OrigemCalendarioProtocolo";
-- Somente classifica a regra histórica. Não recalcula nenhuma data, precisão ou snapshot.
UPDATE pecuaria."ParticipacaoProtocolo" p SET "origemCalendario" =
  CASE WHEN v.tipo = 'REPRODUTIVO' THEN 'INICIO_EFETIVO_LEGADO'::pecuaria."OrigemCalendarioProtocolo"
       ELSE 'REFERENCIA_PROGRAMADA'::pecuaria."OrigemCalendarioProtocolo" END
FROM pecuaria."Protocolo" v WHERE v.id = p."protocoloId";
-- Triggers de constraint existentes podem ser diferidos; esvaziar eventos antes do ALTER.
SET CONSTRAINTS ALL IMMEDIATE;
ALTER TABLE pecuaria."ParticipacaoProtocolo" ALTER COLUMN "origemCalendario" SET NOT NULL,
  ALTER COLUMN "origemCalendario" SET DEFAULT 'REFERENCIA_PROGRAMADA';
CREATE TABLE pecuaria."EventoTarefaProtocolo" (
  id TEXT NOT NULL PRIMARY KEY,
  "tarefaId" TEXT NOT NULL REFERENCES pecuaria."TarefaProtocolo"(id) ON DELETE RESTRICT,
  tipo pecuaria."TipoEventoTarefaProtocolo" NOT NULL,
  "ocorridaEm" TIMESTAMP(3) NOT NULL,
  motivo TEXT NOT NULL,
  "previsaoAnterior" TIMESTAMP(3), "previsaoNova" TIMESTAMP(3),
  "precisaoAnterior" pecuaria."PrecisaoCalendarioProtocolo", "precisaoNova" pecuaria."PrecisaoCalendarioProtocolo",
  "eventoCorrigidoId" TEXT REFERENCES pecuaria."EventoTarefaProtocolo"(id) ON DELETE RESTRICT,
  "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "registradoPorId" INTEGER REFERENCES public."Usuario"(id) ON DELETE RESTRICT,
  CONSTRAINT "EventoTarefaProtocolo_motivo_check" CHECK (length(btrim(motivo)) BETWEEN 5 AND 1000),
  CONSTRAINT "EventoTarefaProtocolo_formato_check" CHECK (
    (tipo = 'ADIAMENTO' AND "previsaoAnterior" IS NOT NULL AND "previsaoNova" IS NOT NULL AND "precisaoAnterior" IS NOT NULL AND "precisaoNova" IS NOT NULL AND "eventoCorrigidoId" IS NULL)
    OR (tipo = 'NAO_ATENDIDO' AND "previsaoAnterior" IS NULL AND "previsaoNova" IS NULL AND "precisaoAnterior" IS NULL AND "precisaoNova" IS NULL AND "eventoCorrigidoId" IS NULL)
    OR (tipo = 'RETIFICACAO_JUSTIFICATIVA' AND "previsaoAnterior" IS NULL AND "previsaoNova" IS NULL AND "precisaoAnterior" IS NULL AND "precisaoNova" IS NULL AND "eventoCorrigidoId" IS NOT NULL)
  )
);
CREATE INDEX "EventoTarefaProtocolo_tarefaId_registradoEm_id_idx" ON pecuaria."EventoTarefaProtocolo"("tarefaId", "registradoEm", id);
CREATE INDEX "EventoTarefaProtocolo_eventoCorrigidoId_idx" ON pecuaria."EventoTarefaProtocolo"("eventoCorrigidoId");
CREATE INDEX "EventoTarefaProtocolo_registradoPorId_idx" ON pecuaria."EventoTarefaProtocolo"("registradoPorId");
CREATE FUNCTION pecuaria.validar_evento_tarefa_protocolo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'Evento operacional imutável; registre uma retificação' USING ERRCODE = '23514'; END IF;
  IF NEW."eventoCorrigidoId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pecuaria."EventoTarefaProtocolo" e WHERE e.id = NEW."eventoCorrigidoId" AND e."tarefaId" = NEW."tarefaId" AND e.tipo <> 'RETIFICACAO_JUSTIFICATIVA'
  ) THEN RAISE EXCEPTION 'Retificação exige evento operacional da mesma tarefa' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "EventoTarefaProtocolo_validar" BEFORE INSERT OR UPDATE ON pecuaria."EventoTarefaProtocolo"
  FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_evento_tarefa_protocolo();
COMMIT;
