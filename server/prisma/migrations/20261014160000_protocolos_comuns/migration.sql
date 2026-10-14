BEGIN;
LOCK TABLE pecuaria."ProtocoloSanitario",pecuaria."EtapaProtocoloSanitario",pecuaria."RodadaProtocoloSanitario",pecuaria."ExecucaoProtocoloSanitario",pecuaria."TarefaSanitaria",pecuaria."ProtocoloIatf",pecuaria."ProgramacaoIatf",pecuaria."ParticipanteIatf",pecuaria."TarefaIatf" IN ACCESS EXCLUSIVE MODE;
CREATE TYPE pecuaria."TipoProtocolo" AS ENUM ('SANITARIO','REPRODUTIVO');
CREATE TYPE pecuaria."PrecisaoCalendarioProtocolo" AS ENUM ('DIA','HORA');

-- Mapas persistem em legadoIatfId; os temporários servem à conferência e às FKs da conversão.
CREATE TEMP TABLE mapa_protocolo ON COMMIT DROP AS SELECT i.id AS antigo, CASE WHEN s.id IS NULL THEN i.id ELSE gen_random_uuid()::text END AS novo FROM pecuaria."ProtocoloIatf" i LEFT JOIN pecuaria."ProtocoloSanitario" s ON s.id=i.id;
CREATE TEMP TABLE mapa_programacao ON COMMIT DROP AS SELECT i.id AS antigo, CASE WHEN s.id IS NULL THEN i.id ELSE gen_random_uuid()::text END AS novo FROM pecuaria."ProgramacaoIatf" i LEFT JOIN pecuaria."RodadaProtocoloSanitario" s ON s.id=i.id;
CREATE TEMP TABLE mapa_participacao ON COMMIT DROP AS SELECT i.id AS antigo, CASE WHEN s.id IS NULL THEN i.id ELSE gen_random_uuid()::text END AS novo FROM pecuaria."ParticipanteIatf" i LEFT JOIN pecuaria."ExecucaoProtocoloSanitario" s ON s.id=i.id;
CREATE TEMP TABLE mapa_tarefa ON COMMIT DROP AS SELECT i.id AS antigo, CASE WHEN s.id IS NULL THEN i.id ELSE gen_random_uuid()::text END AS novo FROM pecuaria."TarefaIatf" i LEFT JOIN pecuaria."TarefaSanitaria" s ON s.id=i.id;
CREATE TEMP TABLE etapas_iatf ON COMMIT DROP AS SELECT gen_random_uuid()::text AS id, i.id AS protocolo_antigo, e.ordinality::integer AS ordem, e.valor FROM pecuaria."ProtocoloIatf" i CROSS JOIN LATERAL jsonb_array_elements(i.etapas) WITH ORDINALITY AS e(valor,ordinality);
CREATE TEMP TABLE tarefas_iatf_antes ON COMMIT DROP AS TABLE pecuaria."TarefaIatf";
CREATE TEMP TABLE protocolos_iatf_antes ON COMMIT DROP AS TABLE pecuaria."ProtocoloIatf";
CREATE TEMP TABLE programacoes_iatf_antes ON COMMIT DROP AS TABLE pecuaria."ProgramacaoIatf";
CREATE TEMP TABLE participantes_iatf_antes ON COMMIT DROP AS TABLE pecuaria."ParticipanteIatf";
CREATE TEMP TABLE contagens_protocolos ON COMMIT DROP AS SELECT
 (SELECT count(*) FROM pecuaria."ProtocoloSanitario")+(SELECT count(*) FROM pecuaria."ProtocoloIatf") AS protocolos,
 (SELECT count(*) FROM pecuaria."EtapaProtocoloSanitario")+(SELECT count(*) FROM etapas_iatf) AS etapas,
 (SELECT count(*) FROM pecuaria."RodadaProtocoloSanitario")+(SELECT count(*) FROM pecuaria."ProgramacaoIatf") AS programacoes,
 (SELECT count(*) FROM pecuaria."ExecucaoProtocoloSanitario")+(SELECT count(*) FROM pecuaria."ParticipanteIatf") AS participacoes,
 (SELECT count(*) FROM pecuaria."TarefaSanitaria")+(SELECT count(*) FROM pecuaria."TarefaIatf") AS tarefas;

