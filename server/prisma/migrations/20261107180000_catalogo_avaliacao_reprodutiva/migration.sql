CREATE TABLE pecuaria."CatalogoAvaliacaoReprodutiva" (
 id text PRIMARY KEY,
 "propriedadeId" integer NOT NULL REFERENCES public."Propriedade"(id) ON DELETE RESTRICT,
 versao integer NOT NULL CHECK (versao > 0),
 "tipoExameId" text NOT NULL REFERENCES pecuaria."TipoExame"(id) ON DELETE RESTRICT,
 itens jsonb NOT NULL CHECK (jsonb_typeof(itens) = 'array' AND jsonb_array_length(itens) > 0),
 condutas jsonb NOT NULL CHECK (jsonb_typeof(condutas) = 'array'),
 "criadoEm" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "criadoPorId" integer REFERENCES public."Usuario"(id) ON DELETE RESTRICT,
 UNIQUE ("propriedadeId", versao)
);
ALTER TABLE pecuaria."ExameAnimal" ADD COLUMN "avaliacaoContextualSnapshot" jsonb;
ALTER TABLE pecuaria."InterpretacaoReprodutiva" ADD COLUMN "condutasContextuais" jsonb;
ALTER TABLE pecuaria."ExameAnimal" ADD CONSTRAINT "Exame_avaliacao_contextual_objeto" CHECK ("avaliacaoContextualSnapshot" IS NULL OR jsonb_typeof("avaliacaoContextualSnapshot")='object');
ALTER TABLE pecuaria."InterpretacaoReprodutiva" ADD CONSTRAINT "Interpretacao_condutas_array" CHECK ("condutasContextuais" IS NULL OR jsonb_typeof("condutasContextuais")='array');
CREATE FUNCTION pecuaria.validar_catalogo_avaliacao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('pec-tipo-exame:' || NEW."tipoExameId"));
 IF NOT EXISTS (SELECT 1 FROM pecuaria."TipoExame" t WHERE t.id=NEW."tipoExameId" AND t.ativo AND t.contexto IN ('REPRODUTIVO','COMPARTILHADO') AND t."tipoResultado"='MULTIPLO')
 THEN RAISE EXCEPTION 'catálogo exige tipo reprodutivo ativo com formato estruturado' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "CatalogoAvaliacao_tipo_valido" BEFORE INSERT ON pecuaria."CatalogoAvaliacaoReprodutiva" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_catalogo_avaliacao();
CREATE FUNCTION pecuaria.proteger_catalogo_avaliacao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'catálogo de avaliação publicado é imutável' USING ERRCODE='23514'; END $$;
CREATE TRIGGER "CatalogoAvaliacao_imutavel" BEFORE UPDATE OR DELETE ON pecuaria."CatalogoAvaliacaoReprodutiva" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_catalogo_avaliacao();
CREATE FUNCTION pecuaria.proteger_formato_catalogo_avaliacao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('pec-tipo-exame:' || OLD.id));
 IF (NEW."tipoResultado", NEW.campos, NEW.unidade, NEW.opcoes, NEW.contexto)
   IS DISTINCT FROM (OLD."tipoResultado", OLD.campos, OLD.unidade, OLD.opcoes, OLD.contexto)
   AND EXISTS (SELECT 1 FROM pecuaria."CatalogoAvaliacaoReprodutiva" c WHERE c."tipoExameId"=OLD.id)
 THEN RAISE EXCEPTION 'formato usado em catálogo exige nova versão' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "TipoExame_catalogo_formato" BEFORE UPDATE ON pecuaria."TipoExame" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_formato_catalogo_avaliacao();
CREATE FUNCTION pecuaria.proteger_registro_contextual() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='ExameAnimal' THEN
  IF OLD."avaliacaoContextualSnapshot" IS NOT NULL AND NEW."avaliacaoContextualSnapshot" IS DISTINCT FROM OLD."avaliacaoContextualSnapshot" THEN
   RAISE EXCEPTION 'itens de avaliação são evidência histórica' USING ERRCODE='23514';
  END IF;
 ELSE
  IF OLD."condutasContextuais" IS NOT NULL AND NEW."condutasContextuais" IS DISTINCT FROM OLD."condutasContextuais" THEN
   RAISE EXCEPTION 'condutas de avaliação são evidência histórica' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Exame_avaliacao_contextual_imutavel" BEFORE UPDATE ON pecuaria."ExameAnimal" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_registro_contextual();
CREATE TRIGGER "Interpretacao_condutas_contextuais_imutaveis" BEFORE UPDATE ON pecuaria."InterpretacaoReprodutiva" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_registro_contextual();

-- Sexagem parcial não inventa um diagnóstico gestacional.
CREATE OR REPLACE VIEW pecuaria."AvaliacaoReprodutiva" AS
 SELECT i.id,
    i."referenciaExterna",
    e."animalId",
    e."propriedadeId",
    e.data,
    e.origem,
    e.status,
    e."motivoAnulacao",
    e."anuladoEm",
    e."criadoEm",
    e."criadoPorId",
    i."gestacaoCriada",
    i."restricaoId",
        CASE
            WHEN (e.realizacao = 'NAO_REALIZADO'::text OR e."finalidadePrincipal" = 'AVALIACAO_REPRODUTIVA'::text) THEN 'NAO_AVALIADO'::text
            WHEN ((e."finalidadePrincipal" = 'RECONFIRMACAO'::text) AND ((c.valor #>> '{}'::text[]) = 'POSITIVO'::text)) THEN 'RECONFIRMACAO'::text
            WHEN e."finalidadePrincipal" = 'SEXAGEM' AND c.valor IS NULL AND e."avaliacaoContextualSnapshot" @> '{"itens":[{"tipo":"SEXAGEM","estado":"INCONCLUSIVO"}]}'::jsonb THEN 'INCONCLUSIVO'::text
            WHEN ((e."finalidadePrincipal" = 'SEXAGEM'::text) AND (c.valor IS NULL)) THEN 'SEXAGEM'::text
            ELSE COALESCE((c.valor #>> '{}'::text[]), 'INCONCLUSIVO'::text)
        END AS resultado,
    i."tentativaId",
    i."gestacaoId",
    ((s.valor #>> '{}'::text[]))::pecuaria."SexoBovino" AS "sexoFetal",
    i.conduta,
    i.motivo,
    e."anotacaoOriginal",
    i."retornoEm",
    e.observacao
   FROM (((pecuaria."InterpretacaoReprodutiva" i
     JOIN pecuaria."ExameAnimal" e ON ((e.id = i."exameId")))
     LEFT JOIN pecuaria."ResultadoExame" c ON (((c."exameId" = e.id) AND (c.campo = 'CONCLUSAO_GESTACIONAL'::text) AND c.vigente)))
     LEFT JOIN pecuaria."ResultadoExame" s ON (((s."exameId" = e.id) AND (s.campo = 'SEXO_FETAL'::text) AND s.vigente)))
  WHERE e."finalidadePrincipal" IS DISTINCT FROM 'APTIDAO_REPRODUTIVA';
