ALTER TYPE pecuaria."TipoPesagem" ADD VALUE 'PARTO';
ALTER TYPE pecuaria."TipoPesagem" ADD VALUE 'SECAGEM';
ALTER TABLE pecuaria."Pesagem"
  ADD COLUMN "precisao" text NOT NULL DEFAULT 'NAO_INFORMADO',
  ADD COLUMN "contextoHistorico" text NOT NULL DEFAULT 'NAO_INFORMADO',
  ADD COLUMN "propriedadeId" integer REFERENCES public."Propriedade"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD COLUMN "referenciaHistorica" text,
  ADD COLUMN "provenienciaHistoricaSnapshot" jsonb,
  ADD CONSTRAINT "Pesagem_precisao_check" CHECK ("precisao" IN ('MEDIDO','ESTIMADO','INFORMADO','NAO_INFORMADO')),
  ADD CONSTRAINT "Pesagem_contexto_historico_check" CHECK ("contextoHistorico" IN ('INTERNO','EXTERNO','NAO_INFORMADO')),
  ADD CONSTRAINT "Pesagem_balanca_precisao_check" CHECK (origem::text <> 'BALANCA' OR "precisao" IN ('MEDIDO','NAO_INFORMADO')),
  ADD CONSTRAINT "Pesagem_contexto_sitio_check" CHECK (("contextoHistorico" <> 'EXTERNO' OR "propriedadeId" IS NULL) AND ("contextoHistorico" <> 'INTERNO' OR "propriedadeId" IS NOT NULL)),
  ADD CONSTRAINT "Pesagem_proveniencia_check" CHECK (("referenciaHistorica" IS NULL AND "provenienciaHistoricaSnapshot" IS NULL AND "contextoHistorico" <> 'EXTERNO') OR ("referenciaHistorica" IS NOT NULL AND length(btrim("referenciaHistorica")) > 0 AND "provenienciaHistoricaSnapshot" IS NOT NULL AND jsonb_typeof("provenienciaHistoricaSnapshot") = 'object'));
CREATE UNIQUE INDEX "Pesagem_referenciaHistorica_key" ON pecuaria."Pesagem" ("referenciaHistorica");
ALTER TABLE pecuaria."DecisaoElegibilidadeCiclo"
  ADD COLUMN "exameAptidaoId" text REFERENCES pecuaria."ExameAnimal"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD COLUMN "exameAptidaoSnapshot" jsonb;
CREATE INDEX "DecisaoElegibilidadeCiclo_exameAptidaoId_idx" ON pecuaria."DecisaoElegibilidadeCiclo" ("exameAptidaoId");

-- Toque de aptidão usa o exame comum e não é um diagnóstico gestacional.
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
            WHEN (e.realizacao = 'NAO_REALIZADO'::text) THEN 'NAO_AVALIADO'::text
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