ALTER TABLE pecuaria."ProtocoloSanitario" RENAME TO "Protocolo";
ALTER TABLE pecuaria."EtapaProtocoloSanitario" RENAME TO "EtapaProtocolo";
ALTER TABLE pecuaria."RodadaProtocoloSanitario" RENAME TO "ProgramacaoProtocolo";
ALTER TABLE pecuaria."ExecucaoProtocoloSanitario" RENAME TO "ParticipacaoProtocolo";
ALTER TABLE pecuaria."TarefaSanitaria" RENAME TO "TarefaProtocolo";
ALTER TABLE pecuaria."Protocolo" ADD COLUMN tipo pecuaria."TipoProtocolo" NOT NULL DEFAULT 'SANITARIO', ADD COLUMN publicado BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN "legadoIatfId" TEXT UNIQUE, ADD COLUMN "criadoPorId" INTEGER REFERENCES public."Usuario"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
UPDATE pecuaria."Protocolo" SET publicado=("publicadoEm" IS NOT NULL);
DROP INDEX pecuaria."ProtocoloSanitario_nome_versao_key";
CREATE UNIQUE INDEX "Protocolo_tipo_nome_versao_key" ON pecuaria."Protocolo"(tipo,nome,versao);
INSERT INTO pecuaria."Protocolo" (id,"legadoIatfId",tipo,nome,versao,publicado,"criadoEm","atualizadoEm","criadoPorId")
 SELECT m.novo,i.id,'REPRODUTIVO',i.nome,i.versao,i.publicado,i."criadoEm",i."criadoEm",i."criadoPorId" FROM pecuaria."ProtocoloIatf" i JOIN mapa_protocolo m ON m.antigo=i.id;

