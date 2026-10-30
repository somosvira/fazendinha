-- Peso opcional no encerramento manual; não cria pesagens nem encerra lactações existentes.
CREATE TABLE "pecuaria"."VinculoPesagemSecagem" (
  "id" TEXT PRIMARY KEY,
  "lactacaoId" TEXT NOT NULL REFERENCES "pecuaria"."LactacaoAnimal"("id") ON DELETE RESTRICT,
  "pesagemId" TEXT NOT NULL REFERENCES "pecuaria"."Pesagem"("id") ON DELETE RESTRICT,
  "propriedadeId" INTEGER NOT NULL REFERENCES "public"."Propriedade"("id") ON DELETE RESTRICT,
  "evidenciaSnapshot" JSONB NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criadoPorId" INTEGER NOT NULL REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT,
  "revogadoEm" TIMESTAMP(3),
  "revogadoPorId" INTEGER REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT,
  "motivoRevogacao" TEXT,
  CONSTRAINT "VinculoPesagemSecagem_revogacao_check" CHECK (
    ("revogadoEm" IS NULL AND "revogadoPorId" IS NULL AND "motivoRevogacao" IS NULL)
    OR ("revogadoEm" IS NOT NULL AND "revogadoEm" >= "criadoEm" AND "revogadoPorId" IS NOT NULL AND "motivoRevogacao" IS NOT NULL AND length(btrim("motivoRevogacao")) >= 5)
  )
);
CREATE INDEX "VinculoPesagemSecagem_lactacaoId_idx" ON "pecuaria"."VinculoPesagemSecagem"("lactacaoId");
CREATE INDEX "VinculoPesagemSecagem_pesagemId_idx" ON "pecuaria"."VinculoPesagemSecagem"("pesagemId");
CREATE UNIQUE INDEX "VinculoPesagemSecagem_lactacao_ativa_key" ON "pecuaria"."VinculoPesagemSecagem"("lactacaoId") WHERE "revogadoEm" IS NULL;
CREATE UNIQUE INDEX "VinculoPesagemSecagem_pesagem_ativa_key" ON "pecuaria"."VinculoPesagemSecagem"("pesagemId") WHERE "revogadoEm" IS NULL;

CREATE FUNCTION "pecuaria"."preservar_historico_peso_secagem"() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Vínculo de secagem preserva histórico; use revogação' USING ERRCODE = '23514';
  END IF;
  IF OLD."revogadoEm" IS NOT NULL OR
    ROW(OLD."id", OLD."lactacaoId", OLD."pesagemId", OLD."propriedadeId", OLD."evidenciaSnapshot", OLD."criadoEm", OLD."criadoPorId")
    IS DISTINCT FROM ROW(NEW."id", NEW."lactacaoId", NEW."pesagemId", NEW."propriedadeId", NEW."evidenciaSnapshot", NEW."criadoEm", NEW."criadoPorId") THEN
    RAISE EXCEPTION 'Revise o vínculo de secagem por revogação e nova associação' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "VinculoPesagemSecagem_preservar_historico" BEFORE UPDATE OR DELETE ON "pecuaria"."VinculoPesagemSecagem"
  FOR EACH ROW EXECUTE FUNCTION "pecuaria"."preservar_historico_peso_secagem"();

