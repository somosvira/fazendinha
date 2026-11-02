-- Estrutura e proteções somente. Nenhum perfil ou participação histórica é criado.
-- Ofertas confirmadas são fatos: corrigir/desfazer a permanência deve revalidar os
-- seus destinatários, mesmo quando a oferta não é alterada nessa transação.
CREATE FUNCTION pecuaria.proteger_permanencia_ofertas_bezerreiro() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE animal_id text;
BEGIN
 animal_id := CASE WHEN TG_OP='DELETE' THEN OLD."animalId" ELSE NEW."animalId" END;
 IF EXISTS (
   SELECT 1 FROM pecuaria."GrupoOfertaBezerreiro" g
   JOIN pecuaria."OfertaBezerreiro" o ON o.id=g."ofertaId"
   CROSS JOIN LATERAL jsonb_array_elements(g."participantesSnapshot") s
   WHERE o.status='CONFIRMADO' AND s->>'animalId'=animal_id
   AND NOT EXISTS (
     SELECT 1 FROM pecuaria."ParticipacaoBezerreiro" p
     WHERE p."animalId"=animal_id AND p."perfilId"=o."perfilId"
       AND p.desde<=o.data AND (p.ate IS NULL OR p.ate>o.data)
   )
 ) THEN RAISE EXCEPTION 'Regularize ou estorne as ofertas incompatíveis antes de corrigir a permanência no Bezerreiro' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "ParticipacaoBezerreiro_ofertas_localizacao"
 AFTER INSERT OR UPDATE OR DELETE ON pecuaria."ParticipacaoBezerreiro"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_permanencia_ofertas_bezerreiro();

CREATE FUNCTION pecuaria.proteger_ativacao_perfil_bezerreiro() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 -- O lote é o ponto de serialização compartilhado com movimentações/cadastro.
 PERFORM 1 FROM pecuaria."Lote" WHERE id=NEW."loteId" FOR UPDATE;
 IF NOT NEW.ativo AND (EXISTS(SELECT 1 FROM pecuaria."LocalizacaoAnimal" WHERE "loteId"=NEW."loteId" AND ate IS NULL)
   OR EXISTS(SELECT 1 FROM pecuaria."ParticipacaoBezerreiro" WHERE "perfilId"=NEW.id AND ate IS NULL)) THEN
   RAISE EXCEPTION 'Movimente os animais e encerre as participações antes de desativar o perfil do Bezerreiro' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "PerfilBezerreiro_ativacao_localizacao" BEFORE INSERT OR UPDATE ON pecuaria."PerfilBezerreiro"
 FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_ativacao_perfil_bezerreiro();

-- Falha explícita se um novo escritor esquecer a integração; não faz carga histórica.
CREATE FUNCTION pecuaria.conferir_entrada_localizacao_bezerreiro() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE perfil_id text; cobertura datemultirange; l record;
BEGIN
 IF TG_TABLE_NAME='PerfilBezerreiro' THEN
   IF NOT NEW.ativo THEN RETURN NULL; END IF;
   FOR l IN SELECT * FROM pecuaria."LocalizacaoAnimal" WHERE "loteId"=NEW."loteId" AND ate IS NULL LOOP
     SELECT range_agg(daterange(p.desde,p.ate,'[)')) INTO cobertura FROM pecuaria."ParticipacaoBezerreiro" p WHERE p."animalId"=l."animalId" AND p."perfilId"=NEW.id;
     IF cobertura IS NULL OR NOT (daterange(l.desde,l.ate,'[)') <@ cobertura) THEN
       RAISE EXCEPTION 'Lote ocupado exige regularização explícita de todas as participações atuais' USING ERRCODE='23514';
     END IF;
   END LOOP;
 ELSE
   -- A linha pode ter sido desfeita ou corrigida dentro desta mesma transação.
   SELECT * INTO l FROM pecuaria."LocalizacaoAnimal" WHERE id=NEW.id;
   IF NOT FOUND THEN RETURN NULL; END IF;
   SELECT id INTO perfil_id FROM pecuaria."PerfilBezerreiro" WHERE "loteId"=l."loteId" AND "propriedadeId"=l."propriedadeId" AND ativo;
   IF perfil_id IS NULL THEN RETURN NULL; END IF;
   SELECT range_agg(daterange(p.desde,p.ate,'[)')) INTO cobertura FROM pecuaria."ParticipacaoBezerreiro" p WHERE p."animalId"=l."animalId" AND p."perfilId"=perfil_id;
   IF cobertura IS NULL OR NOT (daterange(l.desde,l.ate,'[)') <@ cobertura) THEN
     RAISE EXCEPTION 'Nova localização em Bezerreiro exige participação atômica pelo fluxo compartilhado' USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "LocalizacaoAnimal_entrada_bezerreiro" AFTER INSERT ON pecuaria."LocalizacaoAnimal"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_entrada_localizacao_bezerreiro();
CREATE CONSTRAINT TRIGGER "PerfilBezerreiro_ocupacao" AFTER INSERT OR UPDATE ON pecuaria."PerfilBezerreiro"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_entrada_localizacao_bezerreiro();