ALTER TABLE pecuaria."EtapaProtocolo" RENAME COLUMN "diaRelativo" TO intervalo;
ALTER TABLE pecuaria."EtapaProtocolo" ALTER COLUMN intervalo TYPE DOUBLE PRECISION;
ALTER TABLE pecuaria."EtapaProtocolo" ADD COLUMN nome TEXT NOT NULL DEFAULT 'Etapa', ADD COLUMN "unidadeIntervalo" TEXT NOT NULL DEFAULT 'DIAS', ADD COLUMN configuracao JSONB NOT NULL DEFAULT '{}', ADD COLUMN "materialId" TEXT REFERENCES pecuaria."MaterialGenetico"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
INSERT INTO pecuaria."EtapaProtocolo" (id,"protocoloId",ordem,nome,intervalo,"unidadeIntervalo",tipo,"produtoId","tipoExameId",dose,unidade,via,"materialId",configuracao)
 SELECT e.id,m.novo,e.ordem,e.valor->>'nome',(e.valor->>'intervalo')::double precision,e.valor->>'unidade',
 CASE WHEN e.valor->>'tipo'='AVALIACAO' THEN 'EXAME' ELSE e.valor->>'tipo' END,
 e.valor#>>'{planoAplicacao,produtoId}',CASE WHEN e.valor->>'tipo'='AVALIACAO' THEN 'b0400000-0000-4000-8000-000000000001' ELSE e.valor#>>'{planoExame,tipoExameId}' END,
 (e.valor#>>'{planoAplicacao,dose}')::numeric,e.valor#>>'{planoAplicacao,unidadeDose}',e.valor#>>'{planoAplicacao,via}',e.valor#>>'{planoTentativa,materialId}',e.valor
 FROM etapas_iatf e JOIN mapa_protocolo m ON m.antigo=e.protocolo_antigo;

ALTER TABLE pecuaria."ProgramacaoProtocolo" ALTER COLUMN "inicioReferencia" TYPE TIMESTAMP(3) USING "inicioReferencia"::timestamp;
ALTER TABLE pecuaria."ProgramacaoProtocolo" ADD COLUMN "legadoIatfId" TEXT UNIQUE, ADD COLUMN "referenciaExterna" TEXT UNIQUE, ADD COLUMN "precisaoTemporal" pecuaria."PrecisaoCalendarioProtocolo" NOT NULL DEFAULT 'DIA', ADD COLUMN status TEXT NOT NULL DEFAULT 'ABERTA', ADD COLUMN "criadoPorId" INTEGER REFERENCES public."Usuario"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
INSERT INTO pecuaria."ProgramacaoProtocolo" (id,"legadoIatfId","referenciaExterna","protocoloId","propriedadeId",nome,"inicioReferencia","precisaoTemporal",status,"criadoEm","atualizadoEm","criadoPorId")
 SELECT m.novo,i.id,i."referenciaExterna",p.novo,i."propriedadeId",i.nome,i."inicioPrevisto",'HORA',i.status,i."criadoEm",i."criadoEm",i."criadoPorId" FROM pecuaria."ProgramacaoIatf" i JOIN mapa_programacao m ON m.antigo=i.id JOIN mapa_protocolo p ON p.antigo=i."protocoloId";
ALTER TABLE pecuaria."ParticipacaoProtocolo" RENAME COLUMN "rodadaId" TO "programacaoId";
ALTER TABLE pecuaria."ParticipacaoProtocolo" RENAME COLUMN inicio TO "inicioReferencia";
ALTER TABLE pecuaria."ParticipacaoProtocolo" ALTER COLUMN "inicioReferencia" TYPE TIMESTAMP(3) USING "inicioReferencia"::timestamp;
ALTER TABLE pecuaria."ParticipacaoProtocolo" ADD COLUMN "legadoIatfId" TEXT UNIQUE, ADD COLUMN "referenciaExterna" TEXT UNIQUE, ADD COLUMN "precisaoTemporal" pecuaria."PrecisaoCalendarioProtocolo" NOT NULL DEFAULT 'DIA', ADD COLUMN "inicioEfetivo" TIMESTAMP(3), ADD COLUMN "criadoPorId" INTEGER REFERENCES public."Usuario"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
INSERT INTO pecuaria."ParticipacaoProtocolo" (id,"legadoIatfId","referenciaExterna","programacaoId","protocoloId","animalId","propriedadeId","inicioReferencia","precisaoTemporal","inicioEfetivo","canceladaEm","motivoCancelamento","criadoEm","criadoPorId")
 SELECT m.novo,i.id,i."referenciaExterna",g.novo,p."protocoloId",i."animalId",p."propriedadeId",i."inicioPrevisto",'HORA',i."inicioEfetivo",i."encerradoEm",i."motivoEncerramento",i."criadoEm",i."criadoPorId"
 FROM pecuaria."ParticipanteIatf" i JOIN mapa_participacao m ON m.antigo=i.id JOIN mapa_programacao g ON g.antigo=i."programacaoId" JOIN pecuaria."ProgramacaoProtocolo" p ON p.id=g.novo;

ALTER TABLE pecuaria."TarefaProtocolo" RENAME COLUMN "execucaoId" TO "participacaoId";
ALTER TABLE pecuaria."TarefaProtocolo" RENAME COLUMN "previstaPara" TO "previstaEm";
ALTER TABLE pecuaria."TarefaProtocolo" RENAME COLUMN parametros TO "planejadoSnapshot";
ALTER TABLE pecuaria."TarefaProtocolo" RENAME COLUMN "motivoDispensa" TO motivo;
ALTER TABLE pecuaria."TarefaProtocolo" ALTER COLUMN "previstaEm" TYPE TIMESTAMP(3) USING "previstaEm"::timestamp;
ALTER TABLE pecuaria."TarefaProtocolo" ALTER COLUMN "planejadoSnapshot" DROP NOT NULL;
ALTER TABLE pecuaria."TarefaProtocolo" ADD COLUMN "nomeSnapshot" TEXT, ADD COLUMN "legadoIatfId" TEXT UNIQUE, ADD COLUMN "precisaoTemporal" pecuaria."PrecisaoCalendarioProtocolo" NOT NULL DEFAULT 'DIA', ADD COLUMN "previsaoOriginal" TIMESTAMP(3), ADD COLUMN "realizadaEm" TIMESTAMP(3), ADD COLUMN "historicoReprogramacao" JSONB NOT NULL DEFAULT '[]', ADD COLUMN "realizadoSnapshot" JSONB, ADD COLUMN "desviosSnapshot" JSONB, ADD COLUMN "regularizacaoPendente" BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN "historicoRegularizacao" JSONB NOT NULL DEFAULT '[]';
-- Datas originais sanitárias não são recalculadas; a ausência de previsão original continua explícita.
INSERT INTO pecuaria."TarefaProtocolo" (id,"nomeSnapshot","legadoIatfId","participacaoId","etapaId","previstaEm","precisaoTemporal","previsaoOriginal","realizadaEm","dispensadaEm",motivo,"planejadoSnapshot","realizadoSnapshot","desviosSnapshot","historicoReprogramacao","regularizacaoPendente","historicoRegularizacao")
 SELECT m.novo,i.nome,i.id,p.novo,e.id,i."previstaEm",'HORA',i."previsaoOriginal",i."realizadaEm",i."dispensadaEm",i.motivo,i."planejadoSnapshot",i."realizadoSnapshot",i."desviosSnapshot",i."historicoReprogramacao",i."regularizacaoPendente",i."historicoRegularizacao"
 FROM pecuaria."TarefaIatf" i JOIN mapa_tarefa m ON m.antigo=i.id JOIN mapa_participacao p ON p.antigo=i."participanteId" JOIN pecuaria."ParticipacaoProtocolo" a ON a.id=p.novo JOIN mapa_protocolo pp ON pp.novo=a."protocoloId" JOIN etapas_iatf e ON e.protocolo_antigo=pp.antigo AND e.ordem=i.etapa+1;
ALTER TABLE pecuaria."TentativaReprodutiva" ADD COLUMN "tarefaId" TEXT REFERENCES pecuaria."TarefaProtocolo"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "TentativaReprodutiva_tarefa_valida" ON pecuaria."TentativaReprodutiva"("tarefaId") WHERE status='VALIDO' AND "tarefaId" IS NOT NULL;
-- Uma relação existente incompatível não é sobrescrita silenciosamente.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pecuaria."TarefaIatf" t JOIN mapa_tarefa m ON m.antigo=t.id JOIN pecuaria."AplicacaoProduto" a ON a.id=t."aplicacaoId" WHERE a."tarefaId" IS NOT NULL AND a."tarefaId"<>m.novo)
 OR EXISTS (SELECT 1 FROM pecuaria."TarefaIatf" t JOIN mapa_tarefa m ON m.antigo=t.id JOIN pecuaria."InterpretacaoReprodutiva" i ON i.id=t."avaliacaoId" JOIN pecuaria."ExameAnimal" e ON e.id=i."exameId" WHERE e."tarefaId" IS NOT NULL AND e."tarefaId"<>m.novo)
 THEN RAISE EXCEPTION 'Fato vinculado a tarefas sanitárias e IATF diferentes; concilie os vínculos antes da conversão'; END IF;
