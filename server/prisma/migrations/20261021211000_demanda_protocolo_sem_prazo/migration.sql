BEGIN;
-- Acompanhamento factual de exame inconclusivo sem política/prazo presumidos.
ALTER TABLE pecuaria."DemandaAcompanhamentoReprodutivo"
 ALTER COLUMN "politicaId" DROP NOT NULL,
 ALTER COLUMN "previstaPara" DROP NOT NULL,
 DROP CONSTRAINT "DemandaAcompanhamento_origem";
ALTER TABLE pecuaria."DemandaAcompanhamentoReprodutivo"
 ADD CONSTRAINT "DemandaAcompanhamento_contexto_prazo" CHECK (
  ("origemAdocao"='PROTOCOLO' AND "politicaId" IS NULL AND "tarefaId" IS NOT NULL AND "exameOrigemId" IS NOT NULL)
  OR ("origemAdocao"<>'PROTOCOLO' AND "politicaId" IS NOT NULL AND "previstaPara" IS NOT NULL)),
 ADD CONSTRAINT "DemandaAcompanhamento_origem" CHECK (
  ("origemAdocao"='PROTOCOLO' AND "finalidade" IN ('DIAGNOSTICO','RECONFIRMACAO','SEXAGEM') AND "ocorrencia">0)
  OR ("finalidade"='DIAGNOSTICO' AND "tentativaId" IS NOT NULL AND "gestacaoId" IS NULL AND "ocorrencia"=1)
  OR ("finalidade"='RECONFIRMACAO' AND "gestacaoId" IS NOT NULL AND "tentativaId" IS NULL AND "ocorrencia">0));

