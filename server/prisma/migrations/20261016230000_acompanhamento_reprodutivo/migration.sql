-- Explicação da perda continua obrigatória. Texto livre não classifica o desfecho.
ALTER TABLE pecuaria."GestacaoAnimal" ADD COLUMN "tipoEncerramento" TEXT, ADD COLUMN "causaClinica" JSONB;
ALTER TABLE pecuaria."Protocolo" ADD COLUMN "referenciaTecnica" JSONB;
UPDATE pecuaria."GestacaoAnimal" SET "tipoEncerramento"='NAO_IDENTIFICADO' WHERE "encerradaEm" IS NOT NULL;
UPDATE pecuaria."GestacaoAnimal" g SET "tipoEncerramento"='PARTO'
 WHERE g."encerradaEm" IS NOT NULL AND EXISTS(SELECT 1 FROM pecuaria."PartoAnimal" p WHERE p."gestacaoId"=g.id AND p.status='VALIDO' AND p.data=g."encerradaEm");
UPDATE pecuaria."GestacaoAnimal" g SET "tipoEncerramento"='PERDA'
 WHERE g."tipoEncerramento"='NAO_IDENTIFICADO'
 AND EXISTS(SELECT 1 FROM pecuaria."AuditoriaPecuaria" a WHERE a.entidade='GestacaoAnimal' AND a."entidadeId"=g.id AND a.acao='PERDA'
   AND left(a.depois->>'encerradaEm',10)=to_char(g."encerradaEm",'YYYY-MM-DD'));
ALTER TABLE pecuaria."GestacaoAnimal" ADD CONSTRAINT "Gestacao_desfecho_tipado" CHECK (
 ("encerradaEm" IS NULL AND "tipoEncerramento" IS NULL) OR
 ("encerradaEm" IS NOT NULL AND "tipoEncerramento" IS NOT NULL AND "tipoEncerramento" IN ('PERDA','PARTO','NAO_IDENTIFICADO')));
ALTER TABLE pecuaria."GestacaoAnimal" ADD CONSTRAINT "Gestacao_perda_explicada" CHECK (
 "tipoEncerramento" IS DISTINCT FROM 'PERDA' OR ("motivoEncerramento" IS NOT NULL AND length(trim("motivoEncerramento"))>=5)) NOT VALID;
-- NOT VALID preserva perdas históricas comprovadas por auditoria sem completar texto.
-- Toda nova gravação/alteração é verificada e exige a explicação.