END $$;
UPDATE pecuaria."AplicacaoProduto" a SET "tarefaId"=m.novo FROM pecuaria."TarefaIatf" t JOIN mapa_tarefa m ON m.antigo=t.id WHERE a.id=t."aplicacaoId";
UPDATE pecuaria."TentativaReprodutiva" a SET "tarefaId"=m.novo FROM pecuaria."TarefaIatf" t JOIN mapa_tarefa m ON m.antigo=t.id WHERE a.id=t."tentativaId";
UPDATE pecuaria."ExameAnimal" a SET "tarefaId"=m.novo FROM pecuaria."TarefaIatf" t JOIN mapa_tarefa m ON m.antigo=t.id JOIN pecuaria."InterpretacaoReprodutiva" i ON i.id=t."avaliacaoId" WHERE a.id=i."exameId";
ALTER TABLE pecuaria."ParticipanteVisita" DROP CONSTRAINT "ParticipanteVisita_tarefaIatfId_fkey";
UPDATE pecuaria."ParticipanteVisita" p SET "tarefaIatfId"=m.novo FROM mapa_tarefa m WHERE p."tarefaIatfId"=m.antigo;
UPDATE pecuaria."ParticipanteVisita" p SET "fatoId"=m.novo FROM mapa_tarefa m WHERE p."fatoTipo"='TarefaIatf' AND p."fatoId"=m.antigo;
ALTER TABLE pecuaria."ParticipanteVisita" ADD CONSTRAINT "ParticipanteVisita_tarefaIatfId_fkey" FOREIGN KEY ("tarefaIatfId") REFERENCES pecuaria."TarefaProtocolo"(id) ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM contagens_protocolos c WHERE c.protocolos<>(SELECT count(*) FROM pecuaria."Protocolo") OR c.etapas<>(SELECT count(*) FROM pecuaria."EtapaProtocolo") OR c.programacoes<>(SELECT count(*) FROM pecuaria."ProgramacaoProtocolo") OR c.participacoes<>(SELECT count(*) FROM pecuaria."ParticipacaoProtocolo") OR c.tarefas<>(SELECT count(*) FROM pecuaria."TarefaProtocolo"))
 THEN RAISE EXCEPTION 'Contagem de protocolos/etapas/programações/participações/tarefas diverge; conversão revertida'; END IF;
END $$;

CREATE TABLE pecuaria."VinculoTarefaProtocolo" (
 id TEXT PRIMARY KEY, "tarefaId" TEXT NOT NULL REFERENCES pecuaria."TarefaProtocolo"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 ordem INTEGER NOT NULL, "aplicacaoId" TEXT REFERENCES pecuaria."AplicacaoProduto"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "exameId" TEXT REFERENCES pecuaria."ExameAnimal"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "tentativaId" TEXT REFERENCES pecuaria."TentativaReprodutiva"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 estado TEXT NOT NULL DEFAULT 'ATUAL' CHECK (estado IN ('ATUAL','HISTORICO','SUBSTITUIDO','ENCERRADO','REABERTO')),
 origem TEXT NOT NULL DEFAULT 'EXECUCAO', "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "registradoPorId" INTEGER REFERENCES public."Usuario"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "encerradoEm" TIMESTAMP(3), motivo TEXT,
 CHECK (num_nonnulls("aplicacaoId","exameId","tentativaId")=1)
);
CREATE UNIQUE INDEX "VinculoTarefaProtocolo_tarefaId_ordem_key" ON pecuaria."VinculoTarefaProtocolo"("tarefaId",ordem);
CREATE UNIQUE INDEX "VinculoTarefaProtocolo_um_atual" ON pecuaria."VinculoTarefaProtocolo"("tarefaId") WHERE estado='ATUAL';
CREATE INDEX "VinculoTarefaProtocolo_aplicacaoId_idx" ON pecuaria."VinculoTarefaProtocolo"("aplicacaoId");
CREATE INDEX "VinculoTarefaProtocolo_exameId_idx" ON pecuaria."VinculoTarefaProtocolo"("exameId");
CREATE INDEX "VinculoTarefaProtocolo_tentativaId_idx" ON pecuaria."VinculoTarefaProtocolo"("tentativaId");
INSERT INTO pecuaria."VinculoTarefaProtocolo" (id,"tarefaId",ordem,"aplicacaoId","exameId",estado,origem)
 SELECT gen_random_uuid()::text,f.tarefa,row_number() OVER(PARTITION BY f.tarefa ORDER BY f.criado,f.id)::int,f.aplicacao,f.exame,
 CASE WHEN f.status='VALIDO' THEN 'ATUAL' ELSE 'HISTORICO' END,'MIGRACAO_SANIDADE'
 FROM (SELECT a.id,a."tarefaId" AS tarefa,a.id AS aplicacao,NULL::text AS exame,a.status,a."criadoEm" AS criado FROM pecuaria."AplicacaoProduto" a JOIN pecuaria."TarefaProtocolo" t ON t.id=a."tarefaId" WHERE t."legadoIatfId" IS NULL
 UNION ALL SELECT a.id,a."tarefaId",NULL::text,a.id,a.status,a."criadoEm" FROM pecuaria."ExameAnimal" a JOIN pecuaria."TarefaProtocolo" t ON t.id=a."tarefaId" WHERE t."legadoIatfId" IS NULL) f;
