BEGIN;
-- Horários estimados conservam apenas a garantia de data; horas conhecidas
-- são comparadas tanto na alteração do parto quanto do fornecimento.
CREATE OR REPLACE FUNCTION pecuaria.conferir_fornecimento_colostro(id_fornecimento text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE fornecimento pecuaria."FornecimentoColostro"%ROWTYPE;
  cria pecuaria."CriaParto"%ROWTYPE;
  parto pecuaria."PartoAnimal"%ROWTYPE;
  id_parto text;
BEGIN
  SELECT * INTO fornecimento FROM pecuaria."FornecimentoColostro" WHERE id = id_fornecimento;
  IF NOT FOUND OR fornecimento.status <> 'VALIDO' THEN RETURN; END IF;
  SELECT "partoId" INTO STRICT id_parto FROM pecuaria."CriaParto" WHERE id = fornecimento."criaId";
  SELECT * INTO STRICT parto FROM pecuaria."PartoAnimal" WHERE id = id_parto FOR UPDATE;
  SELECT * INTO STRICT cria FROM pecuaria."CriaParto" WHERE id = fornecimento."criaId" FOR UPDATE;
  -- Cria pode ter mudado de parto durante a obtenção das travas. Não validar
  -- contra um parto antigo: rejeitar a disputa para repetir com contexto atual.
  IF cria."partoId" <> parto.id THEN
    RAISE EXCEPTION 'Contexto da cria mudou durante o fornecimento de colostro' USING ERRCODE = '40001';
  END IF;
  IF parto."ocorridoEm" IS NOT NULL AND NOT parto."horarioEstimado"
     AND fornecimento."ocorridoEm" IS NOT NULL AND NOT fornecimento."horarioEstimado"
     AND fornecimento."ocorridoEm" < parto."ocorridoEm" THEN
    RAISE EXCEPTION 'Fornecimento não pode anteceder o horário conhecido do nascimento';
  END IF;
  IF NOT cria.viva OR parto.status <> 'VALIDO' OR fornecimento.data < parto.data THEN
    RAISE EXCEPTION 'Colostro exige cria viva, parto válido e fornecimento a partir do parto';
  END IF;
END $$;
COMMIT;
