-- Legado permanece com confirmação, inclusive modoAtendimento AUTOMATIZADA.
ALTER TABLE pecuaria."MomentoProtocolo"
 ADD COLUMN "politicaExecucao" TEXT NOT NULL DEFAULT 'CONFIRMACAO_OBRIGATORIA',
 ADD COLUMN "horarioPadrao" TEXT,
 ADD COLUMN "fusoHorario" TEXT,
 ADD CONSTRAINT "MomentoProtocolo_politicaExecucao_check" CHECK ("politicaExecucao" IN ('CONFIRMACAO_OBRIGATORIA','AUTOMATICA_EXCECAO')),
 ADD CONSTRAINT "MomentoProtocolo_horarioPadrao_check" CHECK ("horarioPadrao" IS NULL OR "horarioPadrao" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 ADD CONSTRAINT "MomentoProtocolo_automacao_horario_check" CHECK ("politicaExecucao" <> 'AUTOMATICA_EXCECAO' OR ("horarioPadrao" IS NOT NULL AND "fusoHorario" IS NOT NULL));
ALTER TABLE pecuaria."InterpretacaoReprodutiva" ADD COLUMN "decisaoIatf" TEXT,
 ADD CONSTRAINT "InterpretacaoReprodutiva_decisaoIatf_check" CHECK ("decisaoIatf" IS NULL OR "decisaoIatf" IN ('INDICAR','NAO_INDICAR'));

CREATE TABLE pecuaria."AutomacaoProtocolo" (
  "id" TEXT PRIMARY KEY,
  "participacaoId" TEXT NOT NULL REFERENCES pecuaria."ParticipacaoProtocolo"("id") ON DELETE RESTRICT,
  "momentoId" TEXT NOT NULL REFERENCES pecuaria."MomentoProtocolo"("id") ON DELETE RESTRICT,
  "propriedadeId" INTEGER NOT NULL REFERENCES public."Propriedade"("id") ON DELETE RESTRICT,
  "usuarioId" INTEGER NOT NULL REFERENCES public."Usuario"("id") ON DELETE RESTRICT,
  "estado" TEXT NOT NULL DEFAULT 'AGENDADA' CHECK ("estado" IN ('AGENDADA','EXECUTADA','FALHOU','CANCELADA','REVERTIDA')),
  "programadaPara" TIMESTAMP(3) NOT NULL,
  "configuracao" JSONB NOT NULL,
  "resultado" JSONB,
  "erro" TEXT,
  "tentativas" INTEGER NOT NULL DEFAULT 0 CHECK ("tentativas" >= 0),
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadaEm" TIMESTAMP(3) NOT NULL,
  "executadaEm" TIMESTAMP(3),
  CONSTRAINT "AutomacaoProtocolo_participacaoId_momentoId_key" UNIQUE ("participacaoId", "momentoId")
);
CREATE INDEX "AutomacaoProtocolo_estado_programadaPara_idx" ON pecuaria."AutomacaoProtocolo"("estado", "programadaPara");