INSERT INTO pecuaria."VinculoTarefaProtocolo" (id,"tarefaId",ordem,"aplicacaoId","exameId","tentativaId",estado,origem)
 SELECT gen_random_uuid()::text,m.novo,1,t."aplicacaoId",i."exameId",t."tentativaId",'ATUAL','MIGRACAO_IATF'
 FROM tarefas_iatf_antes t JOIN mapa_tarefa m ON m.antigo=t.id LEFT JOIN pecuaria."InterpretacaoReprodutiva" i ON i.id=t."avaliacaoId"
 WHERE num_nonnulls(t."aplicacaoId",t."avaliacaoId",t."tentativaId")>0;


-- Relações anteriores à substituição/reabertura também são preservadas, sem relançar fatos.
CREATE TEMP TABLE historico_vinculos_iatf ON COMMIT DROP AS
WITH eventos AS (
 SELECT t.id,e.evento,e.ordem FROM tarefas_iatf_antes t CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(t."historicoRegularizacao")='array' THEN t."historicoRegularizacao" ELSE '[]'::jsonb END) WITH ORDINALITY e(evento,ordem)
), referencias AS (
 SELECT id,'APLICACAO' AS tipo,evento#>>'{anterior,aplicacaoId}' AS fato FROM eventos UNION
 SELECT id,'AVALIACAO',evento#>>'{anterior,avaliacaoId}' FROM eventos UNION
 SELECT id,'TENTATIVA',evento#>>'{anterior,tentativaId}' FROM eventos UNION
 SELECT id,evento->>'fatoTipo',evento->>'fatoId' FROM eventos WHERE evento->>'acao'='FATO_ANULADO'
), existentes AS (
 SELECT DISTINCT m.novo AS tarefa,a.id AS aplicacao,NULL::text AS exame,NULL::text AS tentativa FROM referencias r JOIN mapa_tarefa m ON m.antigo=r.id JOIN pecuaria."AplicacaoProduto" a ON r.tipo='APLICACAO' AND a.id=r.fato UNION
 SELECT DISTINCT m.novo,NULL::text,a."exameId",NULL::text FROM referencias r JOIN mapa_tarefa m ON m.antigo=r.id JOIN pecuaria."InterpretacaoReprodutiva" a ON r.tipo='AVALIACAO' AND a.id=r.fato UNION
 SELECT DISTINCT m.novo,NULL::text,NULL::text,a.id FROM referencias r JOIN mapa_tarefa m ON m.antigo=r.id JOIN pecuaria."TentativaReprodutiva" a ON r.tipo='TENTATIVA' AND a.id=r.fato
)
SELECT e.* FROM existentes e WHERE NOT EXISTS (SELECT 1 FROM pecuaria."VinculoTarefaProtocolo" v WHERE v."tarefaId"=e.tarefa AND v."aplicacaoId" IS NOT DISTINCT FROM e.aplicacao AND v."exameId" IS NOT DISTINCT FROM e.exame AND v."tentativaId" IS NOT DISTINCT FROM e.tentativa);
INSERT INTO pecuaria."VinculoTarefaProtocolo" (id,"tarefaId",ordem,"aplicacaoId","exameId","tentativaId",estado,origem)
 SELECT gen_random_uuid()::text,h.tarefa,-row_number() OVER(PARTITION BY h.tarefa ORDER BY COALESCE(h.aplicacao,h.exame,h.tentativa))::int,h.aplicacao,h.exame,h.tentativa,'HISTORICO','MIGRACAO_IATF_HISTORICO' FROM historico_vinculos_iatf h;