CREATE FUNCTION "pecuaria"."conferir_vinculos_peso_secagem"(lactacao_alvo TEXT, pesagem_alvo TEXT, animal_alvo TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "pecuaria"."VinculoPesagemSecagem" v
    JOIN "pecuaria"."LactacaoAnimal" l ON l.id = v."lactacaoId"
    JOIN "pecuaria"."Pesagem" p ON p.id = v."pesagemId"
    JOIN "pecuaria"."Animal" a ON a.id = p."animalId"
    WHERE v."revogadoEm" IS NULL
      AND (v."lactacaoId" = lactacao_alvo OR v."pesagemId" = pesagem_alvo OR p."animalId" = animal_alvo)
      AND (l."encerradaEm" IS NULL OR l."animalId" <> p."animalId" OR p.data IS DISTINCT FROM l."encerradaEm"
        OR (p."propriedadeId" IS NOT NULL AND p."propriedadeId" <> v."propriedadeId") OR p."contextoHistorico" = 'EXTERNO'
        OR a.sexo <> 'F' OR p.data < a."dataNascimento" OR p.data < a."dataEntrada"
        OR EXISTS (SELECT 1 FROM "pecuaria"."BaixaAnimal" b WHERE b."animalId" = p."animalId" AND b."estornadaEm" IS NULL AND p.data > b.data)
        OR (SELECT count(*) FROM "pecuaria"."LocalizacaoAnimal" loc WHERE loc."animalId" = p."animalId" AND loc.desde <= p.data
          AND (loc.ate IS NULL OR loc.ate > p.data OR EXISTS (SELECT 1 FROM "pecuaria"."BaixaAnimal" b WHERE b."animalId" = p."animalId" AND b."estornadaEm" IS NULL AND b.data = p.data AND b."localizacaoFechadaId" = loc.id))) <> 1
        OR NOT EXISTS (SELECT 1 FROM "pecuaria"."LocalizacaoAnimal" loc WHERE loc."animalId" = p."animalId" AND loc."propriedadeId" = v."propriedadeId" AND loc.desde <= p.data
          AND (loc.ate IS NULL OR loc.ate > p.data OR EXISTS (SELECT 1 FROM "pecuaria"."BaixaAnimal" b WHERE b."animalId" = p."animalId" AND b."estornadaEm" IS NULL AND b.data = p.data AND b."localizacaoFechadaId" = loc.id)))
      )
  ) THEN
    RAISE EXCEPTION 'Vínculo de secagem exige lactação encerrada, mesmo animal/data e sítio histórico comprovado' USING ERRCODE = '23514';
  END IF;
END $$;

CREATE FUNCTION "pecuaria"."revalidar_peso_secagem"() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'VinculoPesagemSecagem' THEN
    PERFORM "pecuaria"."conferir_vinculos_peso_secagem"(NEW."lactacaoId", NEW."pesagemId", NULL);
  ELSIF TG_TABLE_NAME = 'LactacaoAnimal' THEN
    PERFORM "pecuaria"."conferir_vinculos_peso_secagem"(NEW.id, NULL, NULL);
  ELSIF TG_TABLE_NAME = 'Pesagem' THEN
    PERFORM "pecuaria"."conferir_vinculos_peso_secagem"(NULL, NEW.id, NULL);
  ELSIF TG_TABLE_NAME = 'Animal' THEN
    PERFORM "pecuaria"."conferir_vinculos_peso_secagem"(NULL, NULL, NEW.id);
  ELSE
    IF TG_OP <> 'INSERT' THEN PERFORM "pecuaria"."conferir_vinculos_peso_secagem"(NULL, NULL, OLD."animalId"); END IF;
    IF TG_OP <> 'DELETE' THEN PERFORM "pecuaria"."conferir_vinculos_peso_secagem"(NULL, NULL, NEW."animalId"); END IF;
  END IF;
  RETURN NULL;
END $$;
-- Diferidas: correção/reabertura pode revogar e substituir na mesma transação, jamais deixar estado inválido no commit.
CREATE CONSTRAINT TRIGGER "VinculoPesagemSecagem_integridade" AFTER INSERT OR UPDATE ON "pecuaria"."VinculoPesagemSecagem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "pecuaria"."revalidar_peso_secagem"();
CREATE CONSTRAINT TRIGGER "LactacaoAnimal_peso_secagem_integridade" AFTER UPDATE ON "pecuaria"."LactacaoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "pecuaria"."revalidar_peso_secagem"();
CREATE CONSTRAINT TRIGGER "Pesagem_secagem_integridade" AFTER UPDATE ON "pecuaria"."Pesagem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "pecuaria"."revalidar_peso_secagem"();
CREATE CONSTRAINT TRIGGER "LocalizacaoAnimal_peso_secagem_integridade" AFTER INSERT OR UPDATE OR DELETE ON "pecuaria"."LocalizacaoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "pecuaria"."revalidar_peso_secagem"();
CREATE CONSTRAINT TRIGGER "BaixaAnimal_peso_secagem_integridade" AFTER INSERT OR UPDATE OR DELETE ON "pecuaria"."BaixaAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "pecuaria"."revalidar_peso_secagem"();
CREATE CONSTRAINT TRIGGER "Animal_peso_secagem_integridade" AFTER UPDATE ON "pecuaria"."Animal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "pecuaria"."revalidar_peso_secagem"();
