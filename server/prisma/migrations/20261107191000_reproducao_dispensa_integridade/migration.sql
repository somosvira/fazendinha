ALTER TABLE pecuaria."EventoTarefaProtocolo" DROP CONSTRAINT "EventoTarefaProtocolo_formato_check";
ALTER TABLE pecuaria."EventoTarefaProtocolo" ADD CONSTRAINT "EventoTarefaProtocolo_formato_check" CHECK (
 (tipo::text = 'ADIAMENTO' AND "previsaoAnterior" IS NOT NULL AND "previsaoNova" IS NOT NULL AND "precisaoAnterior" IS NOT NULL AND "precisaoNova" IS NOT NULL AND "eventoCorrigidoId" IS NULL)
 OR (tipo::text IN ('NAO_ATENDIDO','DISPENSA') AND "previsaoAnterior" IS NULL AND "previsaoNova" IS NULL AND "precisaoAnterior" IS NULL AND "precisaoNova" IS NULL AND "eventoCorrigidoId" IS NULL)
 OR (tipo::text = 'RETIFICACAO_JUSTIFICATIVA' AND "previsaoAnterior" IS NULL AND "previsaoNova" IS NULL AND "precisaoAnterior" IS NULL AND "precisaoNova" IS NULL AND "eventoCorrigidoId" IS NOT NULL)
);
CREATE UNIQUE INDEX "EventoTarefaProtocolo_dispensa_unica" ON pecuaria."EventoTarefaProtocolo" ("tarefaId") WHERE tipo = 'DISPENSA';