UPDATE pecuaria."AplicacaoProduto" a SET "tarefaId"=h.tarefa FROM historico_vinculos_iatf h WHERE a.id=h.aplicacao AND a."tarefaId" IS NULL;
UPDATE pecuaria."ExameAnimal" a SET "tarefaId"=h.tarefa FROM historico_vinculos_iatf h WHERE a.id=h.exame AND a."tarefaId" IS NULL;
UPDATE pecuaria."TentativaReprodutiva" a SET "tarefaId"=h.tarefa FROM historico_vinculos_iatf h WHERE a.id=h.tentativa AND a."tarefaId" IS NULL;


UPDATE pecuaria."VinculoImportacaoPecuaria" v SET "destinoId"=m.novo FROM mapa_protocolo m WHERE v."entidadeDestino"='ProtocoloIatf' AND v."destinoId"=m.antigo;
UPDATE pecuaria."VinculoImportacaoPecuaria" v SET "destinoId"=m.novo FROM mapa_programacao m WHERE v."entidadeDestino"='ProgramacaoIatf' AND v."destinoId"=m.antigo;
UPDATE pecuaria."VinculoImportacaoPecuaria" v SET "destinoId"=m.novo FROM mapa_participacao m WHERE v."entidadeDestino"='ParticipanteIatf' AND v."destinoId"=m.antigo;
UPDATE pecuaria."VinculoImportacaoPecuaria" v SET "destinoId"=m.novo FROM mapa_tarefa m WHERE v."entidadeDestino"='TarefaIatf' AND v."destinoId"=m.antigo;

DROP TABLE pecuaria."TarefaIatf";
DROP TABLE pecuaria."ParticipanteIatf";
DROP TABLE pecuaria."ProgramacaoIatf";
DROP TABLE pecuaria."ProtocoloIatf";

-- Projeções para leitura de contratos anteriores, sem armazenamento nem escrita independente.
CREATE VIEW pecuaria."ProtocoloIatf" AS SELECT p.id,p.nome,p.versao,p.publicado,COALESCE((SELECT jsonb_agg(e.configuracao ORDER BY e.ordem) FROM pecuaria."EtapaProtocolo" e WHERE e."protocoloId"=p.id),'[]'::jsonb) AS etapas,p."criadoEm",p."criadoPorId" FROM pecuaria."Protocolo" p WHERE p.tipo='REPRODUTIVO' OFFSET 0;
CREATE VIEW pecuaria."ProgramacaoIatf" AS SELECT p.id,p."referenciaExterna",p."propriedadeId",p."protocoloId",p.nome,p."inicioReferencia" AS "inicioPrevisto",p.status,p."criadoEm",p."criadoPorId" FROM pecuaria."ProgramacaoProtocolo" p JOIN pecuaria."Protocolo" v ON v.id=p."protocoloId" WHERE v.tipo='REPRODUTIVO';
CREATE VIEW pecuaria."ParticipanteIatf" AS SELECT p.id,p."referenciaExterna",p."programacaoId",p."animalId",p."inicioReferencia" AS "inicioPrevisto",p."inicioEfetivo",p."canceladaEm" AS "encerradoEm",p."motivoCancelamento" AS "motivoEncerramento",p."criadoEm",p."criadoPorId" FROM pecuaria."ParticipacaoProtocolo" p JOIN pecuaria."Protocolo" v ON v.id=p."protocoloId" WHERE v.tipo='REPRODUTIVO';
CREATE VIEW pecuaria."TarefaIatf" AS SELECT t.id,t."participacaoId" AS "participanteId",e.ordem-1 AS etapa,CASE WHEN e.tipo='EXAME' AND e.configuracao->>'tipo'='AVALIACAO' THEN 'AVALIACAO' ELSE e.tipo END AS tipo,COALESCE(t."nomeSnapshot",e.nome) AS nome,t."previstaEm",COALESCE(t."previsaoOriginal",t."previstaEm") AS "previsaoOriginal",t."realizadaEm",t."dispensadaEm",t.motivo,
 CASE WHEN t."realizadaEm" IS NOT NULL OR t."regularizacaoPendente" THEN v."aplicacaoId" END AS "aplicacaoId",
 CASE WHEN t."realizadaEm" IS NOT NULL OR t."regularizacaoPendente" THEN v."tentativaId" END AS "tentativaId",
 CASE WHEN t."realizadaEm" IS NOT NULL OR t."regularizacaoPendente" THEN i.id END AS "avaliacaoId",
 CASE WHEN (t."realizadaEm" IS NOT NULL OR t."regularizacaoPendente") AND i.id IS NULL THEN v."exameId" END AS "exameId",
 t."historicoReprogramacao",t."planejadoSnapshot",t."realizadoSnapshot",t."desviosSnapshot",t."regularizacaoPendente",t."historicoRegularizacao"
 FROM pecuaria."TarefaProtocolo" t JOIN pecuaria."ParticipacaoProtocolo" a ON a.id=t."participacaoId" JOIN pecuaria."Protocolo" p ON p.id=a."protocoloId" JOIN pecuaria."EtapaProtocolo" e ON e.id=t."etapaId"
 LEFT JOIN LATERAL (SELECT l.* FROM pecuaria."VinculoTarefaProtocolo" l WHERE l."tarefaId"=t.id ORDER BY (l.estado='ATUAL') DESC,l.ordem DESC LIMIT 1) v ON TRUE
 LEFT JOIN pecuaria."InterpretacaoReprodutiva" i ON i."exameId"=v."exameId"
 WHERE p.tipo='REPRODUTIVO';
