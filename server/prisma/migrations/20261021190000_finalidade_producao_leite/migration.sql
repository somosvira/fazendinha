-- Evidência histórica: o cadastro vigente hoje nunca preenche lacunas antigas.
ALTER TABLE pecuaria."ParticipanteProducaoLeite" ADD COLUMN "finalidadeId" TEXT, ADD COLUMN "finalidadeSnapshot" JSONB;
CREATE INDEX "ParticipanteProducaoLeite_finalidadeId_idx" ON pecuaria."ParticipanteProducaoLeite" ("finalidadeId");
ALTER TABLE pecuaria."ParticipanteProducaoLeite" ADD CONSTRAINT "ParticipanteProducaoLeite_finalidadeId_fkey"
  FOREIGN KEY ("finalidadeId") REFERENCES pecuaria."FinalidadeAnimal"(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
-- A vigência continua [desde,ate). A baixa ativa conserva os fatos do próprio
-- dia somente na finalidade exata que fechou; não libera outra classificação.
CREATE FUNCTION pecuaria."finalidades_producao_na_data"(animal_id text, dia date)
RETURNS TABLE(id text, aptidao text, desde date, ate date, baixa_id text) LANGUAGE sql AS $$
 SELECT f.id, f.aptidao::text, f.desde, f.ate,
  CASE WHEN f.ate=dia THEN (SELECT min(b.id) FROM pecuaria."BaixaAnimal" b
   WHERE b."animalId"=animal_id AND b."destinoFechadoId"=f.id AND b.data=dia AND b."estornadaEm" IS NULL) END
 FROM pecuaria."FinalidadeAnimal" f WHERE f."animalId"=animal_id AND f.desde<=dia AND (
  f.ate IS NULL OR f.ate>dia OR f.ate=dia AND EXISTS (
   SELECT 1 FROM pecuaria."BaixaAnimal" b WHERE b."animalId"=animal_id
    AND b."destinoFechadoId"=f.id AND b.data=dia AND b."estornadaEm" IS NULL))
$$;
WITH historico AS (
 SELECT p.id, min(f.id) AS finalidade_id, min(f.baixa_id) AS baixa_id FROM pecuaria."ParticipanteProducaoLeite" p
 JOIN pecuaria."DiaProducaoLeite" d ON d.id=p."diaId"
 JOIN LATERAL pecuaria."finalidades_producao_na_data"(p."animalId",d."dataOperacional") f ON true
 GROUP BY p.id HAVING count(*)=1 AND bool_and(f.aptidao='LEITE')
)
UPDATE pecuaria."ParticipanteProducaoLeite" p SET "finalidadeId"=f.id,
 "finalidadeSnapshot"=jsonb_build_object('regra','FINALIDADE_LEITE_V1','aptidao','LEITE','finalidadeId',f.id,
  'dataOperacional',to_char(d."dataOperacional",'YYYY-MM-DD'),'desde',to_char(f.desde,'YYYY-MM-DD'),'ate',to_char(f.ate,'YYYY-MM-DD'),'motivoExtremidade',CASE WHEN h.baixa_id IS NOT NULL THEN 'BAIXA_NO_DIA' END,'baixaId',h.baixa_id)
FROM historico h, pecuaria."FinalidadeAnimal" f, pecuaria."DiaProducaoLeite" d
WHERE h.id=p.id AND f.id=h.finalidade_id AND d.id=p."diaId";
-- Demais participantes permanecem identificáveis como pendência, com seus litros preservados.
ALTER TABLE pecuaria."ParticipanteProducaoLeite" ADD CONSTRAINT "ParticipanteProducaoLeite_finalidade_par_check"
 CHECK (("finalidadeId" IS NULL AND "finalidadeSnapshot" IS NULL) OR ("finalidadeId" IS NOT NULL AND "finalidadeSnapshot" IS NOT NULL));

CREATE FUNCTION pecuaria."conferir_evidencia_finalidade_leite"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE dia date; quantidade integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('pec-animal:'||NEW."animalId"));
 IF TG_OP='UPDATE' AND ROW(NEW.id,NEW."animalId",NEW."diaId") IS DISTINCT FROM ROW(OLD.id,OLD."animalId",OLD."diaId") THEN
   RAISE EXCEPTION 'Identidade do participante de ordenha é imutável' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' AND ROW(NEW."finalidadeId",NEW."finalidadeSnapshot") IS NOT DISTINCT FROM ROW(OLD."finalidadeId",OLD."finalidadeSnapshot")
  AND NOT (OLD."excluidoEm" IS NOT NULL AND NEW."excluidoEm" IS NULL) THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND EXISTS (SELECT 1 FROM pecuaria."MedicaoLeite" m JOIN pecuaria."VinculoMedicaoEntradaLeite" v ON v."medicaoId"=m.id WHERE m."participanteId"=OLD.id AND v.ativo) THEN
   RAISE EXCEPTION 'Evidência da finalidade usada em medição é imutável; regularize o histórico' USING ERRCODE='23514';
 END IF;
 SELECT "dataOperacional" INTO dia FROM pecuaria."DiaProducaoLeite" WHERE id=NEW."diaId";
 SELECT count(*) INTO quantidade FROM pecuaria."finalidades_producao_na_data"(NEW."animalId",dia);
 IF quantidade<>1 OR NOT EXISTS (SELECT 1 FROM pecuaria."finalidades_producao_na_data"(NEW."animalId",dia) WHERE id=NEW."finalidadeId" AND aptidao='LEITE')
 OR NEW."finalidadeSnapshot" IS NULL OR NEW."finalidadeSnapshot"->>'regra' IS DISTINCT FROM 'FINALIDADE_LEITE_V1'
 OR NEW."finalidadeSnapshot"->>'aptidao' IS DISTINCT FROM 'LEITE'
 OR NEW."finalidadeSnapshot"->>'finalidadeId' IS DISTINCT FROM NEW."finalidadeId"
 OR NEW."finalidadeSnapshot"->>'dataOperacional' IS DISTINCT FROM to_char(dia,'YYYY-MM-DD') THEN
   RAISE EXCEPTION 'Produção exige uma única finalidade Leite comprovada na data' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "ParticipanteProducaoLeite_finalidade_evidencia" BEFORE INSERT OR UPDATE ON pecuaria."ParticipanteProducaoLeite"
 FOR EACH ROW EXECUTE FUNCTION pecuaria."conferir_evidencia_finalidade_leite"();

