-- Proteção aditiva das origens identificadas da aferição geral. Não preenche vínculos,
-- não distribui litros e não reinterpreta snapshots de entradas anuladas.
CREATE INDEX "MedicaoGeralLeite_animaisOrigem_gin" ON pecuaria."MedicaoGeralLeite" USING GIN ("animaisOrigem" jsonb_path_ops);
CREATE FUNCTION pecuaria.travar_animais_origem_geral(ids text[]) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(h) FROM
 (SELECT DISTINCT hashtext('pec-animal:'||id) h FROM unnest(ids) id) chaves ORDER BY h;
END $$;

CREATE FUNCTION pecuaria.travar_historico_origem_geral() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ids text[];
BEGIN
 IF TG_TABLE_NAME='Animal' THEN
  IF TG_OP='INSERT' THEN ids:=ARRAY[NEW.id];
  ELSIF TG_OP='DELETE' THEN ids:=ARRAY[OLD.id]; ELSE ids:=ARRAY[OLD.id,NEW.id]; END IF;
 ELSE
  IF TG_OP='INSERT' THEN ids:=ARRAY[NEW."animalId"];
  ELSIF TG_OP='DELETE' THEN ids:=ARRAY[OLD."animalId"]; ELSE ids:=ARRAY[OLD."animalId",NEW."animalId"]; END IF;
 END IF;
 PERFORM pecuaria.travar_animais_origem_geral(ids);
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER "FinalidadeAnimal_travar_origem_geral" BEFORE INSERT OR UPDATE OR DELETE ON pecuaria."FinalidadeAnimal"
 FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_historico_origem_geral();
CREATE TRIGGER "BaixaAnimal_travar_origem_geral" BEFORE INSERT OR UPDATE OR DELETE ON pecuaria."BaixaAnimal"
 FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_historico_origem_geral();
CREATE TRIGGER "LocalizacaoAnimal_travar_origem_geral" BEFORE INSERT OR UPDATE OR DELETE ON pecuaria."LocalizacaoAnimal"
 FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_historico_origem_geral();
CREATE TRIGGER "LactacaoAnimal_travar_origem_geral" BEFORE INSERT OR UPDATE OR DELETE ON pecuaria."LactacaoAnimal"
 FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_historico_origem_geral();
CREATE TRIGGER "Animal_travar_origem_geral" BEFORE UPDATE OR DELETE ON pecuaria."Animal"
 FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_historico_origem_geral();

-- O chamador trava os animais antes da sessão; este gatilho conserva a ordem no SQL direto.
CREATE FUNCTION pecuaria.travar_afericao_origem_geral() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ids text[];
BEGIN
 SELECT array_agg(DISTINCT id) INTO ids FROM jsonb_array_elements_text(
  NEW."animaisOrigem" || CASE WHEN TG_OP='UPDATE' THEN OLD."animaisOrigem" ELSE '[]'::jsonb END) id;
 PERFORM pecuaria.travar_animais_origem_geral(ids);
 RETURN NEW;
END $$;
CREATE TRIGGER "MedicaoGeralLeite_00_travar_origens" BEFORE INSERT OR UPDATE ON pecuaria."MedicaoGeralLeite"
 FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_afericao_origem_geral();

-- Uma confirmação SQL trava as mesmas origens e sessão antes de gravar o vínculo físico.
CREATE FUNCTION pecuaria.travar_entrada_origem_geral() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE g record; ids text[];
BEGIN
 IF NEW."medicaoGeralId" IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO g FROM pecuaria."MedicaoGeralLeite" WHERE id=NEW."medicaoGeralId";
 SELECT array_agg(id) INTO ids FROM jsonb_array_elements_text(g."animaisOrigem") id;
 PERFORM pecuaria.travar_animais_origem_geral(ids);
 PERFORM id FROM pecuaria."SessaoOrdenha" WHERE id=g."sessaoId" FOR NO KEY UPDATE;
 RETURN NEW;