DO $$ BEGIN
 IF EXISTS ((SELECT to_jsonb(t)||jsonb_build_object('id',m.novo,'participanteId',p.novo) FROM tarefas_iatf_antes t JOIN mapa_tarefa m ON m.antigo=t.id JOIN mapa_participacao p ON p.antigo=t."participanteId") EXCEPT (SELECT to_jsonb(t)-'exameId' FROM pecuaria."TarefaIatf" t))
 THEN RAISE EXCEPTION 'Tarefas convertidas divergem do histórico IATF; revise dados e vínculos'; END IF;
END $$;

DO $$ BEGIN
 IF EXISTS((SELECT to_jsonb(i)||jsonb_build_object('id',m.novo) FROM protocolos_iatf_antes i JOIN mapa_protocolo m ON m.antigo=i.id) EXCEPT (SELECT to_jsonb(i) FROM pecuaria."ProtocoloIatf" i))
 OR EXISTS((SELECT to_jsonb(i)||jsonb_build_object('id',m.novo,'protocoloId',p.novo) FROM programacoes_iatf_antes i JOIN mapa_programacao m ON m.antigo=i.id JOIN mapa_protocolo p ON p.antigo=i."protocoloId") EXCEPT (SELECT to_jsonb(i) FROM pecuaria."ProgramacaoIatf" i))
 OR EXISTS((SELECT to_jsonb(i)||jsonb_build_object('id',m.novo,'programacaoId',p.novo) FROM participantes_iatf_antes i JOIN mapa_participacao m ON m.antigo=i.id JOIN mapa_programacao p ON p.antigo=i."programacaoId") EXCEPT (SELECT to_jsonb(i) FROM pecuaria."ParticipanteIatf" i))
 THEN RAISE EXCEPTION 'Versões, programas ou participações divergem do histórico IATF'; END IF;
END $$;

ALTER TABLE pecuaria."EtapaProtocolo" ADD CONSTRAINT "EtapaProtocolo_intervalo_check" CHECK (intervalo>=0 AND "unidadeIntervalo" IN ('DIAS','HORAS'));
ALTER TABLE pecuaria."EtapaProtocolo" ADD CONSTRAINT "EtapaProtocolo_tipo_check" CHECK (tipo IN ('APLICACAO','EXAME','TENTATIVA','MANEJO','RETIRADA'));
ALTER TABLE pecuaria."ProgramacaoProtocolo" ADD CONSTRAINT "ProgramacaoProtocolo_precisao_check" CHECK ("precisaoTemporal"='HORA' OR "inicioReferencia"=date_trunc('day',"inicioReferencia"));
ALTER TABLE pecuaria."ParticipacaoProtocolo" ADD CONSTRAINT "ParticipacaoProtocolo_precisao_check" CHECK ("precisaoTemporal"='HORA' OR "inicioReferencia"=date_trunc('day',"inicioReferencia"));
ALTER TABLE pecuaria."TarefaProtocolo" ADD CONSTRAINT "TarefaProtocolo_precisao_check" CHECK ("precisaoTemporal"='HORA' OR "previstaEm"=date_trunc('day',"previstaEm"));

CREATE FUNCTION pecuaria.conferir_tarefa_protocolo() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (SELECT "protocoloId" FROM pecuaria."EtapaProtocolo" WHERE id=NEW."etapaId") IS DISTINCT FROM (SELECT "protocoloId" FROM pecuaria."ParticipacaoProtocolo" WHERE id=NEW."participacaoId") THEN RAISE EXCEPTION 'Etapa e participação precisam usar a mesma versão do protocolo'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "TarefaProtocolo_versao" BEFORE INSERT OR UPDATE OF "etapaId","participacaoId" ON pecuaria."TarefaProtocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_tarefa_protocolo();

