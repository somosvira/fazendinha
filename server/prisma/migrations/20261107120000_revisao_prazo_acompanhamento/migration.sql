CREATE TABLE pecuaria."RevisaoPrazoAcompanhamento" (
  id TEXT PRIMARY KEY,
  "demandaId" TEXT NOT NULL REFERENCES pecuaria."DemandaAcompanhamentoReprodutivo"(id) ON DELETE RESTRICT,
  "versaoAnterior" INTEGER NOT NULL CHECK ("versaoAnterior" > 0),
  "politicaAnteriorId" TEXT NOT NULL REFERENCES pecuaria."PoliticaAcompanhamentoReprodutivo"(id) ON DELETE RESTRICT,
  "politicaNovaId" TEXT NOT NULL REFERENCES pecuaria."PoliticaAcompanhamentoReprodutivo"(id) ON DELETE RESTRICT,
  "previstaAnterior" DATE NOT NULL, "previstaNova" DATE NOT NULL,
  "regraAnterior" JSONB NOT NULL, "regraNova" JSONB NOT NULL,
  motivo TEXT NOT NULL CHECK (length(trim(motivo)) >= 5),
  "usuarioId" INTEGER REFERENCES public."Usuario"(id) ON DELETE RESTRICT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("demandaId", "versaoAnterior")
);
CREATE FUNCTION pecuaria.impedir_alteracao_revisao_prazo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'revisão de prazo é imutável' USING ERRCODE='23514'; END $$;
CREATE TRIGGER "RevisaoPrazo_imutavel" BEFORE UPDATE OR DELETE ON pecuaria."RevisaoPrazoAcompanhamento" FOR EACH ROW EXECUTE FUNCTION pecuaria.impedir_alteracao_revisao_prazo();

CREATE FUNCTION pecuaria.validar_revisao_prazo_aplicada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pecuaria."DemandaAcompanhamentoReprodutivo" d WHERE d.id=NEW."demandaId" AND d.versao=NEW."versaoAnterior"+1 AND d."politicaId"=NEW."politicaNovaId" AND d."previstaPara"=NEW."previstaNova" AND d."regraSnapshot"=NEW."regraNova") THEN
  RAISE EXCEPTION 'revisão de prazo deve ser aplicada na mesma transação' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "RevisaoPrazo_aplicada" AFTER INSERT ON pecuaria."RevisaoPrazoAcompanhamento" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_revisao_prazo_aplicada();

CREATE OR REPLACE FUNCTION pecuaria.validar_demanda_acompanhamento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE registro_origem RECORD; registro_politica RECORD; registro_exame RECORD;
BEGIN
 IF TG_OP='UPDATE' AND (NEW."animalId",NEW."propriedadeOrigemId",NEW."finalidade",NEW."tentativaId",NEW."gestacaoId",NEW."ocorrencia",NEW."politicaId",NEW."dataReferencia",NEW."previstaPara",NEW."regraSnapshot",NEW."origemAdocao")
  IS DISTINCT FROM (OLD."animalId",OLD."propriedadeOrigemId",OLD."finalidade",OLD."tentativaId",OLD."gestacaoId",OLD."ocorrencia",OLD."politicaId",OLD."dataReferencia",OLD."previstaPara",OLD."regraSnapshot",OLD."origemAdocao") THEN
  IF (NEW."animalId",NEW."propriedadeOrigemId",NEW."finalidade",NEW."tentativaId",NEW."gestacaoId",NEW."ocorrencia",NEW."dataReferencia",NEW."origemAdocao") IS DISTINCT FROM (OLD."animalId",OLD."propriedadeOrigemId",OLD."finalidade",OLD."tentativaId",OLD."gestacaoId",OLD."ocorrencia",OLD."dataReferencia",OLD."origemAdocao") OR OLD.estado <> 'PENDENTE' OR NEW.estado <> 'PENDENTE' OR OLD."tarefaId" IS NOT NULL OR NEW."tarefaId" IS NOT NULL OR NEW.versao <> OLD.versao + 1 OR NOT EXISTS (
    SELECT 1 FROM pecuaria."RevisaoPrazoAcompanhamento" r WHERE r."demandaId"=OLD.id AND r."versaoAnterior"=OLD.versao AND r."politicaAnteriorId"=OLD."politicaId" AND r."politicaNovaId"=NEW."politicaId" AND r."previstaAnterior"=OLD."previstaPara" AND r."previstaNova"=NEW."previstaPara" AND r."regraAnterior"=OLD."regraSnapshot" AND r."regraNova"=NEW."regraSnapshot"
  ) THEN RAISE EXCEPTION 'origem e regra da demanda são congeladas sem revisão explícita' USING ERRCODE='23514'; END IF;
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
