-- Preserva a exclusividade do exame legado. Um novo vínculo identifica a
-- observação específica e conserva o histórico de atribuições invalidadas.
CREATE TABLE pecuaria."VinculoConclusaoAcompanhamento" (
  id text PRIMARY KEY,
  "demandaId" text NOT NULL REFERENCES pecuaria."DemandaAcompanhamentoReprodutivo"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  fonte text NOT NULL,
  "valorSnapshot" jsonb NOT NULL,
  "resultadoId" text REFERENCES pecuaria."ResultadoExame"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "interpretacaoId" text REFERENCES pecuaria."InterpretacaoReprodutiva"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "VinculoConclusao_fonte" CHECK (
    (fonte='RESULTADO' AND "resultadoId" IS NOT NULL AND "interpretacaoId" IS NULL)
    OR (fonte='INTERPRETACAO' AND "resultadoId" IS NULL AND "interpretacaoId" IS NOT NULL)
  ),
  vigente boolean NOT NULL DEFAULT true,
  "criadoEm" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criadoPorId" integer REFERENCES public."Usuario"(id) ON DELETE RESTRICT,
  "invalidadoEm" timestamp(3),
  "invalidadoPorId" integer REFERENCES public."Usuario"(id) ON DELETE RESTRICT,
  "motivoInvalidacao" text,
  CONSTRAINT "VinculoConclusao_estado" CHECK (
    (vigente AND "invalidadoEm" IS NULL AND "invalidadoPorId" IS NULL AND "motivoInvalidacao" IS NULL)
    OR (NOT vigente AND "invalidadoEm" IS NOT NULL AND length(btrim("motivoInvalidacao")) >= 5)
  )
);
CREATE INDEX "VinculoConclusao_demanda_idx" ON pecuaria."VinculoConclusaoAcompanhamento" ("demandaId");
CREATE INDEX "VinculoConclusao_resultado_idx" ON pecuaria."VinculoConclusaoAcompanhamento" ("resultadoId");
CREATE INDEX "VinculoConclusao_interpretacao_idx" ON pecuaria."VinculoConclusaoAcompanhamento" ("interpretacaoId");
CREATE UNIQUE INDEX "VinculoConclusao_interpretacao_vigente_key" ON pecuaria."VinculoConclusaoAcompanhamento" ("interpretacaoId") WHERE vigente AND fonte='INTERPRETACAO';
CREATE UNIQUE INDEX "VinculoConclusao_demanda_vigente_key" ON pecuaria."VinculoConclusaoAcompanhamento" ("demandaId") WHERE vigente;
CREATE UNIQUE INDEX "VinculoConclusao_resultado_vigente_key" ON pecuaria."VinculoConclusaoAcompanhamento" ("resultadoId") WHERE vigente;
ALTER TABLE pecuaria."DemandaAcompanhamentoReprodutivo"
  ADD COLUMN "vinculoConclusaoResolucaoId" text UNIQUE REFERENCES pecuaria."VinculoConclusaoAcompanhamento"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  DROP CONSTRAINT "DemandaAcompanhamento_resolucao",
  ADD CONSTRAINT "DemandaAcompanhamento_resolucao" CHECK (
    (estado <> 'RESOLVIDA' AND "vinculoConclusaoResolucaoId" IS NULL)
    OR (estado = 'RESOLVIDA' AND "resolvidaEm" IS NOT NULL AND "resolucaoSnapshot" IS NOT NULL
      AND (("exameResolucaoId" IS NOT NULL) <> ("vinculoConclusaoResolucaoId" IS NOT NULL)))
  );

CREATE FUNCTION pecuaria.proteger_vinculo_conclusao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT NEW.vigente THEN RAISE EXCEPTION 'novo vínculo deve estar vigente' USING ERRCODE='23514'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'vínculo de conclusão é histórico' USING ERRCODE='23514'; END IF;
  IF (NEW.id, NEW."demandaId", NEW.fonte, NEW."valorSnapshot", NEW."resultadoId", NEW."interpretacaoId", NEW."criadoEm", NEW."criadoPorId")
       IS DISTINCT FROM (OLD.id, OLD."demandaId", OLD.fonte, OLD."valorSnapshot", OLD."resultadoId", OLD."interpretacaoId", OLD."criadoEm", OLD."criadoPorId")
     OR NOT OLD.vigente OR NEW.vigente THEN
    RAISE EXCEPTION 'vínculo de conclusão somente pode ser invalidado uma vez' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "VinculoConclusao_proteger" BEFORE INSERT OR UPDATE OR DELETE ON pecuaria."VinculoConclusaoAcompanhamento"
  FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_vinculo_conclusao();