END $$;
CREATE TRIGGER "EntradaProducaoLeite_00_travar_origens" BEFORE INSERT OR UPDATE ON pecuaria."EntradaProducaoLeite"
 FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_entrada_origem_geral();

CREATE FUNCTION pecuaria.conferir_historico_origem_geral(animal_id text, inicio date DEFAULT NULL, fim date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE fato record; animal record; local_id text; finalidade_id text; n integer; evidencia jsonb;
BEGIN
 FOR fato IN SELECT g.id,d."propriedadeId",d."dataOperacional" dia
  FROM pecuaria."MedicaoGeralLeite" g JOIN pecuaria."SessaoOrdenha" s ON s.id=g."sessaoId"
  JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId"
  WHERE g."animaisOrigem" @> jsonb_build_array(animal_id)
   AND (inicio IS NULL OR d."dataOperacional">=inicio) AND (fim IS NULL OR d."dataOperacional"<fim)
 LOOP
  SELECT * INTO animal FROM pecuaria."Animal" WHERE id=animal_id;
  IF NOT FOUND OR animal.sexo<>'F' OR animal."dataNascimento">fato.dia OR animal."dataEntrada">fato.dia
   OR EXISTS (SELECT 1 FROM pecuaria."BaixaAnimal" b WHERE b."animalId"=animal_id AND b."estornadaEm" IS NULL AND b.data<fato.dia) THEN
   RAISE EXCEPTION 'Alteração invalida animal ou data de origem geral; regularize a aferição e suas confirmações' USING ERRCODE='23514';
  END IF;
  SELECT count(*),min(l.id) INTO n,local_id FROM pecuaria."LocalizacaoAnimal" l
   WHERE l."animalId"=animal_id AND l.desde<=fato.dia AND (l.ate IS NULL OR l.ate>fato.dia OR EXISTS (
    SELECT 1 FROM pecuaria."BaixaAnimal" b WHERE b."animalId"=animal_id AND b."estornadaEm" IS NULL AND b.data=fato.dia AND b."localizacaoFechadaId"=l.id));
  IF n<>1 OR NOT EXISTS (SELECT 1 FROM pecuaria."LocalizacaoAnimal" WHERE id=local_id AND "propriedadeId"=fato."propriedadeId") THEN
   RAISE EXCEPTION 'Alteração invalida sítio de origem geral; regularize a aferição e suas confirmações' USING ERRCODE='23514';
  END IF;
  SELECT count(*),min(f.id) INTO n,finalidade_id FROM pecuaria."finalidades_producao_na_data"(animal_id,fato.dia) f;
  IF n<>1 OR NOT EXISTS (SELECT 1 FROM pecuaria."finalidades_producao_na_data"(animal_id,fato.dia) f WHERE f.aptidao='LEITE') THEN
   RAISE EXCEPTION 'Alteração invalida finalidade Leite de origem geral; regularize a aferição e suas confirmações' USING ERRCODE='23514';
  END IF;
  SELECT count(*) INTO n FROM pecuaria."LactacaoAnimal" l WHERE l."animalId"=animal_id AND l.inicio<=fato.dia AND (l."encerradaEm" IS NULL OR l."encerradaEm">fato.dia);
  IF n>1 OR n=0 AND EXISTS (SELECT 1 FROM pecuaria."LactacaoAnimal" l WHERE l."animalId"=animal_id AND l."encerradaEm"<=fato.dia) THEN
   RAISE EXCEPTION 'Alteração invalida lactação de origem geral; regularize a aferição e suas confirmações' USING ERRCODE='23514';
  END IF;
  -- Somente entradas ainda confirmadas exigem a identidade da evidência congelada.
  FOR evidencia IN SELECT a FROM pecuaria."EntradaProducaoLeite" e
   CROSS JOIN LATERAL jsonb_array_elements(e.snapshot->'animaisOrigem') a
   WHERE e."medicaoGeralId"=fato.id AND e.status='CONFIRMADA' AND a->>'animalId'=animal_id
  LOOP
   IF evidencia->>'finalidadeId' IS DISTINCT FROM finalidade_id OR evidencia->>'localizacaoId' IS DISTINCT FROM local_id
    OR evidencia->>'lactacaoId' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pecuaria."LactacaoAnimal" l
     WHERE l.id=evidencia->>'lactacaoId' AND l."animalId"=animal_id AND l.inicio<=fato.dia AND (l."encerradaEm" IS NULL OR l."encerradaEm">fato.dia)) THEN
    RAISE EXCEPTION 'Alteração retira evidência de origem geral confirmada; regularize a entrada antes' USING ERRCODE='23514';
   END IF;
  END LOOP;
 END LOOP;
