CREATE TABLE pecuaria."FormatoQualidadeLeite" (
  chave TEXT NOT NULL UNIQUE, "hashPayload" TEXT NOT NULL,
  "tipoExameId" TEXT PRIMARY KEY REFERENCES pecuaria."TipoExame"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "criadoPorId" INTEGER
);
CREATE TABLE pecuaria."AmostraQualidadeLeite" (
  id TEXT PRIMARY KEY, "propriedadeId" INTEGER NOT NULL REFERENCES public."Propriedade"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  data DATE NOT NULL, sujeito TEXT NOT NULL,
  "tipoExameId" TEXT NOT NULL REFERENCES pecuaria."FormatoQualidadeLeite"("tipoExameId") ON DELETE RESTRICT ON UPDATE CASCADE,
  "exameAnimalId" TEXT UNIQUE REFERENCES pecuaria."ExameAnimal"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "origemColetiva" TEXT, "entradaId" TEXT REFERENCES pecuaria."EntradaProducaoLeite"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "formatoSnapshot" JSONB, realizacao TEXT NOT NULL DEFAULT 'COLETA_REGISTRADA',
  status pecuaria."StatusFatoPecuariaV3" NOT NULL DEFAULT 'VALIDO', versao INTEGER NOT NULL DEFAULT 1,
  responsavel TEXT, "anotacaoOriginal" TEXT, "motivoAnulacao" TEXT, "anuladoEm" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "criadoPorId" INTEGER, "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AmostraQualidadeLeite_sujeito_check" CHECK (
    (sujeito='ANIMAL' AND "exameAnimalId" IS NOT NULL AND "origemColetiva" IS NULL AND "entradaId" IS NULL AND "formatoSnapshot" IS NULL) OR
    (sujeito='COLETIVO' AND "exameAnimalId" IS NULL AND "origemColetiva" IS NOT NULL AND length(btrim("origemColetiva"))>0 AND "formatoSnapshot" IS NOT NULL AND jsonb_typeof("formatoSnapshot")='object')
  ),
  CONSTRAINT "AmostraQualidadeLeite_versao_check" CHECK (versao>0),
  CONSTRAINT "AmostraQualidadeLeite_realizacao_check" CHECK (realizacao IN ('COLETA_REGISTRADA','REALIZADO')),
  CONSTRAINT "AmostraQualidadeLeite_anulacao_check" CHECK ((status='VALIDO' AND "anuladoEm" IS NULL) OR (status='ANULADO' AND "anuladoEm" IS NOT NULL AND length(btrim("motivoAnulacao"))>0))
);
CREATE INDEX "AmostraQualidadeLeite_propriedadeId_data_idx" ON pecuaria."AmostraQualidadeLeite"("propriedadeId",data);
CREATE INDEX "AmostraQualidadeLeite_tipoExameId_idx" ON pecuaria."AmostraQualidadeLeite"("tipoExameId");
CREATE INDEX "AmostraQualidadeLeite_entradaId_idx" ON pecuaria."AmostraQualidadeLeite"("entradaId");
CREATE TABLE pecuaria."ResultadoQualidadeLeite" (
  id TEXT PRIMARY KEY, "amostraId" TEXT NOT NULL REFERENCES pecuaria."AmostraQualidadeLeite"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  campo TEXT NOT NULL, valor JSONB NOT NULL, unidade TEXT, vigente BOOLEAN NOT NULL DEFAULT true,
  "substituidoEm" TIMESTAMP(3), "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "criadoPorId" INTEGER,
  CONSTRAINT "ResultadoQualidadeLeite_vigencia_check" CHECK (vigente = ("substituidoEm" IS NULL))
);
CREATE INDEX "ResultadoQualidadeLeite_amostraId_campo_idx" ON pecuaria."ResultadoQualidadeLeite"("amostraId",campo);
CREATE UNIQUE INDEX "ResultadoQualidadeLeite_campo_vigente_key" ON pecuaria."ResultadoQualidadeLeite"("amostraId",campo) WHERE vigente;
CREATE TABLE pecuaria."LaudoQualidadeLeite" (
  id TEXT PRIMARY KEY, "amostraId" TEXT NOT NULL REFERENCES pecuaria."AmostraQualidadeLeite"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  nome TEXT NOT NULL, "mimeType" TEXT NOT NULL, "tamanhoBytes" INTEGER NOT NULL, sha256 VARCHAR(64) NOT NULL,
  "storageDriver" TEXT NOT NULL DEFAULT 'r2', bucket TEXT NOT NULL, "storageKey" TEXT NOT NULL UNIQUE,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "criadoPorId" INTEGER,
  CONSTRAINT "LaudoQualidadeLeite_amostraId_sha256_key" UNIQUE ("amostraId",sha256),
  CONSTRAINT "LaudoQualidadeLeite_storage_check" CHECK ("storageDriver"='r2' AND "tamanhoBytes">0 AND "tamanhoBytes"<=10485760 AND sha256 ~ '^[a-f0-9]{64}$')
);

