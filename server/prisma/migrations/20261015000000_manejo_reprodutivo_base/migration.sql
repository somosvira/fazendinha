BEGIN;

-- Não conciliar sobreposição por truncamento. O relatório permite correção explícita
-- dos fatos antes de reaplicar; inclusive intervalos de duração zero ocupam um dia.
DO $$
DECLARE conflitos text;
BEGIN
  SELECT string_agg(format('%s/%s (animal %s)', a.id, b.id, a."animalId"), ', ' ORDER BY a.id, b.id)
  INTO conflitos
  FROM pecuaria."LactacaoAnimal" a
  JOIN pecuaria."LactacaoAnimal" b ON a."animalId" = b."animalId" AND a.id < b.id
  WHERE daterange(a.inicio, CASE WHEN a."encerradaEm" = a.inicio THEN a.inicio + 1 ELSE a."encerradaEm" END, '[)')
     && daterange(b.inicio, CASE WHEN b."encerradaEm" = b.inicio THEN b.inicio + 1 ELSE b."encerradaEm" END, '[)');
  IF conflitos IS NOT NULL THEN
    RAISE EXCEPTION 'Lactações sobrepostas: %. Revise os fatos sem apagar ou truncar histórico.', conflitos;
  END IF;
END $$;

ALTER TABLE pecuaria."PartoAnimal"
  ADD COLUMN desfecho TEXT,
  ADD COLUMN induzido BOOLEAN,
  ADD COLUMN dificuldade BOOLEAN,
  ADD COLUMN "assistenciaDescricao" TEXT,
  ADD COLUMN "ocorridoEm" TIMESTAMPTZ(3),
  ADD COLUMN "horarioEstimado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "retencaoPlacenta" BOOLEAN,
  ADD COLUMN versao INTEGER NOT NULL DEFAULT 1;

-- Tipos e snapshots legados permanecem intactos. Informação ausente não vira Não.
UPDATE pecuaria."PartoAnimal"
SET desfecho = CASE WHEN tipo = 'ABORTO' THEN 'ABORTO' ELSE 'NASCIMENTO' END,
    dificuldade = CASE WHEN tipo = 'DISTOCICO' THEN true ELSE NULL END;
ALTER TABLE pecuaria."PartoAnimal" DROP CONSTRAINT "Parto_tipo";
ALTER TABLE pecuaria."PartoAnimal"
  ADD CONSTRAINT "Parto_tipo" CHECK (tipo IN ('NORMAL','DISTOCICO','ABORTO','NATIMORTO','NASCIMENTO')),
  ADD CONSTRAINT "Parto_desfecho" CHECK (desfecho IS NULL OR desfecho IN ('NASCIMENTO','ABORTO')),
  ADD CONSTRAINT "Parto_tipo_desfecho" CHECK (
    desfecho IS NOT NULL AND ((tipo = 'ABORTO' AND desfecho = 'ABORTO')
      OR (tipo <> 'ABORTO' AND desfecho = 'NASCIMENTO'))),
  ADD CONSTRAINT "Parto_versao" CHECK (versao > 0),
  ADD CONSTRAINT "Parto_horario" CHECK (
    (NOT "horarioEstimado" OR "ocorridoEm" IS NOT NULL)
    AND ("ocorridoEm" IS NULL OR ("ocorridoEm" AT TIME ZONE 'America/Sao_Paulo')::date = data)
  );

-- UPDATE OF distingue o campo explicitamente enviado até quando seu valor é
-- igual ao anterior. Valida antes do adaptador de escritas legadas só com tipo.
CREATE FUNCTION pecuaria.validar_desfecho_parto_explicito() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.desfecho IS NOT NULL AND NEW.desfecho IS DISTINCT FROM
    (CASE WHEN NEW.tipo = 'ABORTO' THEN 'ABORTO' ELSE 'NASCIMENTO' END) THEN
    RAISE EXCEPTION 'Tipo e desfecho do parto são contraditórios';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "PartoAnimal_00_desfecho_explicito" BEFORE UPDATE OF desfecho ON pecuaria."PartoAnimal"
  FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_desfecho_parto_explicito();
