CREATE TABLE pecuaria."VinculoQualidadeFechamentoLeite" (
  "fechamentoId" TEXT NOT NULL REFERENCES pecuaria."FechamentoOperacaoLeite"(id) ON DELETE RESTRICT,
  "amostraId" TEXT NOT NULL REFERENCES pecuaria."AmostraQualidadeLeite"(id) ON DELETE RESTRICT,
  "versaoAmostra" INTEGER NOT NULL CHECK ("versaoAmostra" > 0),
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criadoPorId" INTEGER,
  PRIMARY KEY ("fechamentoId", "amostraId")
);
CREATE INDEX "VinculoQualidadeFechamentoLeite_amostraId_idx" ON pecuaria."VinculoQualidadeFechamentoLeite"("amostraId");
CREATE FUNCTION pecuaria.validar_vinculo_qualidade_fechamento() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Vínculo de qualidade preservado não pode ser alterado ou excluído'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pecuaria."FechamentoOperacaoLeite" f
    JOIN pecuaria."OperacaoComercialLeite" o ON o.id=f."comercialId"
    JOIN pecuaria."AmostraQualidadeLeite" a ON a.id=NEW."amostraId"
    LEFT JOIN pecuaria."ExameAnimal" e ON e.id=a."exameAnimalId"
    WHERE f.id=NEW."fechamentoId" AND a."propriedadeId"=o."propriedadeId"
      AND a.data BETWEEN o.inicio AND o.fim AND a.status='VALIDO'
      AND (e.id IS NULL OR e.status='VALIDO') AND a.versao=NEW."versaoAmostra"
      AND NEW.snapshot->>'id'=a.id
      AND (NEW.snapshot->>'versao')::integer=a.versao
      AND (NEW.snapshot->>'propriedadeId')::integer=o."propriedadeId"
  ) THEN RAISE EXCEPTION 'Amostra incompatível com sítio, período, estado ou versão do fechamento'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "VinculoQualidadeFechamentoLeite_integridade"
BEFORE INSERT OR UPDATE OR DELETE ON pecuaria."VinculoQualidadeFechamentoLeite"
FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_vinculo_qualidade_fechamento();
