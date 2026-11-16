ALTER TABLE pecuaria."RegraSanitariaReprodutiva" ADD COLUMN "impactoProtocolar" jsonb;
ALTER TABLE pecuaria."RegraSanitariaReprodutiva" ADD CONSTRAINT "RegraSanitariaReprodutiva_impacto_versionado" CHECK ("impactoProtocolar" IS NULL OR (
 jsonb_typeof("impactoProtocolar")='object' AND "impactoProtocolar"->>'versao'='1' AND "impactoProtocolar"->>'gatilho' = 'OCORRENCIA' AND "impactoProtocolar"->>'efeito' IN ('AVISAR','BLOQUEAR','RETIRAR') AND
 (("impactoProtocolar"->>'gatilho'='OCORRENCIA' AND NOT ("impactoProtocolar" ? 'tipoAplicacaoId')) )
) IS TRUE);
ALTER TABLE pecuaria."ParticipacaoProtocolo" ADD COLUMN "bloqueadaEm" timestamp(3), ADD COLUMN "motivoBloqueio" text, ADD COLUMN "impactoSnapshot" jsonb;
ALTER TABLE pecuaria."ParticipacaoProtocolo" ADD CONSTRAINT "ParticipacaoProtocolo_bloqueio_operacional" CHECK (("bloqueadaEm" IS NULL AND "motivoBloqueio" IS NULL) OR ("bloqueadaEm" IS NOT NULL AND "motivoBloqueio" IS NOT NULL AND length(btrim("motivoBloqueio")) BETWEEN 5 AND 1000 AND "impactoSnapshot" IS NOT NULL));