CREATE TABLE pecuaria."PoliticaAcompanhamentoReprodutivo"(
 "id" TEXT PRIMARY KEY,"propriedadeId" INTEGER NOT NULL REFERENCES public."Propriedade"("id") ON DELETE RESTRICT,
 "versao" INTEGER NOT NULL,"vigenteDesde" DATE NOT NULL,"parametros" JSONB NOT NULL,
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"criadoPorId" INTEGER,
 CONSTRAINT "PoliticaAcompanhamento_versao" CHECK("versao">0),
 CONSTRAINT "PoliticaAcompanhamento_alerta" CHECK(jsonb_typeof("parametros")='object' AND ("parametros"->>'efeito' IS NOT DISTINCT FROM 'ALERTA') AND ("parametros"->>'versao' IS NOT DISTINCT FROM '1')),
 UNIQUE("propriedadeId","versao"),UNIQUE("propriedadeId","vigenteDesde")
);
CREATE FUNCTION pecuaria.impedir_edicao_politica_acompanhamento() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 RAISE EXCEPTION 'política de acompanhamento é imutável; crie nova versão' USING ERRCODE='23514';
END $$;
CREATE TRIGGER "PoliticaAcompanhamento_imutavel" BEFORE UPDATE ON pecuaria."PoliticaAcompanhamentoReprodutivo" FOR EACH ROW EXECUTE FUNCTION pecuaria.impedir_edicao_politica_acompanhamento();
CREATE TABLE pecuaria."DemandaAcompanhamentoReprodutivo"(
 "id" TEXT PRIMARY KEY,"animalId" TEXT NOT NULL REFERENCES pecuaria."Animal"("id") ON DELETE RESTRICT,
 "propriedadeOrigemId" INTEGER NOT NULL REFERENCES public."Propriedade"("id") ON DELETE RESTRICT,
 "finalidade" TEXT NOT NULL,"tentativaId" TEXT REFERENCES pecuaria."TentativaReprodutiva"("id") ON DELETE RESTRICT,
 "gestacaoId" TEXT REFERENCES pecuaria."GestacaoAnimal"("id") ON DELETE RESTRICT,"ocorrencia" INTEGER NOT NULL DEFAULT 1,
 "politicaId" TEXT NOT NULL REFERENCES pecuaria."PoliticaAcompanhamentoReprodutivo"("id") ON DELETE RESTRICT,
 "dataReferencia" DATE NOT NULL,"previstaPara" DATE NOT NULL,"regraSnapshot" JSONB NOT NULL,
 "origemAdocao" TEXT NOT NULL DEFAULT 'FATO_NOVO',"estado" TEXT NOT NULL DEFAULT 'PENDENTE',
 "tarefaId" TEXT UNIQUE REFERENCES pecuaria."TarefaProtocolo"("id") ON DELETE RESTRICT,
 "exameOrigemId" TEXT REFERENCES pecuaria."ExameAnimal"("id") ON DELETE RESTRICT,
 "exameResolucaoId" TEXT UNIQUE REFERENCES pecuaria."ExameAnimal"("id") ON DELETE RESTRICT,"resolucaoSnapshot" JSONB,
 "resolvidaEm" DATE,"encerradaEm" TIMESTAMP(3),"motivoEncerramento" TEXT,
 "versao" INTEGER NOT NULL DEFAULT 1,"criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"criadoPorId" INTEGER,"atualizadoEm" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "DemandaAcompanhamento_origem" CHECK(("finalidade"='DIAGNOSTICO' AND "tentativaId" IS NOT NULL AND "gestacaoId" IS NULL AND "ocorrencia"=1) OR
   ("finalidade"='RECONFIRMACAO' AND "gestacaoId" IS NOT NULL AND "tentativaId" IS NULL AND "ocorrencia">0)),
 CONSTRAINT "DemandaAcompanhamento_estado" CHECK("estado" IN ('PENDENTE','RESOLVIDA','ENCERRADA')),
 CONSTRAINT "DemandaAcompanhamento_previsao" CHECK("previstaPara">="dataReferencia" AND "versao">0),
 CONSTRAINT "DemandaAcompanhamento_regra" CHECK(jsonb_typeof("regraSnapshot")='object' AND ("regraSnapshot"->>'efeito' IS NOT DISTINCT FROM 'ALERTA')),
 CONSTRAINT "DemandaAcompanhamento_resolucao" CHECK("estado"<>'RESOLVIDA' OR ("resolvidaEm" IS NOT NULL AND "exameResolucaoId" IS NOT NULL AND "resolucaoSnapshot" IS NOT NULL)),
 CONSTRAINT "DemandaAcompanhamento_encerramento" CHECK("estado"<>'ENCERRADA' OR ("encerradaEm" IS NOT NULL AND "motivoEncerramento" IS NOT NULL AND length(trim("motivoEncerramento"))>=5))
);
CREATE UNIQUE INDEX "DemandaAcompanhamento_diagnostico" ON pecuaria."DemandaAcompanhamentoReprodutivo"("tentativaId","finalidade","ocorrencia") WHERE "tentativaId" IS NOT NULL;
CREATE UNIQUE INDEX "DemandaAcompanhamento_reconfirmacao" ON pecuaria."DemandaAcompanhamentoReprodutivo"("gestacaoId","finalidade","ocorrencia") WHERE "gestacaoId" IS NOT NULL;
CREATE INDEX "DemandaAcompanhamento_animal_estado_data" ON pecuaria."DemandaAcompanhamentoReprodutivo"("animalId","estado","previstaPara");
CREATE INDEX "DemandaAcompanhamento_origem_estado" ON pecuaria."DemandaAcompanhamentoReprodutivo"("propriedadeOrigemId","estado");
CREATE INDEX "DemandaAcompanhamento_tentativa" ON pecuaria."DemandaAcompanhamentoReprodutivo"("tentativaId");
CREATE INDEX "DemandaAcompanhamento_gestacao" ON pecuaria."DemandaAcompanhamentoReprodutivo"("gestacaoId");
ALTER TABLE pecuaria."ExameAnimal" ADD COLUMN "demandaAcompanhamentoId" TEXT REFERENCES pecuaria."DemandaAcompanhamentoReprodutivo"("id") ON DELETE RESTRICT;
CREATE FUNCTION pecuaria.validar_demanda_acompanhamento() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE registro_origem RECORD; registro_politica RECORD; registro_exame RECORD;
BEGIN
 IF TG_OP='UPDATE' AND (NEW."animalId",NEW."propriedadeOrigemId",NEW."finalidade",NEW."tentativaId",NEW."gestacaoId",NEW."ocorrencia",NEW."politicaId",NEW."dataReferencia",NEW."previstaPara",NEW."regraSnapshot",NEW."origemAdocao")
  IS DISTINCT FROM (OLD."animalId",OLD."propriedadeOrigemId",OLD."finalidade",OLD."tentativaId",OLD."gestacaoId",OLD."ocorrencia",OLD."politicaId",OLD."dataReferencia",OLD."previstaPara",OLD."regraSnapshot",OLD."origemAdocao") THEN
  RAISE EXCEPTION 'origem e regra da demanda são congeladas' USING ERRCODE='23514';
 END IF;
 IF NEW."tentativaId" IS NOT NULL THEN SELECT t."animalId",t."propriedadeId" INTO registro_origem FROM pecuaria."TentativaReprodutiva" t WHERE t.id=NEW."tentativaId";
 ELSE SELECT g."animalId",g."propriedadeId" INTO registro_origem FROM pecuaria."GestacaoAnimal" g WHERE g.id=NEW."gestacaoId"; END IF;
 SELECT p."propriedadeId",p.versao INTO registro_politica FROM pecuaria."PoliticaAcompanhamentoReprodutivo" p WHERE p.id=NEW."politicaId";
 IF registro_origem."animalId" IS DISTINCT FROM NEW."animalId" OR registro_origem."propriedadeId" IS DISTINCT FROM NEW."propriedadeOrigemId"
  OR registro_politica."propriedadeId" IS DISTINCT FROM NEW."propriedadeOrigemId" THEN RAISE EXCEPTION 'demanda incompatível com animal/sítio da origem' USING ERRCODE='23514'; END IF;
 IF NEW."regraSnapshot"->>'politicaId' IS DISTINCT FROM NEW."politicaId" OR NEW."regraSnapshot"->>'politicaVersao' IS DISTINCT FROM registro_politica.versao::TEXT THEN RAISE EXCEPTION 'snapshot da demanda diverge da versão congelada' USING ERRCODE='23514'; END IF;
 IF NEW."tarefaId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."TarefaProtocolo" t JOIN pecuaria."ParticipacaoProtocolo" p ON p.id=t."participacaoId" WHERE t.id=NEW."tarefaId" AND p."animalId"=NEW."animalId") THEN RAISE EXCEPTION 'tarefa de outro animal' USING ERRCODE='23514'; END IF;
 IF NEW."exameResolucaoId" IS NOT NULL THEN
  SELECT e.*, i."tentativaId" AS "tentativaOrigemId",i."gestacaoId" AS "gestacaoOrigemId" INTO registro_exame FROM pecuaria."ExameAnimal" e LEFT JOIN pecuaria."InterpretacaoReprodutiva" i ON i."exameId"=e.id WHERE e.id=NEW."exameResolucaoId";
  IF registro_exame."animalId" IS DISTINCT FROM NEW."animalId" OR registro_exame.status IS DISTINCT FROM 'VALIDO' OR registro_exame.realizacao IS DISTINCT FROM 'REALIZADO'
   OR NOT (NEW.finalidade=ANY(registro_exame.finalidades)) OR registro_exame.data<NEW."dataReferencia" OR (NEW.finalidade='RECONFIRMACAO' AND registro_exame.data<NEW."previstaPara")
   OR (NEW."tentativaId" IS NOT NULL AND registro_exame."tentativaOrigemId" IS DISTINCT FROM NEW."tentativaId")
   OR (NEW."gestacaoId" IS NOT NULL AND registro_exame."gestacaoOrigemId" IS DISTINCT FROM NEW."gestacaoId")
   OR (registro_exame."demandaAcompanhamentoId" IS NOT NULL AND registro_exame."demandaAcompanhamentoId"<>NEW.id)
   OR NOT EXISTS(SELECT 1 FROM pecuaria."ResultadoExame" r WHERE r."exameId"=registro_exame.id AND r.vigente AND r.campo='CONCLUSAO_GESTACIONAL' AND r.valor IN ('"POSITIVO"'::jsonb,'"NEGATIVO"'::jsonb)) THEN
   RAISE EXCEPTION 'resolução exige conclusão vigente compatível com a demanda' USING ERRCODE='23514';
  END IF;
  IF NEW."regraSnapshot"->>'tipoExameId' IS NOT NULL AND (registro_exame."tipoExameId" IS DISTINCT FROM NEW."regraSnapshot"->>'tipoExameId' OR registro_exame."formatoSnapshot"->>'versao' IS DISTINCT FROM NEW."regraSnapshot"->>'tipoExameVersao') THEN RAISE EXCEPTION 'resolução difere do formato congelado' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "DemandaAcompanhamento_validar" BEFORE INSERT OR UPDATE ON pecuaria."DemandaAcompanhamentoReprodutivo" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_demanda_acompanhamento();