CREATE FUNCTION pecuaria."proteger_finalidade_com_producao"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE animal_id text; inicio date; fim date;
BEGIN
 animal_id:=CASE WHEN TG_OP='DELETE' THEN OLD."animalId" ELSE NEW."animalId" END;
 IF TG_OP='UPDATE' AND OLD."animalId" IS DISTINCT FROM NEW."animalId" THEN
  -- A troca de proprietário não pode deslocar a evidência do animal original.
  PERFORM pg_advisory_xact_lock(h) FROM
   (SELECT DISTINCT hashtext('pec-animal:'||k) AS h FROM unnest(ARRAY[OLD."animalId",NEW."animalId"]) AS k) chaves ORDER BY h;
  IF EXISTS (SELECT 1 FROM pecuaria."ParticipanteProducaoLeite" WHERE "finalidadeId"=OLD.id) OR EXISTS (
   SELECT 1 FROM pecuaria."ParticipanteProducaoLeite" p JOIN pecuaria."DiaProducaoLeite" d ON d.id=p."diaId"
   WHERE p."animalId"=OLD."animalId" AND p."excluidoEm" IS NULL AND d."dataOperacional">=OLD.desde AND (OLD.ate IS NULL OR d."dataOperacional"<OLD.ate)
    AND ((SELECT count(*) FROM pecuaria."finalidades_producao_na_data"(OLD."animalId",d."dataOperacional") f)<>1
     OR NOT EXISTS (SELECT 1 FROM pecuaria."finalidades_producao_na_data"(OLD."animalId",d."dataOperacional") f WHERE f.aptidao='LEITE' ))
  ) THEN RAISE EXCEPTION 'Troca de animal da finalidade invalida evidência de ordenha do animal original' USING ERRCODE='23514'; END IF;
 END IF;
 inicio:=CASE WHEN TG_OP='INSERT' THEN NEW.desde WHEN TG_OP='DELETE' THEN OLD.desde ELSE LEAST(OLD.desde,NEW.desde) END;
 fim:=CASE WHEN TG_OP='INSERT' THEN NEW.ate WHEN TG_OP='DELETE' THEN OLD.ate WHEN OLD.ate IS NULL OR NEW.ate IS NULL THEN NULL ELSE GREATEST(OLD.ate,NEW.ate) END;
 IF TG_OP='UPDATE' AND ROW(OLD."animalId",OLD.aptidao,OLD.desde) IS NOT DISTINCT FROM ROW(NEW."animalId",NEW.aptidao,NEW.desde) THEN
   inicio:=LEAST(COALESCE(OLD.ate,'infinity'::date),COALESCE(NEW.ate,'infinity'::date));
   fim:=GREATEST(COALESCE(OLD.ate,'infinity'::date),COALESCE(NEW.ate,'infinity'::date));
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext('pec-animal:'||animal_id));
 IF EXISTS (
  SELECT 1 FROM pecuaria."ParticipanteProducaoLeite" p JOIN pecuaria."DiaProducaoLeite" d ON d.id=p."diaId"
  WHERE p."animalId"=animal_id AND p."excluidoEm" IS NULL AND d."dataOperacional">=inicio AND (fim IS NULL OR d."dataOperacional"<fim) AND (
   (SELECT count(*) FROM pecuaria."finalidades_producao_na_data"(animal_id,d."dataOperacional") f)<>1
   OR NOT EXISTS (SELECT 1 FROM pecuaria."finalidades_producao_na_data"(animal_id,d."dataOperacional") f WHERE f.aptidao='LEITE' )
  )
 ) THEN RAISE EXCEPTION 'Mudança de finalidade invalida ordenha; concilie explicitamente a folha antes de alterar' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "FinalidadeAnimal_proteger_producao" AFTER INSERT OR UPDATE OR DELETE ON pecuaria."FinalidadeAnimal"
 DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION pecuaria."proteger_finalidade_com_producao"();