CREATE FUNCTION pecuaria.compatibilizar_desfecho_parto() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.desfecho IS NOT NULL AND NEW.desfecho IS DISTINCT FROM
      (CASE WHEN NEW.tipo = 'ABORTO' THEN 'ABORTO' ELSE 'NASCIMENTO' END) THEN
      RAISE EXCEPTION 'Tipo e desfecho do parto são contraditórios';
    END IF;
    IF NEW.tipo = 'DISTOCICO' AND NEW.dificuldade IS NULL THEN NEW.dificuldade := true; END IF;
  ELSIF NEW.tipo IS DISTINCT FROM OLD.tipo AND NEW.desfecho IS NOT DISTINCT FROM OLD.desfecho THEN
    NEW.desfecho := CASE WHEN NEW.tipo = 'ABORTO' THEN 'ABORTO' ELSE 'NASCIMENTO' END;
  END IF;
  IF NEW.desfecho IS NULL THEN
    NEW.desfecho := CASE WHEN NEW.tipo = 'ABORTO' THEN 'ABORTO' ELSE 'NASCIMENTO' END;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "PartoAnimal_10_compatibilidade_desfecho" BEFORE INSERT OR UPDATE ON pecuaria."PartoAnimal"
  FOR EACH ROW EXECUTE FUNCTION pecuaria.compatibilizar_desfecho_parto();

ALTER TABLE pecuaria."LactacaoAnimal" ADD COLUMN versao INTEGER NOT NULL DEFAULT 1;
ALTER TABLE pecuaria."LactacaoAnimal" ADD CONSTRAINT "LactacaoAnimal_versao" CHECK (versao > 0);
CREATE INDEX "LactacaoAnimal_animalId_inicio_idx" ON pecuaria."LactacaoAnimal" ("animalId", inicio);
-- btree_gist é instalado pela migration 20260928190000_pecuaria_v3.
ALTER TABLE pecuaria."LactacaoAnimal" ADD CONSTRAINT "LactacaoAnimal_sem_sobreposicao"
  EXCLUDE USING gist ("animalId" WITH =,
    daterange(inicio, CASE WHEN "encerradaEm" = inicio THEN inicio + 1 ELSE "encerradaEm" END, '[)') WITH &&);

ALTER TABLE pecuaria."OcorrenciaSanitaria" ADD COLUMN "partoRetencaoPlacentaId" TEXT;
CREATE INDEX "OcorrenciaSanitaria_partoRetencaoPlacentaId_idx"
  ON pecuaria."OcorrenciaSanitaria" ("partoRetencaoPlacentaId");
ALTER TABLE pecuaria."OcorrenciaSanitaria" ADD CONSTRAINT "OcorrenciaSanitaria_partoRetencaoPlacentaId_fkey"
  FOREIGN KEY ("partoRetencaoPlacentaId") REFERENCES pecuaria."PartoAnimal"(id) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE pecuaria."VinculoPesagemParto" (
  id TEXT NOT NULL PRIMARY KEY,
  "partoId" TEXT NOT NULL,
  "pesagemId" TEXT NOT NULL,
  "criaId" TEXT,
  sujeito TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criadoPorId" INTEGER,
  "revogadoEm" TIMESTAMP(3),
  "revogadoPorId" INTEGER,
  "motivoRevogacao" TEXT,
  CONSTRAINT "VinculoPesagemParto_partoId_fkey" FOREIGN KEY ("partoId") REFERENCES pecuaria."PartoAnimal"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "VinculoPesagemParto_pesagemId_fkey" FOREIGN KEY ("pesagemId") REFERENCES pecuaria."Pesagem"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "VinculoPesagemParto_criaId_fkey" FOREIGN KEY ("criaId") REFERENCES pecuaria."CriaParto"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "VinculoPesagemParto_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "VinculoPesagemParto_revogadoPorId_fkey" FOREIGN KEY ("revogadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "VinculoPesagemParto_sujeito" CHECK (
    (sujeito = 'MATRIZ' AND "criaId" IS NULL) OR (sujeito = 'CRIA' AND "criaId" IS NOT NULL)),
  CONSTRAINT "VinculoPesagemParto_revogacao" CHECK (
    ("revogadoEm" IS NULL AND "revogadoPorId" IS NULL AND "motivoRevogacao" IS NULL)
    OR ("revogadoEm" IS NOT NULL AND "revogadoEm" >= "criadoEm" AND length(btrim("motivoRevogacao")) > 0 AND "motivoRevogacao" IS NOT NULL))
);
CREATE INDEX "VinculoPesagemParto_partoId_idx" ON pecuaria."VinculoPesagemParto" ("partoId");
CREATE INDEX "VinculoPesagemParto_pesagemId_idx" ON pecuaria."VinculoPesagemParto" ("pesagemId");
CREATE INDEX "VinculoPesagemParto_criaId_idx" ON pecuaria."VinculoPesagemParto" ("criaId");
CREATE UNIQUE INDEX "VinculoPesagemParto_pesagem_ativa" ON pecuaria."VinculoPesagemParto" ("pesagemId") WHERE "revogadoEm" IS NULL;

