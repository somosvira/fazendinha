BEGIN;
ALTER TABLE pecuaria."ParticipacaoProtocolo" ADD COLUMN "precisaoInicioEfetivo" pecuaria."PrecisaoCalendarioProtocolo";
ALTER TABLE pecuaria."TarefaProtocolo" ADD COLUMN "precisaoRealizacao" pecuaria."PrecisaoCalendarioProtocolo", ADD COLUMN "previsaoPendente" BOOLEAN NOT NULL DEFAULT FALSE;
-- Existing operational instants retain their original precision; no timestamps rewritten.
UPDATE pecuaria."ParticipacaoProtocolo" SET "precisaoInicioEfetivo"="precisaoTemporal" WHERE "inicioEfetivo" IS NOT NULL;
UPDATE pecuaria."TarefaProtocolo" SET "precisaoRealizacao"="precisaoTemporal" WHERE "realizadaEm" IS NOT NULL;
ALTER TABLE pecuaria."ParticipacaoProtocolo" ADD CONSTRAINT "ParticipacaoProtocolo_inicio_efetivo_precisao_check" CHECK ("precisaoInicioEfetivo" IS DISTINCT FROM 'DIA' OR "inicioEfetivo"=date_trunc('day',"inicioEfetivo"));
ALTER TABLE pecuaria."TarefaProtocolo" ADD CONSTRAINT "TarefaProtocolo_realizacao_precisao_check" CHECK ("precisaoRealizacao" IS DISTINCT FROM 'DIA' OR "realizadaEm"=date_trunc('day',"realizadaEm"));
ALTER TABLE pecuaria."TarefaProtocolo" ADD CONSTRAINT "TarefaProtocolo_previsao_pendente_check" CHECK (NOT "previsaoPendente" OR "precisaoTemporal"='DIA');
CREATE OR REPLACE VIEW pecuaria."ProgramacaoIatf" AS SELECT p.id,p."referenciaExterna",p."propriedadeId",p."protocoloId",p.nome,p."inicioReferencia" AS "inicioPrevisto",p.status,p."criadoEm",p."criadoPorId",p."precisaoTemporal" FROM pecuaria."ProgramacaoProtocolo" p JOIN pecuaria."Protocolo" v ON v.id=p."protocoloId" WHERE v.tipo='REPRODUTIVO';
CREATE OR REPLACE VIEW pecuaria."ParticipanteIatf" AS SELECT p.id,p."referenciaExterna",p."programacaoId",p."animalId",p."inicioReferencia" AS "inicioPrevisto",p."inicioEfetivo",p."canceladaEm" AS "encerradoEm",p."motivoCancelamento" AS "motivoEncerramento",p."criadoEm",p."criadoPorId",p."precisaoTemporal",p."precisaoInicioEfetivo" FROM pecuaria."ParticipacaoProtocolo" p JOIN pecuaria."Protocolo" v ON v.id=p."protocoloId" WHERE v.tipo='REPRODUTIVO';
CREATE OR REPLACE VIEW pecuaria."TarefaIatf" AS SELECT t.id,t."participacaoId" AS "participanteId",e.ordem-1 AS etapa,CASE WHEN e.tipo='EXAME' AND e.configuracao->>'tipo'='AVALIACAO' THEN 'AVALIACAO' ELSE e.tipo END AS tipo,COALESCE(t."nomeSnapshot",e.nome) AS nome,t."previstaEm",COALESCE(t."previsaoOriginal",t."previstaEm") AS "previsaoOriginal",t."realizadaEm",t."dispensadaEm",t.motivo,
 CASE WHEN t."realizadaEm" IS NOT NULL OR t."regularizacaoPendente" THEN v."aplicacaoId" END AS "aplicacaoId",
 CASE WHEN t."realizadaEm" IS NOT NULL OR t."regularizacaoPendente" THEN v."tentativaId" END AS "tentativaId",
 CASE WHEN t."realizadaEm" IS NOT NULL OR t."regularizacaoPendente" THEN i.id END AS "avaliacaoId",
 CASE WHEN (t."realizadaEm" IS NOT NULL OR t."regularizacaoPendente") AND i.id IS NULL THEN v."exameId" END AS "exameId",
 t."historicoReprogramacao",t."planejadoSnapshot",t."realizadoSnapshot",t."desviosSnapshot",t."regularizacaoPendente",t."historicoRegularizacao",t."precisaoTemporal",t."precisaoRealizacao",t."previsaoPendente"
 FROM pecuaria."TarefaProtocolo" t JOIN pecuaria."ParticipacaoProtocolo" a ON a.id=t."participacaoId" JOIN pecuaria."Protocolo" p ON p.id=a."protocoloId" JOIN pecuaria."EtapaProtocolo" e ON e.id=t."etapaId"
 LEFT JOIN LATERAL (SELECT l.* FROM pecuaria."VinculoTarefaProtocolo" l WHERE l."tarefaId"=t.id ORDER BY (l.estado='ATUAL') DESC,l.ordem DESC LIMIT 1) v ON TRUE
 LEFT JOIN pecuaria."InterpretacaoReprodutiva" i ON i."exameId"=v."exameId"
 WHERE p.tipo='REPRODUTIVO';
COMMIT;