-- Invariantes comuns: versão/finalidade, escopo de agrupamento e vínculo físico único.
CREATE FUNCTION pecuaria.proteger_versao_protocolo() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='UPDATE' AND (OLD.publicado OR OLD."publicadoEm" IS NOT NULL OR EXISTS(SELECT 1 FROM pecuaria."ParticipacaoProtocolo" p WHERE p."protocoloId"=OLD.id)) AND
   (NEW.nome,NEW.versao,NEW.tipo,NEW.descricao,NEW."criadoEm",NEW."criadoPorId",NEW."publicadoEm",NEW.publicado) IS DISTINCT FROM
   (OLD.nome,OLD.versao,OLD.tipo,OLD.descricao,OLD."criadoEm",OLD."criadoPorId",OLD."publicadoEm",OLD.publicado)
 THEN RAISE EXCEPTION 'Versão publicada é imutável; crie outra versão'; END IF;
 IF NEW."publicadoEm" IS NOT NULL THEN NEW.publicado:=TRUE; END IF;
 IF TG_OP='UPDATE' AND NEW.tipo<>OLD.tipo AND EXISTS(SELECT 1 FROM pecuaria."ParticipacaoProtocolo" p WHERE p."protocoloId"=OLD.id)
 THEN RAISE EXCEPTION 'Tipo não pode mudar depois de associar participações'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Protocolo_versao" BEFORE INSERT OR UPDATE ON pecuaria."Protocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_versao_protocolo();
CREATE FUNCTION pecuaria.proteger_etapa_protocolo() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (SELECT publicado OR "publicadoEm" IS NOT NULL FROM pecuaria."Protocolo" WHERE id=OLD."protocoloId") OR EXISTS(SELECT 1 FROM pecuaria."TarefaProtocolo" WHERE "etapaId"=OLD.id)
 THEN RAISE EXCEPTION 'Etapa publicada ou usada é imutável'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "EtapaProtocolo_imutavel" BEFORE UPDATE ON pecuaria."EtapaProtocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_etapa_protocolo();
CREATE FUNCTION pecuaria.conferir_participacao_protocolo() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."programacaoId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."ProgramacaoProtocolo" g WHERE g.id=NEW."programacaoId" AND g."protocoloId"=NEW."protocoloId" AND (NEW."propriedadeId" IS NULL OR g."propriedadeId"=NEW."propriedadeId"))
 THEN RAISE EXCEPTION 'Programação incompatível com versão ou sítio da participação'; END IF;
 IF TG_OP='UPDATE' AND NEW."protocoloId"<>OLD."protocoloId" AND EXISTS(SELECT 1 FROM pecuaria."TarefaProtocolo" WHERE "participacaoId"=OLD.id)
 THEN RAISE EXCEPTION 'Participação com tarefas não pode mudar de versão'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "ParticipacaoProtocolo_contexto" BEFORE INSERT OR UPDATE OF "programacaoId","protocoloId","propriedadeId" ON pecuaria."ParticipacaoProtocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_participacao_protocolo();
CREATE FUNCTION pecuaria.conferir_vinculo_tarefa() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE dono TEXT; tarefa_fato TEXT; tipo_fato TEXT; situacao TEXT;
BEGIN
 IF TG_OP='UPDATE' AND (NEW."tarefaId",NEW.ordem,NEW."aplicacaoId",NEW."exameId",NEW."tentativaId") IS DISTINCT FROM (OLD."tarefaId",OLD.ordem,OLD."aplicacaoId",OLD."exameId",OLD."tentativaId")
 THEN RAISE EXCEPTION 'Vínculo conserva a execução original; registre outro vínculo'; END IF;
 IF NEW.estado<>'ATUAL' THEN RETURN NEW; END IF;
 IF NEW."aplicacaoId" IS NOT NULL THEN SELECT "animalId","tarefaId",status::text INTO dono,tarefa_fato,situacao FROM pecuaria."AplicacaoProduto" WHERE id=NEW."aplicacaoId"; tipo_fato:='APLICACAO';
 ELSIF NEW."exameId" IS NOT NULL THEN SELECT "animalId","tarefaId",status::text INTO dono,tarefa_fato,situacao FROM pecuaria."ExameAnimal" WHERE id=NEW."exameId"; tipo_fato:='EXAME';
 ELSE SELECT "animalId","tarefaId",status::text INTO dono,tarefa_fato,situacao FROM pecuaria."TentativaReprodutiva" WHERE id=NEW."tentativaId"; tipo_fato:='TENTATIVA'; END IF;
 IF tarefa_fato IS DISTINCT FROM NEW."tarefaId" OR situacao<>'VALIDO' OR NOT EXISTS(SELECT 1 FROM pecuaria."TarefaProtocolo" t JOIN pecuaria."ParticipacaoProtocolo" p ON p.id=t."participacaoId" JOIN pecuaria."EtapaProtocolo" e ON e.id=t."etapaId" WHERE t.id=NEW."tarefaId" AND p."animalId"=dono AND e.tipo=tipo_fato)
 THEN RAISE EXCEPTION 'Fato, animal e ação incompatíveis com a tarefa'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "VinculoTarefaProtocolo_fato" BEFORE INSERT OR UPDATE ON pecuaria."VinculoTarefaProtocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_tarefa();

COMMIT;
