BEGIN;
-- Reforça os dois lados do vínculo sem alterar os fatos já registrados.
CREATE OR REPLACE FUNCTION pecuaria.conferir_vinculo_pesagem_parto(id_vinculo text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE vinculo pecuaria."VinculoPesagemParto"%ROWTYPE;
  parto pecuaria."PartoAnimal"%ROWTYPE;
  pesagem pecuaria."Pesagem"%ROWTYPE;
  cria pecuaria."CriaParto"%ROWTYPE;
BEGIN
  SELECT * INTO vinculo FROM pecuaria."VinculoPesagemParto" WHERE id = id_vinculo;
  IF NOT FOUND OR vinculo."revogadoEm" IS NOT NULL THEN RETURN; END IF;
  SELECT * INTO STRICT parto FROM pecuaria."PartoAnimal" WHERE id = vinculo."partoId" FOR UPDATE;
  SELECT * INTO STRICT pesagem FROM pecuaria."Pesagem" WHERE id = vinculo."pesagemId" FOR UPDATE;
  IF parto.status <> 'VALIDO' OR pesagem.data < parto.data THEN
    RAISE EXCEPTION 'Pesagem vinculada exige parto válido e data a partir do parto';
  END IF;
  IF vinculo.sujeito = 'MATRIZ' THEN
    IF pesagem."animalId" <> parto."animalId" THEN RAISE EXCEPTION 'Pesagem não pertence à matriz do parto'; END IF;
  ELSE
    SELECT * INTO STRICT cria FROM pecuaria."CriaParto" WHERE id = vinculo."criaId" FOR UPDATE;
    IF cria."partoId" <> parto.id OR NOT cria.viva OR cria."animalId" IS DISTINCT FROM pesagem."animalId"
       OR pesagem.data <> parto.data OR pesagem.tipo <> 'NASCIMENTO' THEN
      RAISE EXCEPTION 'Peso de nascimento exige cria viva deste parto, mesma data e tipo NASCIMENTO';
    END IF;
  END IF;
END $$;

-- O peso pertence à fonte comum. Uma edição por ela invalida formulários de
-- correção do parto que ainda conservam a versão anterior desse complemento.
CREATE FUNCTION pecuaria.atualizar_versao_parto_pesagem() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.data, NEW."pesoKg", NEW.tipo, NEW.origem, NEW.observacao)
      IS DISTINCT FROM ROW(OLD.data, OLD."pesoKg", OLD.tipo, OLD.origem, OLD.observacao) THEN
    UPDATE pecuaria."PartoAnimal" p SET versao = p.versao + 1
      WHERE p.id IN (SELECT v."partoId" FROM pecuaria."VinculoPesagemParto" v
        WHERE v."pesagemId" = NEW.id AND v."revogadoEm" IS NULL);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "Pesagem_versao_parto" AFTER UPDATE ON pecuaria."Pesagem"
  FOR EACH ROW EXECUTE FUNCTION pecuaria.atualizar_versao_parto_pesagem();
-- Falha com contexto caso um ambiente já contenha vínculos incompatíveis.
DO $$ DECLARE vinculo record;
BEGIN
  FOR vinculo IN SELECT id FROM pecuaria."VinculoPesagemParto" WHERE "revogadoEm" IS NULL LOOP
    PERFORM pecuaria.conferir_vinculo_pesagem_parto(vinculo.id);
  END LOOP;
END $$;
COMMIT;
