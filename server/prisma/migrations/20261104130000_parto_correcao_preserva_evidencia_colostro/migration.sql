-- A versão congelada conserva a autoria da evidência usada na parcela.
-- Correções clínicas não alteram sua identidade/data ou a lactação comprovada.
CREATE OR REPLACE FUNCTION pecuaria.proteger_partos_parcelas_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE animal_id text; ids text[]; g record; p jsonb;
BEGIN
 IF TG_OP='DELETE' THEN ids:=ARRAY[OLD."animalId"]; ELSE ids:=ARRAY[OLD."animalId",NEW."animalId"]; END IF;
 FOREACH animal_id IN ARRAY ids LOOP
 FOR g IN SELECT md.*,d."propriedadeId",d."dataOperacional" FROM pecuaria."MedicaoGeralLeite" md
  JOIN pecuaria."SessaoOrdenha" s ON s.id=md."sessaoId" JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId"
  WHERE md."animaisOrigem" @> jsonb_build_array(animal_id) AND md."criterioColostroSnapshot" IS NOT NULL LOOP
  FOR p IN SELECT value FROM jsonb_array_elements(g."criterioColostroSnapshot"->'partos') WHERE value->>'animalId'=animal_id LOOP
   IF NOT EXISTS (SELECT 1 FROM pecuaria."PartoAnimal" pa JOIN pecuaria."LactacaoAnimal" l ON l."partoId"=pa.id AND l."animalId"=pa."animalId"
    WHERE pa.id=p->>'id' AND pa."animalId"=animal_id AND pa.data=(p->>'data')::date
     AND pa.status='VALIDO' AND pa."propriedadeId"=g."propriedadeId" AND l.inicio=pa.data
     AND l.inicio<=g."dataOperacional" AND (l."encerradaEm" IS NULL OR l."encerradaEm">g."dataOperacional"))
   THEN RAISE EXCEPTION 'alteração retira evidência de colostro; regularize a parcela e sua confirmação' USING ERRCODE='23514'; END IF;
  END LOOP;
 END LOOP;
 END LOOP;
 RETURN NULL;
END $$;