CREATE OR REPLACE FUNCTION pecuaria.validar_demanda_acompanhamento() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE registro_origem RECORD; registro_politica RECORD; registro_exame RECORD;
BEGIN
 IF TG_OP='UPDATE' AND (NEW."animalId",NEW."propriedadeOrigemId",NEW."finalidade",NEW."tentativaId",NEW."gestacaoId",NEW."ocorrencia",NEW."politicaId",NEW."dataReferencia",NEW."previstaPara",NEW."regraSnapshot",NEW."origemAdocao")
  IS DISTINCT FROM (OLD."animalId",OLD."propriedadeOrigemId",OLD."finalidade",OLD."tentativaId",OLD."gestacaoId",OLD."ocorrencia",OLD."politicaId",OLD."dataReferencia",OLD."previstaPara",OLD."regraSnapshot",OLD."origemAdocao") THEN
  RAISE EXCEPTION 'origem e regra da demanda são congeladas' USING ERRCODE='23514';
 END IF;
 IF NEW."origemAdocao"='PROTOCOLO' THEN
  IF TG_OP='UPDATE' AND (NEW."tarefaId",NEW."exameOrigemId") IS DISTINCT FROM (OLD."tarefaId",OLD."exameOrigemId") THEN
   RAISE EXCEPTION 'origem protocolar da demanda é congelada' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (
   SELECT 1 FROM pecuaria."TarefaProtocolo" t
   JOIN pecuaria."ParticipacaoProtocolo" p ON p.id=t."participacaoId"
   JOIN pecuaria."EtapaProtocolo" a ON a.id=t."etapaId"
   JOIN pecuaria."ExameAnimal" e ON e.id=NEW."exameOrigemId"
   LEFT JOIN pecuaria."InterpretacaoReprodutiva" i ON i."exameId"=e.id
   WHERE t.id=NEW."tarefaId" AND p."animalId"=NEW."animalId" AND p."propriedadeId"=NEW."propriedadeOrigemId"
    AND a.tipo='EXAME' AND a.configuracao->>'tipo'='AVALIACAO'
    AND NEW."regraSnapshot"->'acao' IS NOT DISTINCT FROM a.configuracao
    AND e."animalId"=NEW."animalId" AND e."tarefaId"=t.id AND e."propriedadeId"=NEW."propriedadeOrigemId"
    AND e.data=NEW."dataReferencia" AND NEW.finalidade=ANY(e.finalidades)
    AND e."tipoExameId"=NEW."regraSnapshot"->>'tipoExameId'
    AND e."formatoSnapshot"->>'versao'=NEW."regraSnapshot"->>'tipoExameVersao'
    AND i."tentativaId" IS NOT DISTINCT FROM NEW."tentativaId" AND i."gestacaoId" IS NOT DISTINCT FROM NEW."gestacaoId"
    AND (TG_OP='UPDATE' OR (e.status='VALIDO' AND e.realizacao='REALIZADO' AND EXISTS (
      SELECT 1 FROM pecuaria."ResultadoExame" r WHERE r."exameId"=e.id AND r.vigente AND r.campo='CONCLUSAO_GESTACIONAL' AND r.valor='"INCONCLUSIVO"'::jsonb)))
  ) THEN RAISE EXCEPTION 'demanda protocolar exige tarefa e exame inconclusivo compatíveis' USING ERRCODE='23514'; END IF;
 ELSE
 IF NEW."tentativaId" IS NOT NULL THEN SELECT t."animalId",t."propriedadeId" INTO registro_origem FROM pecuaria."TentativaReprodutiva" t WHERE t.id=NEW."tentativaId";
 ELSE SELECT g."animalId",g."propriedadeId" INTO registro_origem FROM pecuaria."GestacaoAnimal" g WHERE g.id=NEW."gestacaoId"; END IF;
 SELECT p."propriedadeId",p.versao INTO registro_politica FROM pecuaria."PoliticaAcompanhamentoReprodutivo" p WHERE p.id=NEW."politicaId";
 IF registro_origem."animalId" IS DISTINCT FROM NEW."animalId" OR registro_origem."propriedadeId" IS DISTINCT FROM NEW."propriedadeOrigemId"
  OR registro_politica."propriedadeId" IS DISTINCT FROM NEW."propriedadeOrigemId" THEN RAISE EXCEPTION 'demanda incompatível com animal/sítio da origem' USING ERRCODE='23514'; END IF;
 IF NEW."regraSnapshot"->>'politicaId' IS DISTINCT FROM NEW."politicaId" OR NEW."regraSnapshot"->>'politicaVersao' IS DISTINCT FROM registro_politica.versao::TEXT THEN RAISE EXCEPTION 'snapshot da demanda diverge da versão congelada' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW."tarefaId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."TarefaProtocolo" t JOIN pecuaria."ParticipacaoProtocolo" p ON p.id=t."participacaoId" WHERE t.id=NEW."tarefaId" AND p."animalId"=NEW."animalId") THEN RAISE EXCEPTION 'tarefa de outro animal' USING ERRCODE='23514'; END IF;
 IF NEW."exameResolucaoId" IS NOT NULL THEN
  SELECT e.*, i."tentativaId" AS "tentativaOrigemId",i."gestacaoId" AS "gestacaoOrigemId" INTO registro_exame FROM pecuaria."ExameAnimal" e LEFT JOIN pecuaria."InterpretacaoReprodutiva" i ON i."exameId"=e.id WHERE e.id=NEW."exameResolucaoId";
  IF registro_exame."animalId" IS DISTINCT FROM NEW."animalId" OR registro_exame.status IS DISTINCT FROM 'VALIDO' OR registro_exame.realizacao IS DISTINCT FROM 'REALIZADO'
   OR NOT (NEW.finalidade=ANY(registro_exame.finalidades)) OR registro_exame.data<NEW."dataReferencia" OR (NEW.finalidade='RECONFIRMACAO' AND registro_exame.data<NEW."previstaPara")
   OR (NEW."tentativaId" IS NOT NULL AND registro_exame."tentativaOrigemId" IS DISTINCT FROM NEW."tentativaId")
   OR (NEW."gestacaoId" IS NOT NULL AND registro_exame."gestacaoOrigemId" IS DISTINCT FROM NEW."gestacaoId")
   OR (registro_exame."demandaAcompanhamentoId" IS NOT NULL AND registro_exame."demandaAcompanhamentoId"<>NEW.id)
   OR NOT EXISTS(SELECT 1 FROM pecuaria."ResultadoExame" r WHERE r."exameId"=registro_exame.id AND r.vigente AND ((NEW.finalidade='SEXAGEM' AND r.campo='SEXO_FETAL' AND r.valor IN ('"F"'::jsonb,'"M"'::jsonb)) OR (NEW.finalidade<>'SEXAGEM' AND r.campo='CONCLUSAO_GESTACIONAL' AND r.valor IN ('"POSITIVO"'::jsonb,'"NEGATIVO"'::jsonb)))) THEN
   RAISE EXCEPTION 'resolução exige conclusão vigente compatível com a demanda' USING ERRCODE='23514';
  END IF;
  IF NEW."regraSnapshot"->>'tipoExameId' IS NOT NULL AND (registro_exame."tipoExameId" IS DISTINCT FROM NEW."regraSnapshot"->>'tipoExameId' OR registro_exame."formatoSnapshot"->>'versao' IS DISTINCT FROM NEW."regraSnapshot"->>'tipoExameVersao') THEN RAISE EXCEPTION 'resolução difere do formato congelado' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION pecuaria.validar_exame_demanda_acompanhamento() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE registro_demanda RECORD; registro_interpretacao RECORD;