-- Só a revogação explícita pode mudar um vínculo: registros históricos não somem.
CREATE FUNCTION pecuaria.proteger_vinculo_pesagem_parto() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Vínculo de pesagem deve ser revogado, preservando seu histórico';
  END IF;
  IF OLD."revogadoEm" IS NOT NULL OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW."partoId" IS DISTINCT FROM OLD."partoId" OR NEW."pesagemId" IS DISTINCT FROM OLD."pesagemId"
     OR NEW."criaId" IS DISTINCT FROM OLD."criaId" OR NEW.sujeito IS DISTINCT FROM OLD.sujeito
     OR NEW."criadoEm" IS DISTINCT FROM OLD."criadoEm" OR NEW."criadoPorId" IS DISTINCT FROM OLD."criadoPorId"
     OR NEW."revogadoEm" IS NULL THEN
    RAISE EXCEPTION 'Vínculo de pesagem é imutável; revogue explicitamente antes de substituir';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "VinculoPesagemParto_historico" BEFORE UPDATE OR DELETE ON pecuaria."VinculoPesagemParto"
  FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_vinculo_pesagem_parto();

-- As verificações diferidas conferem o estado final da transação: correção conjunta
-- pode atualizar o parto e os fatos vinculados atomicamente. FOR UPDATE serializa
-- com alterações concorrentes do outro lado da relação.
CREATE FUNCTION pecuaria.conferir_rp_parto(id_parto text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE parto pecuaria."PartoAnimal"%ROWTYPE;
BEGIN
  SELECT * INTO parto FROM pecuaria."PartoAnimal" WHERE id = id_parto FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF EXISTS (
    SELECT 1 FROM pecuaria."OcorrenciaSanitaria" o
    WHERE o."partoRetencaoPlacentaId" = id_parto AND o.status = 'VALIDO'
      AND (parto.status <> 'VALIDO' OR parto."retencaoPlacenta" IS DISTINCT FROM true
        OR o."animalId" <> parto."animalId" OR o.inicio < parto.data)
  ) THEN
    RAISE EXCEPTION 'Ocorrência de retenção de placenta incompatível com o parto %', id_parto;
  END IF;
END $$;
CREATE FUNCTION pecuaria.conferir_rp_ocorrencia_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'DELETE' THEN
    PERFORM pecuaria.conferir_rp_parto(o."partoRetencaoPlacentaId")
      FROM pecuaria."OcorrenciaSanitaria" o WHERE o.id = NEW.id AND o."partoRetencaoPlacentaId" IS NOT NULL;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "OcorrenciaSanitaria_rp_parto" AFTER INSERT OR UPDATE ON pecuaria."OcorrenciaSanitaria"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_rp_ocorrencia_trigger();
CREATE FUNCTION pecuaria.conferir_rp_parto_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pecuaria.conferir_rp_parto(NEW.id);
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "PartoAnimal_rp_ocorrencias" AFTER UPDATE ON pecuaria."PartoAnimal"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_rp_parto_trigger();

CREATE FUNCTION pecuaria.conferir_vinculo_pesagem_parto(id_vinculo text) RETURNS void LANGUAGE plpgsql AS $$
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
    IF cria."partoId" <> parto.id OR NOT cria.viva OR cria."animalId" IS DISTINCT FROM pesagem."animalId" THEN
      RAISE EXCEPTION 'Pesagem não pertence à cria viva deste parto';
    END IF;
  END IF;
END $$;
CREATE FUNCTION pecuaria.conferir_pesagem_parto_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE id_vinculo text;
BEGIN
  IF TG_TABLE_NAME = 'VinculoPesagemParto' THEN
    PERFORM pecuaria.conferir_vinculo_pesagem_parto(NEW.id);
  ELSE
    FOR id_vinculo IN SELECT v.id FROM pecuaria."VinculoPesagemParto" v
      WHERE v."revogadoEm" IS NULL AND (
        (TG_TABLE_NAME = 'PartoAnimal' AND v."partoId" = NEW.id)
        OR (TG_TABLE_NAME = 'Pesagem' AND v."pesagemId" = NEW.id)
        OR (TG_TABLE_NAME = 'CriaParto' AND v."criaId" = NEW.id))
      ORDER BY v.id
    LOOP PERFORM pecuaria.conferir_vinculo_pesagem_parto(id_vinculo); END LOOP;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "VinculoPesagemParto_contexto" AFTER INSERT OR UPDATE ON pecuaria."VinculoPesagemParto"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_pesagem_parto_trigger();
CREATE CONSTRAINT TRIGGER "PartoAnimal_pesagens" AFTER UPDATE ON pecuaria."PartoAnimal"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_pesagem_parto_trigger();
CREATE CONSTRAINT TRIGGER "Pesagem_partos" AFTER UPDATE ON pecuaria."Pesagem"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_pesagem_parto_trigger();
CREATE CONSTRAINT TRIGGER "CriaParto_pesagens" AFTER UPDATE ON pecuaria."CriaParto"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_pesagem_parto_trigger();

CREATE TABLE pecuaria."SelecaoVisita" (
  id TEXT NOT NULL PRIMARY KEY,
  "propriedadeId" INTEGER NOT NULL,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criadoPorId" INTEGER,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SelecaoVisita_nome" CHECK (length(btrim(nome)) > 0),
  CONSTRAINT "SelecaoVisita_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SelecaoVisita_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "SelecaoVisita_propriedadeId_ativo_idx" ON pecuaria."SelecaoVisita" ("propriedadeId", ativo);
CREATE TABLE pecuaria."VersaoSelecaoVisita" (
  id TEXT NOT NULL PRIMARY KEY,
  "selecaoId" TEXT NOT NULL,
  numero INTEGER NOT NULL,
  criterios JSONB NOT NULL,
  "versaoContrato" INTEGER NOT NULL DEFAULT 1,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criadoPorId" INTEGER,
  CONSTRAINT "VersaoSelecaoVisita_numero" CHECK (numero > 0 AND "versaoContrato" > 0),
  CONSTRAINT "VersaoSelecaoVisita_criterios" CHECK (jsonb_typeof(criterios) = 'object'),
  CONSTRAINT "VersaoSelecaoVisita_selecaoId_fkey" FOREIGN KEY ("selecaoId") REFERENCES pecuaria."SelecaoVisita"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "VersaoSelecaoVisita_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "VersaoSelecaoVisita_selecaoId_numero_key" ON pecuaria."VersaoSelecaoVisita" ("selecaoId", numero);
CREATE FUNCTION pecuaria.proteger_versao_selecao_visita() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Versão de seleção é imutável; crie outra versão';
END $$;
CREATE TRIGGER "VersaoSelecaoVisita_imutavel" BEFORE UPDATE OR DELETE ON pecuaria."VersaoSelecaoVisita"
  FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_versao_selecao_visita();

COMMIT;