-- Verifica também alterações posteriores da prova no estado final da transação.
CREATE FUNCTION pecuaria.validar_vinculo_conclusao_final() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE demanda_alvo text; exame_alvo text;
BEGIN
  IF TG_TABLE_NAME = 'DemandaAcompanhamentoReprodutivo' THEN
    demanda_alvo := COALESCE(NEW.id, OLD.id);
    exame_alvo := COALESCE(NEW."exameResolucaoId", OLD."exameResolucaoId");
  ELSIF TG_TABLE_NAME = 'VinculoConclusaoAcompanhamento' THEN demanda_alvo := COALESCE(NEW."demandaId", OLD."demandaId");
  ELSIF TG_TABLE_NAME = 'ExameAnimal' THEN exame_alvo := COALESCE(NEW.id, OLD.id);
  ELSE exame_alvo := COALESCE(NEW."exameId", OLD."exameId"); END IF;
  IF EXISTS (
    SELECT 1 FROM pecuaria."VinculoConclusaoAcompanhamento" v
    JOIN pecuaria."DemandaAcompanhamentoReprodutivo" d ON d.id=v."demandaId"
    LEFT JOIN pecuaria."ResultadoExame" r ON r.id=v."resultadoId"
    LEFT JOIN pecuaria."InterpretacaoReprodutiva" fonte_i ON fonte_i.id=v."interpretacaoId"
    JOIN pecuaria."ExameAnimal" e ON e.id=COALESCE(r."exameId",fonte_i."exameId")
    LEFT JOIN pecuaria."InterpretacaoReprodutiva" i ON i."exameId"=e.id
    WHERE v.vigente AND (d.id=demanda_alvo OR e.id=exame_alvo) AND (
      d.estado <> 'RESOLVIDA' OR d."vinculoConclusaoResolucaoId" IS DISTINCT FROM v.id
      OR e.status <> 'VALIDO' OR e.realizacao <> 'REALIZADO'
      OR (v.fonte='RESULTADO' AND (NOT r.vigente OR r.valor IS DISTINCT FROM v."valorSnapshot"))
      OR (v.fonte='INTERPRETACAO' AND to_jsonb(fonte_i."resultadoAptidao") IS DISTINCT FROM v."valorSnapshot")
      OR e."animalId" IS DISTINCT FROM d."animalId" OR NOT (d.finalidade=ANY(e.finalidades))
      OR e.data < d."dataReferencia" OR (d.finalidade='RECONFIRMACAO' AND e.data < d."previstaPara")
      OR (d."tentativaId" IS NOT NULL AND i."tentativaId" IS DISTINCT FROM d."tentativaId")
      OR (d."gestacaoId" IS NOT NULL AND i."gestacaoId" IS DISTINCT FROM d."gestacaoId")
      OR (d."regraSnapshot"->>'tipoExameId' IS NOT NULL AND (e."tipoExameId" IS DISTINCT FROM d."regraSnapshot"->>'tipoExameId' OR e."formatoSnapshot"->>'versao' IS DISTINCT FROM d."regraSnapshot"->>'tipoExameVersao'))
      OR NOT COALESCE(((v.fonte='RESULTADO' AND d.finalidade='SEXAGEM' AND r.campo='SEXO_FETAL' AND r.valor IN ('"F"'::jsonb,'"M"'::jsonb))
           OR (v.fonte='RESULTADO' AND d.finalidade IN ('DIAGNOSTICO','RECONFIRMACAO') AND r.campo='CONCLUSAO_GESTACIONAL' AND r.valor IN ('"POSITIVO"'::jsonb,'"NEGATIVO"'::jsonb))
           OR (v.fonte='INTERPRETACAO' AND d.finalidade='APTIDAO_REPRODUTIVA' AND fonte_i."resultadoAptidao" IN ('APTO','NAO_APTO'))), false)
      OR EXISTS (SELECT 1 FROM pecuaria."DemandaAcompanhamentoReprodutivo" legado
        WHERE legado.id<>d.id AND legado.estado='RESOLVIDA' AND legado."exameResolucaoId"=e.id
          AND ((legado.finalidade='SEXAGEM' AND r.campo='SEXO_FETAL') OR (legado.finalidade IN ('DIAGNOSTICO','RECONFIRMACAO') AND r.campo='CONCLUSAO_GESTACIONAL')))
    )
  ) OR EXISTS (
    SELECT 1 FROM pecuaria."DemandaAcompanhamentoReprodutivo" d
    LEFT JOIN pecuaria."VinculoConclusaoAcompanhamento" v ON v.id=d."vinculoConclusaoResolucaoId"
    WHERE d.id=demanda_alvo AND d."vinculoConclusaoResolucaoId" IS NOT NULL
      AND (v.id IS NULL OR NOT v.vigente OR v."demandaId" <> d.id)
  ) THEN RAISE EXCEPTION 'resolução exige conclusão vigente e exclusiva compatível com a demanda' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "Conclusao_validar_demanda" AFTER INSERT OR UPDATE OR DELETE ON pecuaria."DemandaAcompanhamentoReprodutivo" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_vinculo_conclusao_final();
CREATE CONSTRAINT TRIGGER "Conclusao_validar_vinculo" AFTER INSERT OR UPDATE OR DELETE ON pecuaria."VinculoConclusaoAcompanhamento" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_vinculo_conclusao_final();
CREATE CONSTRAINT TRIGGER "Conclusao_validar_exame" AFTER UPDATE OR DELETE ON pecuaria."ExameAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_vinculo_conclusao_final();
CREATE CONSTRAINT TRIGGER "Conclusao_validar_resultado" AFTER UPDATE OR DELETE ON pecuaria."ResultadoExame" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_vinculo_conclusao_final();
CREATE CONSTRAINT TRIGGER "Conclusao_validar_interpretacao" AFTER UPDATE OR DELETE ON pecuaria."InterpretacaoReprodutiva" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_vinculo_conclusao_final();

-- Avaliação realizada sem DG permanece distinta de atendimento não realizado.
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