END $$;

-- Confere o estado final, permitindo regularização explícita na mesma transação.
CREATE FUNCTION pecuaria.proteger_historico_origem_geral() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ids text[]; animal_id text; inicio date; fim date; atual record;
BEGIN
 IF TG_TABLE_NAME='Animal' THEN
  IF TG_OP='UPDATE' AND ROW(NEW.id,NEW.sexo,NEW."dataNascimento",NEW."dataEntrada") IS NOT DISTINCT FROM ROW(OLD.id,OLD.sexo,OLD."dataNascimento",OLD."dataEntrada") THEN RETURN NEW; END IF;
  IF TG_OP='DELETE' THEN ids:=ARRAY[OLD.id]; ELSE ids:=ARRAY[OLD.id,NEW.id]; END IF;
 ELSE
  IF TG_OP='INSERT' THEN ids:=ARRAY[NEW."animalId"];
  ELSIF TG_OP='DELETE' THEN ids:=ARRAY[OLD."animalId"]; ELSE ids:=ARRAY[OLD."animalId",NEW."animalId"]; END IF;
 END IF;
 IF TG_TABLE_NAME='FinalidadeAnimal' THEN
  inicio:=CASE WHEN TG_OP='INSERT' THEN NEW.desde WHEN TG_OP='DELETE' THEN OLD.desde ELSE LEAST(OLD.desde,NEW.desde) END;
  fim:=CASE WHEN TG_OP='INSERT' THEN NEW.ate WHEN TG_OP='DELETE' THEN OLD.ate WHEN OLD.ate IS NULL OR NEW.ate IS NULL THEN NULL ELSE GREATEST(OLD.ate,NEW.ate) END;
  IF TG_OP='UPDATE' AND ROW(OLD."animalId",OLD.aptidao,OLD.desde) IS NOT DISTINCT FROM ROW(NEW."animalId",NEW.aptidao,NEW.desde) THEN
   inicio:=LEAST(COALESCE(OLD.ate,'infinity'::date),COALESCE(NEW.ate,'infinity'::date));
   fim:=GREATEST(COALESCE(OLD.ate,'infinity'::date),COALESCE(NEW.ate,'infinity'::date));
  END IF;
 END IF;
 FOR animal_id IN SELECT DISTINCT unnest(ids) LOOP
  PERFORM pecuaria.conferir_historico_origem_geral(animal_id,inicio,fim);
 END LOOP;
 IF TG_TABLE_NAME='LactacaoAnimal' AND TG_OP<>'INSERT' THEN
  SELECT * INTO atual FROM pecuaria."LactacaoAnimal" WHERE id=OLD.id;
  -- Uma aferição antes coberta por esta lactação não pode perder sua origem,
  -- mesmo quando ainda não há entrada confirmada nem participante individual.
  IF EXISTS (SELECT 1 FROM pecuaria."MedicaoGeralLeite" g JOIN pecuaria."SessaoOrdenha" s ON s.id=g."sessaoId"
   JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId"
   WHERE g."animaisOrigem" @> jsonb_build_array(OLD."animalId") AND d."dataOperacional">=OLD.inicio
    AND (OLD."encerradaEm" IS NULL OR d."dataOperacional"<OLD."encerradaEm")
    AND (atual.id IS NULL OR atual."animalId"<>OLD."animalId" OR d."dataOperacional"<atual.inicio OR d."dataOperacional">=atual."encerradaEm")) THEN
   RAISE EXCEPTION 'Alteração retira lactação de origem geral guardada; regularize a aferição antes' USING ERRCODE='23514';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "FinalidadeAnimal_proteger_origem_geral" AFTER INSERT OR UPDATE OR DELETE ON pecuaria."FinalidadeAnimal"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_historico_origem_geral();
