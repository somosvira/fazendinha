-- A retirada é uma anotação histórica, mesmo quando a medição ainda pode ser corrigida.
-- Somente o vínculo ativo reserva a produção; o estorno não altera seus litros nem snapshot.
BEGIN;

CREATE UNIQUE INDEX "LoteColostro_medicaoGeralId_ativo_key"
 ON pecuaria."LoteColostro"("medicaoGeralId") WHERE status<>'ESTORNADO' AND "medicaoGeralId" IS NOT NULL;
CREATE UNIQUE INDEX "LoteColostro_entradaId_ativo_key"
 ON pecuaria."LoteColostro"("entradaId") WHERE status<>'ESTORNADO' AND "entradaId" IS NOT NULL;
CREATE INDEX "LoteColostro_medicaoGeralId_idx" ON pecuaria."LoteColostro"("medicaoGeralId");
CREATE INDEX "LoteColostro_entradaId_idx" ON pecuaria."LoteColostro"("entradaId");
DROP INDEX pecuaria."LoteColostro_medicaoGeralId_key";
DROP INDEX pecuaria."LoteColostro_entradaId_key";

-- Os outros fatos continuam usando conferir_contexto_colostro sem alterações.
-- O novo trigger cobre somente a retirada: a produção atual ainda precisa corresponder
-- ao confirmar/criar, mas já não impede cancelar uma anotação que ficou obsoleta.
CREATE FUNCTION pecuaria.conferir_contexto_retirada_colostro() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p record;
BEGIN
 IF NEW.status='ESTORNADO' THEN
  IF TG_OP<>'UPDATE' THEN
   RAISE EXCEPTION 'Retirada estornada exige histórico anterior' USING ERRCODE='23514';
  END IF;
  IF OLD.status NOT IN ('RASCUNHO','CONFIRMADO') OR NEW.versao<>OLD.versao+1
   OR NEW."estornadoEm" IS NULL OR COALESCE(length(btrim(NEW."motivoEstorno")),0)=0
   OR (to_jsonb(NEW)-ARRAY['status','versao','estornadoEm','estornadoPorId','motivoEstorno'])
      IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','versao','estornadoEm','estornadoPorId','motivoEstorno']) THEN
   RAISE EXCEPTION 'Estorno da retirada preserva integralmente identidade, volume e snapshot' USING ERRCODE='23514';
  END IF;
  IF EXISTS(SELECT 1 FROM pecuaria."OrigemColostro" o WHERE o."loteColostroId"=NEW.id AND o.status<>'ESTORNADO') THEN
   RAISE EXCEPTION 'Regularize a origem e seus consumidores antes de estornar a retirada' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
 END IF;
  SELECT * INTO p FROM pecuaria."PartoAnimal" WHERE id=NEW."partoId";
  IF p.status<>'VALIDO' OR p."animalId"<>NEW."matrizId" OR p."propriedadeId" IS DISTINCT FROM NEW."propriedadeId" OR p.data>NEW.data
   OR (p."ocorridoEm" IS NOT NULL AND NEW."ocorridoEm" IS NOT NULL AND NOT p."horarioEstimado" AND NOT NEW."horarioEstimado" AND p."ocorridoEm">NEW."ocorridoEm") THEN RAISE EXCEPTION 'Retirada incompatível com parto produtor, matriz ou data' USING ERRCODE='23514'; END IF;
  IF NEW."medicaoGeralId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."MedicaoGeralLeite" g JOIN pecuaria."SessaoOrdenha" s ON s.id=g."sessaoId" JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId" WHERE g.id=NEW."medicaoGeralId" AND g.natureza='COLOSTRO' AND g.litros=NEW."quantidadeLitros" AND d."propriedadeId"=NEW."propriedadeId" AND d."dataOperacional"=NEW.data AND g."animaisOrigem" @> jsonb_build_array(NEW."matrizId") AND jsonb_array_length(g."animaisOrigem")=1) THEN RAISE EXCEPTION 'Retirada exige parcela geral compatível e inteira' USING ERRCODE='23514'; END IF;
  IF NEW."entradaId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."EntradaProducaoLeite" e JOIN public."MovimentoEstoque" m ON m.id=e."movimentoId" JOIN pecuaria."ClassificacaoEntradaLeite" c ON c."entradaId"=e.id AND c.versao=(SELECT max(versao) FROM pecuaria."ClassificacaoEntradaLeite" WHERE "entradaId"=e.id) WHERE e.id=NEW."entradaId" AND e.status='CONFIRMADA' AND m."propriedadeId"=NEW."propriedadeId" AND m.data=NEW.data AND m.quantidade=NEW."quantidadeLitros" AND c.natureza='COLOSTRO' AND (NEW."medicaoGeralId" IS NULL OR e."medicaoGeralId"=NEW."medicaoGeralId")) THEN RAISE EXCEPTION 'Retirada exige entrada inteira confirmada da mesma origem' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
DROP TRIGGER "LoteColostro_contexto" ON pecuaria."LoteColostro";
CREATE CONSTRAINT TRIGGER "LoteColostro_contexto" AFTER INSERT OR UPDATE ON pecuaria."LoteColostro"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_contexto_retirada_colostro();

COMMIT;