CREATE FUNCTION pecuaria.conferir_amostra_qualidade_leite() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e RECORD; t RECORD;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Amostra de qualidade é histórica; anule com motivo' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (NEW.sujeito,NEW."propriedadeId",NEW.data,NEW."tipoExameId",NEW."exameAnimalId",NEW."entradaId",NEW."origemColetiva",NEW."formatoSnapshot") IS DISTINCT FROM (OLD.sujeito,OLD."propriedadeId",OLD.data,OLD."tipoExameId",OLD."exameAnimalId",OLD."entradaId",OLD."origemColetiva",OLD."formatoSnapshot") THEN
    RAISE EXCEPTION 'Identidade e formato da amostra são históricos' USING ERRCODE='23514';
  END IF;
  IF TG_OP='INSERT' THEN
    SELECT * INTO t FROM pecuaria."TipoExame" WHERE id=NEW."tipoExameId" FOR UPDATE;
    IF t.id IS NULL OR t."tipoResultado"<>'MULTIPLO' THEN RAISE EXCEPTION 'Formato de qualidade inválido' USING ERRCODE='23514'; END IF;
    IF NEW.sujeito='ANIMAL' THEN
      SELECT * INTO e FROM pecuaria."ExameAnimal" WHERE id=NEW."exameAnimalId";
      IF e.id IS NULL OR e."propriedadeId" IS DISTINCT FROM NEW."propriedadeId" OR e.data<>NEW.data OR e."tipoExameId"<>NEW."tipoExameId" THEN
        RAISE EXCEPTION 'Exame individual incompatível com amostra' USING ERRCODE='23514';
      END IF;
    ELSE
      IF NEW."formatoSnapshot"->>'tipoResultado' IS DISTINCT FROM 'MULTIPLO' OR NEW."formatoSnapshot"->'campos' IS DISTINCT FROM t.campos THEN
        RAISE EXCEPTION 'Snapshot coletivo incompatível com formato' USING ERRCODE='23514';
      END IF;
      IF NEW."entradaId" IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM pecuaria."EntradaProducaoLeite" x JOIN pecuaria."SessaoOrdenha" s ON s.id=x."sessaoId" JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId"
        WHERE x.id=NEW."entradaId" AND x.status='CONFIRMADA' AND d."propriedadeId"=NEW."propriedadeId" AND d."dataOperacional"<=NEW.data
      ) THEN RAISE EXCEPTION 'Entrada incompatível com sítio/data da amostra' USING ERRCODE='23514'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "AmostraQualidadeLeite_conferir" BEFORE INSERT OR UPDATE OR DELETE ON pecuaria."AmostraQualidadeLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_amostra_qualidade_leite();

CREATE FUNCTION pecuaria.preservar_formato_qualidade_leite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW."tipoResultado",NEW.unidade,NEW.opcoes,NEW.campos) IS DISTINCT FROM (OLD."tipoResultado",OLD.unidade,OLD.opcoes,OLD.campos) AND EXISTS (SELECT 1 FROM pecuaria."AmostraQualidadeLeite" WHERE "tipoExameId"=OLD.id) THEN
    RAISE EXCEPTION 'Formato de qualidade utilizado exige nova versão' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "TipoExame_preservar_qualidade" BEFORE UPDATE ON pecuaria."TipoExame" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_formato_qualidade_leite();

-- A substituição preserva valor, unidade e autoria; só encerra a vigência anterior.
CREATE FUNCTION pecuaria.preservar_resultado_qualidade_leite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Resultado de qualidade é histórico; substitua com revisão' USING ERRCODE='23514'; END IF;
  IF (NEW.id,NEW."amostraId",NEW.campo,NEW.valor,NEW.unidade,NEW."criadoEm",NEW."criadoPorId") IS DISTINCT FROM (OLD.id,OLD."amostraId",OLD.campo,OLD.valor,OLD.unidade,OLD."criadoEm",OLD."criadoPorId") OR NOT OLD.vigente OR NEW.vigente OR NEW."substituidoEm" IS NULL THEN
    RAISE EXCEPTION 'Só é permitido encerrar a vigência do resultado histórico' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ResultadoQualidadeLeite_preservar" BEFORE UPDATE OR DELETE ON pecuaria."ResultadoQualidadeLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_resultado_qualidade_leite();


CREATE FUNCTION pecuaria.conferir_resultado_qualidade_leite() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a RECORD; c JSONB;
BEGIN
  SELECT * INTO a FROM pecuaria."AmostraQualidadeLeite" WHERE id=NEW."amostraId";
  IF a.id IS NULL OR a.sujeito<>'COLETIVO' OR a.status<>'VALIDO' THEN RAISE EXCEPTION 'Resultado coletivo exige amostra coletiva válida' USING ERRCODE='23514'; END IF;
  SELECT x INTO c FROM jsonb_array_elements(a."formatoSnapshot"->'campos') x WHERE x->>'codigo'=NEW.campo;
  IF c IS NULL OR (c->>'unidade') IS DISTINCT FROM NEW.unidade THEN RAISE EXCEPTION 'Campo/unidade fora do formato preservado' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ResultadoQualidadeLeite_conferir" BEFORE INSERT ON pecuaria."ResultadoQualidadeLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_resultado_qualidade_leite();