-- O vínculo de um exame à necessidade não pode atravessar animal, origem, finalidade ou formato.
CREATE FUNCTION pecuaria.validar_exame_demanda_acompanhamento() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE registro_demanda RECORD; registro_interpretacao RECORD;
BEGIN
 IF NEW."demandaAcompanhamentoId" IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO registro_demanda FROM pecuaria."DemandaAcompanhamentoReprodutivo" d WHERE d.id=NEW."demandaAcompanhamentoId";
 SELECT * INTO registro_interpretacao FROM pecuaria."InterpretacaoReprodutiva" i WHERE i."exameId"=NEW.id;
 IF registro_demanda."animalId" IS DISTINCT FROM NEW."animalId" OR NOT (registro_demanda.finalidade=ANY(NEW.finalidades))
  OR NEW.data<registro_demanda."dataReferencia" THEN RAISE EXCEPTION 'exame incompatível com demanda' USING ERRCODE='23514'; END IF;
 IF registro_demanda."tentativaId" IS NOT NULL THEN
  IF registro_interpretacao."tentativaId" IS DISTINCT FROM registro_demanda."tentativaId" THEN RAISE EXCEPTION 'tentativa da demanda diverge do exame' USING ERRCODE='23514'; END IF;
 ELSE
  IF registro_interpretacao."gestacaoId" IS DISTINCT FROM registro_demanda."gestacaoId" THEN RAISE EXCEPTION 'gestação da demanda diverge do exame' USING ERRCODE='23514'; END IF;
 END IF;
 IF registro_demanda."regraSnapshot"->>'tipoExameId' IS NOT NULL AND
  (NEW."tipoExameId" IS DISTINCT FROM registro_demanda."regraSnapshot"->>'tipoExameId' OR NEW."formatoSnapshot"->>'versao' IS DISTINCT FROM registro_demanda."regraSnapshot"->>'tipoExameVersao') THEN RAISE EXCEPTION 'formato difere da regra congelada' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "Exame_demanda_compativel" AFTER INSERT OR UPDATE ON pecuaria."ExameAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_exame_demanda_acompanhamento();
