BEGIN;

-- Fornecimento à cria, em eventos independentes; não há carga ou conversão
-- presumida de colostro legado, escala clínica ou resultado de proteína sérica.
CREATE TABLE pecuaria."FornecimentoColostro" (
  id TEXT NOT NULL PRIMARY KEY,
  "criaId" TEXT NOT NULL,
  "propriedadeId" INTEGER NOT NULL,
  data DATE NOT NULL,
  "ocorridoEm" TIMESTAMPTZ(3),
  "horarioEstimado" BOOLEAN NOT NULL DEFAULT false,
  "quantidadeLitros" DECIMAL(10,3),
  "unidadeInformada" TEXT,
  "metodoQualidade" TEXT,
  "qualidadeBrix" DECIMAL(5,2),
  "qualidadeClassificacao" TEXT,
  tipo TEXT,
  forma TEXT,
  responsavel TEXT,
  observacao TEXT,
  status pecuaria."StatusFatoPecuariaV3" NOT NULL DEFAULT 'VALIDO',
  versao INTEGER NOT NULL DEFAULT 1,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criadoPorId" INTEGER,
  "anuladoEm" TIMESTAMP(3),
  "motivoAnulacao" TEXT,
  CONSTRAINT "FornecimentoColostro_criaId_fkey" FOREIGN KEY ("criaId") REFERENCES pecuaria."CriaParto"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FornecimentoColostro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FornecimentoColostro_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FornecimentoColostro_versao" CHECK (versao > 0),
  CONSTRAINT "FornecimentoColostro_horario" CHECK (
    (NOT "horarioEstimado" OR "ocorridoEm" IS NOT NULL)
    AND ("ocorridoEm" IS NULL OR ("ocorridoEm" AT TIME ZONE 'America/Sao_Paulo')::date = data)),
  CONSTRAINT "FornecimentoColostro_quantidade" CHECK ("quantidadeLitros" IS NULL OR ("quantidadeLitros" > 0 AND "quantidadeLitros" <> 'NaN'::numeric)),
  CONSTRAINT "FornecimentoColostro_unidade" CHECK ("unidadeInformada" IS NULL OR "unidadeInformada" IN ('L', 'ML')),
  CONSTRAINT "FornecimentoColostro_tipo" CHECK (tipo IS NULL OR tipo IN ('FRESCO','DESCONGELADO','PO')),
  CONSTRAINT "FornecimentoColostro_forma" CHECK (forma IS NULL OR forma IN ('BALDE','BALDE_COM_BICO','MAE','MAMADEIRA','SONDA')),
  CONSTRAINT "FornecimentoColostro_metodo" CHECK (
    "metodoQualidade" IS NULL OR "metodoQualidade" IN ('REFRATOMETRO_BRIX','COLOSTROMETRO')),
  CONSTRAINT "FornecimentoColostro_brix" CHECK (
    "qualidadeBrix" IS NULL OR ("qualidadeBrix" >= 0 AND "qualidadeBrix" <= 100)),
  CONSTRAINT "FornecimentoColostro_classificacao" CHECK (
    "qualidadeClassificacao" IS NULL OR "qualidadeClassificacao" IN ('ALTA','MEDIA','BAIXA')),
  CONSTRAINT "FornecimentoColostro_qualidade_coerente" CHECK (
    ("qualidadeBrix" IS NULL OR "metodoQualidade" IS NOT DISTINCT FROM 'REFRATOMETRO_BRIX')
    AND ("qualidadeClassificacao" IS NULL OR "metodoQualidade" IS NOT DISTINCT FROM 'COLOSTROMETRO')),
  CONSTRAINT "FornecimentoColostro_anulacao" CHECK (
    (status = 'VALIDO' AND "anuladoEm" IS NULL AND "motivoAnulacao" IS NULL)
    OR (status = 'ANULADO' AND "anuladoEm" IS NOT NULL AND "motivoAnulacao" IS NOT NULL AND length(btrim("motivoAnulacao")) > 0))
);
CREATE INDEX "FornecimentoColostro_criaId_data_idx" ON pecuaria."FornecimentoColostro" ("criaId", data);
CREATE INDEX "FornecimentoColostro_propriedadeId_data_idx" ON pecuaria."FornecimentoColostro" ("propriedadeId", data);

-- Locks e conferência diferida permitem corrigir parto/cria/fornecimento na mesma
-- transação e evitam que uma atualização genérica contradiga fatos ainda válidos.
CREATE FUNCTION pecuaria.conferir_fornecimento_colostro(id_fornecimento text) RETURNS void LANGUAGE plpgsql AS $$
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
  IF NOT cria.viva OR parto.status <> 'VALIDO' OR fornecimento.data < parto.data THEN
    RAISE EXCEPTION 'Colostro exige cria viva, parto válido e fornecimento a partir do parto';
  END IF;
END $$;
CREATE FUNCTION pecuaria.conferir_colostro_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE id_fornecimento text;
BEGIN
  IF TG_TABLE_NAME = 'FornecimentoColostro' THEN
    PERFORM pecuaria.conferir_fornecimento_colostro(NEW.id);
  ELSIF TG_TABLE_NAME = 'CriaParto' THEN
    FOR id_fornecimento IN SELECT f.id FROM pecuaria."FornecimentoColostro" f
      WHERE f."criaId" = NEW.id AND f.status = 'VALIDO' ORDER BY f.id
    LOOP PERFORM pecuaria.conferir_fornecimento_colostro(id_fornecimento); END LOOP;
  ELSE
    FOR id_fornecimento IN SELECT f.id FROM pecuaria."FornecimentoColostro" f
      JOIN pecuaria."CriaParto" c ON c.id = f."criaId"
      WHERE c."partoId" = NEW.id AND f.status = 'VALIDO' ORDER BY f.id
    LOOP PERFORM pecuaria.conferir_fornecimento_colostro(id_fornecimento); END LOOP;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "FornecimentoColostro_contexto" AFTER INSERT OR UPDATE ON pecuaria."FornecimentoColostro"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_colostro_trigger();
CREATE CONSTRAINT TRIGGER "CriaParto_colostro" AFTER UPDATE ON pecuaria."CriaParto"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_colostro_trigger();
CREATE CONSTRAINT TRIGGER "PartoAnimal_colostro" AFTER UPDATE ON pecuaria."PartoAnimal"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_colostro_trigger();

COMMIT;