CREATE CONSTRAINT TRIGGER "Animal_proteger_origem_geral" AFTER UPDATE OR DELETE ON pecuaria."Animal"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_historico_origem_geral();
CREATE CONSTRAINT TRIGGER "BaixaAnimal_proteger_origem_geral" AFTER INSERT OR UPDATE OR DELETE ON pecuaria."BaixaAnimal"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_historico_origem_geral();
CREATE CONSTRAINT TRIGGER "LocalizacaoAnimal_proteger_origem_geral" AFTER INSERT OR UPDATE OR DELETE ON pecuaria."LocalizacaoAnimal"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_historico_origem_geral();
CREATE CONSTRAINT TRIGGER "LactacaoAnimal_proteger_origem_geral" AFTER INSERT OR UPDATE OR DELETE ON pecuaria."LactacaoAnimal"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_historico_origem_geral();

CREATE FUNCTION pecuaria.conferir_afericao_origem_geral() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE g record; entrada record; dia date; ids text[]; animal_id text;
BEGIN
 IF TG_TABLE_NAME='EntradaProducaoLeite' THEN
  -- ANULADA preserva a versão anterior como evidência, sem exigir o cadastro atual.
  SELECT * INTO entrada FROM pecuaria."EntradaProducaoLeite" WHERE id=NEW.id;
  IF entrada."medicaoGeralId" IS NULL OR entrada.status<>'CONFIRMADA' THEN RETURN NEW; END IF;
  SELECT * INTO g FROM pecuaria."MedicaoGeralLeite" WHERE id=entrada."medicaoGeralId";
  IF jsonb_typeof(entrada.snapshot->'animaisOrigem') IS DISTINCT FROM 'array' OR EXISTS (
   SELECT 1 FROM jsonb_array_elements(g."animaisOrigem") id WHERE NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(entrada.snapshot->'animaisOrigem') a WHERE a->>'animalId'=id#>>'{}'))
   OR EXISTS (SELECT 1 FROM jsonb_array_elements(entrada.snapshot->'animaisOrigem') a
    WHERE NOT (g."animaisOrigem" @> jsonb_build_array(a->>'animalId'))) THEN
   RAISE EXCEPTION 'Snapshot deve preservar exatamente os animais da aferição geral' USING ERRCODE='23514';
  END IF;
 ELSE
  -- A aferição pode ter recebido outra correção na mesma transação.
  SELECT * INTO g FROM pecuaria."MedicaoGeralLeite" WHERE id=NEW.id;
 END IF;
 SELECT d."dataOperacional" INTO dia FROM pecuaria."SessaoOrdenha" s JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId" WHERE s.id=g."sessaoId";
 SELECT array_agg(id) INTO ids FROM jsonb_array_elements_text(g."animaisOrigem") id;
 PERFORM pecuaria.travar_animais_origem_geral(ids);
 FOR animal_id IN SELECT DISTINCT unnest(ids) LOOP
  PERFORM pecuaria.conferir_historico_origem_geral(animal_id,dia,dia+1);
 END LOOP;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "MedicaoGeralLeite_origens_historicas" AFTER INSERT OR UPDATE ON pecuaria."MedicaoGeralLeite"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_afericao_origem_geral();
CREATE CONSTRAINT TRIGGER "EntradaProducaoLeite_origens_gerais_historicas" AFTER INSERT OR UPDATE ON pecuaria."EntradaProducaoLeite"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_afericao_origem_geral();