-- Verifica o estado final da transação; permite anular e reconciliar atomicamente, sem deixar resolução inválida.
CREATE FUNCTION pecuaria.validar_resolucao_demanda_final() RETURNS trigger LANGUAGE plpgsql AS $$
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
    SELECT 1 FROM pecuaria."ResultadoExame" r WHERE r."exameId"=e.id AND r.vigente AND r.campo='CONCLUSAO_GESTACIONAL' AND r.valor IN ('"POSITIVO"'::jsonb,'"NEGATIVO"'::jsonb)))) THEN
  RAISE EXCEPTION 'demanda resolvida exige evidência conclusiva válida no estado final' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "Exame_resolucao_demanda_final" AFTER UPDATE OR DELETE ON pecuaria."ExameAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_resolucao_demanda_final();
CREATE CONSTRAINT TRIGGER "Resultado_resolucao_demanda_final" AFTER INSERT OR UPDATE OR DELETE ON pecuaria."ResultadoExame" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_resolucao_demanda_final();

CREATE CONSTRAINT TRIGGER "Interpretacao_resolucao_demanda_final" AFTER INSERT OR UPDATE OR DELETE ON pecuaria."InterpretacaoReprodutiva" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_resolucao_demanda_final();

-- Obrigações novas preservam o texto histórico sem fabricar uma justificativa.
CREATE FUNCTION pecuaria.exigir_explicacao_novo_aborto() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.tipo='ABORTO' OR NEW.desfecho='ABORTO' THEN
  IF TG_OP='INSERT' THEN
   IF length(trim(COALESCE(NEW.observacao,'')))<5 THEN RAISE EXCEPTION 'explique a observação e contexto do aborto' USING ERRCODE='23514'; END IF;
  ELSIF (OLD.tipo IS DISTINCT FROM 'ABORTO' AND OLD.desfecho IS DISTINCT FROM 'ABORTO') OR NEW.observacao IS DISTINCT FROM OLD.observacao THEN
   IF length(trim(COALESCE(NEW.observacao,'')))<5 THEN RAISE EXCEPTION 'explique a observação e contexto do aborto' USING ERRCODE='23514'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Parto_aborto_explicado" BEFORE INSERT OR UPDATE ON pecuaria."PartoAnimal" FOR EACH ROW EXECUTE FUNCTION pecuaria.exigir_explicacao_novo_aborto();

CREATE FUNCTION pecuaria.preservar_referencia_protocolo_publicado() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (OLD.publicado OR OLD."publicadoEm" IS NOT NULL) AND NEW."referenciaTecnica" IS DISTINCT FROM OLD."referenciaTecnica" THEN
  RAISE EXCEPTION 'a referência técnica da versão publicada é imutável; crie uma versão derivada' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Protocolo_referencia_publicada" BEFORE UPDATE ON pecuaria."Protocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_referencia_protocolo_publicado();
