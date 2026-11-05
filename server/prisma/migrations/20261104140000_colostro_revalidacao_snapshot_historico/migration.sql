-- Novas evidências exigem a versão atual; revalidações preservam a versão histórica.
CREATE OR REPLACE FUNCTION pecuaria.conferir_conjunto_parcelas_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE sid text; g record; contexto record; p jsonb; animal_id text; nova_evidencia boolean := false;
BEGIN
 IF TG_TABLE_NAME='EntradaProducaoLeite' THEN
  IF NEW."medicaoGeralId" IS NULL OR NEW.status<>'CONFIRMADA' THEN RETURN NEW; END IF;
  SELECT * INTO g FROM pecuaria."MedicaoGeralLeite" WHERE id=NEW."medicaoGeralId";
  IF g."criterioColostroSnapshot" IS NOT NULL AND (
   NEW.snapshot->'recipiente' IS DISTINCT FROM COALESCE(to_jsonb(g.recipiente),'null'::jsonb)
   OR NEW.snapshot->'tanqueId' IS DISTINCT FROM COALESCE(to_jsonb(g."tanqueId"),'null'::jsonb)
   OR NEW.snapshot->'natureza' IS DISTINCT FROM to_jsonb(g.natureza)
   OR NEW.snapshot->'declaracaoDireta' IS DISTINCT FROM COALESCE(g."declaracaoDireta",'null'::jsonb)
   OR NEW.snapshot->'criterioColostroSnapshot' IS DISTINCT FROM g."criterioColostroSnapshot"
   OR NEW.snapshot->'primeiraOrdenhaColostro' IS DISTINCT FROM COALESCE(to_jsonb(g."primeiraOrdenhaColostro"),'null'::jsonb))
  THEN RAISE EXCEPTION 'origem confirmada deve preservar recipiente, natureza e declaração da parcela' USING ERRCODE='23514'; END IF;
  sid:=g."sessaoId";
 ELSE
  sid:=NEW."sessaoId";
  IF TG_OP='INSERT' THEN nova_evidencia:=true;
  ELSE nova_evidencia:=NEW."criterioColostroSnapshot" IS DISTINCT FROM OLD."criterioColostroSnapshot"; END IF;
 END IF;
 PERFORM id FROM pecuaria."SessaoOrdenha" WHERE id=sid FOR NO KEY UPDATE;
 IF EXISTS (SELECT 1 FROM pecuaria."MedicaoGeralLeite" a JOIN pecuaria."MedicaoGeralLeite" b ON a."sessaoId"=b."sessaoId" AND a.id<>b.id
  WHERE a."sessaoId"=sid AND ((a."tanqueId" IS NOT NULL AND EXISTS (SELECT 1 FROM pecuaria."TanqueLeite" ta JOIN pecuaria."TanqueLeite" tb ON ta."propriedadeId"=tb."propriedadeId" AND ta."identidadeId"=tb."identidadeId" WHERE ta.id=a."tanqueId" AND tb.id=b."tanqueId")) OR
   (a."tanqueId" IS NULL AND b."tanqueId" IS NULL AND lower(trim(a.recipiente))=lower(trim(b.recipiente)))))
 THEN RAISE EXCEPTION 'cada parcela exige um recipiente físico distinto na ordenha' USING ERRCODE='23514'; END IF;
 FOR g IN SELECT * FROM pecuaria."MedicaoGeralLeite" WHERE "sessaoId"=sid AND "criterioColostroSnapshot" IS NOT NULL LOOP
  SELECT d."propriedadeId",d."dataOperacional",c."criterioColostro" INTO contexto FROM pecuaria."SessaoOrdenha" s JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId" JOIN pecuaria."ConfiguracaoOrdenha" c ON c.id=d."configuracaoId" WHERE s.id=sid;
  IF g.natureza='COLOSTRO' AND g."primeiraOrdenhaColostro" IS TRUE AND EXISTS (
   SELECT 1 FROM jsonb_array_elements(g."criterioColostroSnapshot"->'partos') atual
    JOIN pecuaria."MedicaoGeralLeite" outra ON outra.id<>g.id AND outra.natureza='COLOSTRO' AND outra."primeiraOrdenhaColostro" IS TRUE
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(outra."criterioColostroSnapshot"->'partos','[]'::jsonb)) anterior
   WHERE atual->>'id'=anterior->>'id' AND atual->>'animalId'=anterior->>'animalId')
  THEN RAISE EXCEPTION 'primeira ordenha do parto já declarada em outra parcela' USING ERRCODE='23514'; END IF;
  FOR p IN SELECT value FROM jsonb_array_elements(g."criterioColostroSnapshot"->'partos') LOOP
   IF NOT EXISTS (SELECT 1 FROM pecuaria."PartoAnimal" pa JOIN pecuaria."LactacaoAnimal" l ON l."partoId"=pa.id AND l."animalId"=pa."animalId"
    WHERE pa.id=p->>'id' AND pa."animalId"=p->>'animalId' AND (p->>'versao')::integer>0 AND pa.versao>=(p->>'versao')::integer
     AND (NOT nova_evidencia OR g.id<>NEW.id OR pa.versao=(p->>'versao')::integer) AND pa.data=(p->>'data')::date
     AND pa.status='VALIDO' AND pa."propriedadeId"=contexto."propriedadeId" AND pa.data<=contexto."dataOperacional"
     AND l.inicio=pa.data AND l.inicio<=contexto."dataOperacional" AND (l."encerradaEm" IS NULL OR l."encerradaEm">contexto."dataOperacional")
     AND g."animaisOrigem" @> jsonb_build_array(pa."animalId"))
   THEN RAISE EXCEPTION 'contexto de colostro exige parto real e lactação histórica comprovada' USING ERRCODE='23514'; END IF;
  END LOOP;
  IF g.natureza IN ('NAO_COMERCIAL','COLOSTRO') AND g."declaracaoDireta" IS NULL AND jsonb_array_length(g."animaisOrigem")=0 THEN RAISE EXCEPTION 'origens desconhecidas exigem declaração direta justificada' USING ERRCODE='23514'; END IF;
  IF g.natureza='COLOSTRO' AND g."declaracaoDireta" IS NULL THEN
   IF contexto."criterioColostro" IS NULL OR (contexto."criterioColostro"->>'tipo'='PRIMEIRA_ORDENHA' AND g."primeiraOrdenhaColostro" IS DISTINCT FROM true) THEN RAISE EXCEPTION 'colostro exige critério vigente e declaração explícita da primeira ordenha' USING ERRCODE='23514'; END IF;
   FOR animal_id IN SELECT jsonb_array_elements_text(g."animaisOrigem") LOOP
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(g."criterioColostroSnapshot"->'partos') pa WHERE pa->>'animalId'=animal_id
     AND (pa->>'data')::date<=contexto."dataOperacional" AND (contexto."criterioColostro"->>'tipo'='PRIMEIRA_ORDENHA' OR contexto."dataOperacional"<(pa->>'data')::date+(contexto."criterioColostro"->>'dias')::integer))
    THEN RAISE EXCEPTION 'animal sem parto compatível exige declaração direta' USING ERRCODE='23514'; END IF;
   END LOOP;
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