BEGIN
 IF NEW."demandaAcompanhamentoId" IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO registro_demanda FROM pecuaria."DemandaAcompanhamentoReprodutivo" d WHERE d.id=NEW."demandaAcompanhamentoId";
 SELECT * INTO registro_interpretacao FROM pecuaria."InterpretacaoReprodutiva" i WHERE i."exameId"=NEW.id;
 IF registro_demanda."animalId" IS DISTINCT FROM NEW."animalId" OR NOT (registro_demanda.finalidade=ANY(NEW.finalidades))
  OR NEW.data<registro_demanda."dataReferencia" THEN RAISE EXCEPTION 'exame incompatível com demanda' USING ERRCODE='23514'; END IF;
 IF registro_demanda."tentativaId" IS NOT NULL THEN
  IF registro_interpretacao."tentativaId" IS DISTINCT FROM registro_demanda."tentativaId" THEN RAISE EXCEPTION 'tentativa da demanda diverge do exame' USING ERRCODE='23514'; END IF;
 ELSIF registro_demanda."gestacaoId" IS NOT NULL OR registro_demanda."origemAdocao"<>'PROTOCOLO' THEN
  IF registro_interpretacao."gestacaoId" IS DISTINCT FROM registro_demanda."gestacaoId" THEN RAISE EXCEPTION 'gestação da demanda diverge do exame' USING ERRCODE='23514'; END IF;
 END IF;
 IF registro_demanda."regraSnapshot"->>'tipoExameId' IS NOT NULL AND
  (NEW."tipoExameId" IS DISTINCT FROM registro_demanda."regraSnapshot"->>'tipoExameId' OR NEW."formatoSnapshot"->>'versao' IS DISTINCT FROM registro_demanda."regraSnapshot"->>'tipoExameVersao') THEN RAISE EXCEPTION 'formato difere da regra congelada' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION pecuaria.validar_resolucao_demanda_final() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE identificador_exame TEXT;
BEGIN
 IF TG_TABLE_NAME='ExameAnimal' THEN
  IF TG_OP='DELETE' THEN identificador_exame:=OLD.id; ELSE identificador_exame:=NEW.id; END IF;
 ELSIF TG_TABLE_NAME='ResultadoExame' OR TG_TABLE_NAME='InterpretacaoReprodutiva' THEN
  IF TG_OP='DELETE' THEN identificador_exame:=OLD."exameId"; ELSE identificador_exame:=NEW."exameId"; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM pecuaria."DemandaAcompanhamentoReprodutivo" d JOIN pecuaria."ExameAnimal" e ON e.id=d."exameResolucaoId" LEFT JOIN pecuaria."InterpretacaoReprodutiva" i ON i."exameId"=e.id
  WHERE d.estado='RESOLVIDA' AND d."exameResolucaoId"=identificador_exame AND
   (e.status<>'VALIDO' OR e.realizacao<>'REALIZADO' OR e."animalId"<>d."animalId"
    OR NOT (d.finalidade=ANY(e.finalidades)) OR e.data<d."dataReferencia" OR (d.finalidade='RECONFIRMACAO' AND e.data<d."previstaPara")
    OR (d."tentativaId" IS NOT NULL AND i."tentativaId" IS DISTINCT FROM d."tentativaId") OR (d."gestacaoId" IS NOT NULL AND i."gestacaoId" IS DISTINCT FROM d."gestacaoId")
    OR (e."demandaAcompanhamentoId" IS NOT NULL AND e."demandaAcompanhamentoId"<>d.id)
    OR (d."regraSnapshot"->>'tipoExameId' IS NOT NULL AND (e."tipoExameId" IS DISTINCT FROM d."regraSnapshot"->>'tipoExameId' OR e."formatoSnapshot"->>'versao' IS DISTINCT FROM d."regraSnapshot"->>'tipoExameVersao'))
    OR NOT EXISTS(
    SELECT 1 FROM pecuaria."ResultadoExame" r WHERE r."exameId"=e.id AND r.vigente AND ((d.finalidade='SEXAGEM' AND r.campo='SEXO_FETAL' AND r.valor IN ('"F"'::jsonb,'"M"'::jsonb)) OR (d.finalidade<>'SEXAGEM' AND r.campo='CONCLUSAO_GESTACIONAL' AND r.valor IN ('"POSITIVO"'::jsonb,'"NEGATIVO"'::jsonb)))))) THEN
  RAISE EXCEPTION 'demanda resolvida exige evidência conclusiva válida no estado final' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;

COMMIT;