-- Também protege os caminhos SQL de medição e de vínculo físico, além dos serviços.
CREATE FUNCTION pecuaria."exigir_finalidade_medicao_leite"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE participante_id text; animal_id text; finalidade_id text; evidencia jsonb; dia date; quantidade integer;
BEGIN
 IF TG_TABLE_NAME='MedicaoLeite' THEN
   IF NEW.estado='PENDENTE' THEN RETURN NEW; END IF;
   participante_id:=NEW."participanteId";
 ELSE
   IF NOT NEW.ativo THEN RETURN NEW; END IF;
   SELECT "participanteId" INTO participante_id FROM pecuaria."MedicaoLeite" WHERE id=NEW."medicaoId";
 END IF;
 SELECT p."animalId",p."finalidadeId",p."finalidadeSnapshot",d."dataOperacional" INTO animal_id,finalidade_id,evidencia,dia
 FROM pecuaria."ParticipanteProducaoLeite" p JOIN pecuaria."DiaProducaoLeite" d ON d.id=p."diaId" WHERE p.id=participante_id;
 PERFORM pg_advisory_xact_lock(hashtext('pec-animal:'||animal_id));
 SELECT count(*) INTO quantidade FROM pecuaria."finalidades_producao_na_data"(animal_id,dia);
 IF quantidade<>1 OR NOT EXISTS (SELECT 1 FROM pecuaria."finalidades_producao_na_data"(animal_id,dia) WHERE id=finalidade_id AND aptidao='LEITE')
 OR evidencia IS NULL OR evidencia->>'regra' IS DISTINCT FROM 'FINALIDADE_LEITE_V1' OR evidencia->>'aptidao' IS DISTINCT FROM 'LEITE'
 OR evidencia->>'dataOperacional' IS DISTINCT FROM to_char(dia,'YYYY-MM-DD') OR evidencia->>'finalidadeId' IS DISTINCT FROM finalidade_id THEN
   RAISE EXCEPTION 'Medição ou confirmação exige finalidade Leite histórica comprovada' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "MedicaoLeite_finalidade" BEFORE INSERT OR UPDATE ON pecuaria."MedicaoLeite"
 FOR EACH ROW EXECUTE FUNCTION pecuaria."exigir_finalidade_medicao_leite"();
CREATE TRIGGER "VinculoMedicaoEntradaLeite_finalidade" BEFORE INSERT OR UPDATE ON pecuaria."VinculoMedicaoEntradaLeite"
 FOR EACH ROW EXECUTE FUNCTION pecuaria."exigir_finalidade_medicao_leite"();

-- A exceção depende da baixa ativa, portanto sua retirada também precisa conferir
-- o estado final. O estorno normal reabre a finalidade no mesmo commit.
CREATE FUNCTION pecuaria."proteger_baixa_com_producao"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE animais text[]; datas date[]; animal_id text; dia date;
BEGIN
 IF TG_OP='INSERT' THEN animais:=ARRAY[NEW."animalId"]; datas:=ARRAY[NEW.data];
 ELSIF TG_OP='DELETE' THEN animais:=ARRAY[OLD."animalId"]; datas:=ARRAY[OLD.data];
 ELSE animais:=ARRAY[OLD."animalId",NEW."animalId"]; datas:=ARRAY[OLD.data,NEW.data]; END IF;
 PERFORM pg_advisory_xact_lock(h) FROM (SELECT DISTINCT hashtext('pec-animal:'||k) AS h FROM unnest(animais) AS k) chaves ORDER BY h;
 FOR animal_id IN SELECT DISTINCT unnest(animais) LOOP
  FOR dia IN SELECT DISTINCT unnest(datas) LOOP
   IF EXISTS (SELECT 1 FROM pecuaria."ParticipanteProducaoLeite" p JOIN pecuaria."DiaProducaoLeite" d ON d.id=p."diaId"
    WHERE p."animalId"=animal_id AND p."excluidoEm" IS NULL AND d."dataOperacional"=dia AND (
     (SELECT count(*) FROM pecuaria."finalidades_producao_na_data"(animal_id,dia))<>1
     OR NOT EXISTS (SELECT 1 FROM pecuaria."finalidades_producao_na_data"(animal_id,dia) f WHERE f.aptidao='LEITE' AND (p."finalidadeId" IS NULL OR f.id=p."finalidadeId"))
    )) THEN RAISE EXCEPTION 'Alteração da baixa retira a finalidade comprovada da ordenha; regularize ou reabra a finalidade na mesma transação' USING ERRCODE='23514'; END IF;
  END LOOP;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "BaixaAnimal_proteger_producao" AFTER INSERT OR UPDATE OR DELETE ON pecuaria."BaixaAnimal"
 DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION pecuaria."proteger_baixa_com_producao"();
