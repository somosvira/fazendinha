-- Evolução incremental; não altera classificações ou fatos existentes.
ALTER TYPE pecuaria."TipoBaixa" ADD VALUE 'NAO_DETERMINADO';

ALTER TABLE pecuaria."BaixaAnimal"
  ADD COLUMN "referenciaHistorica" text,
  ADD COLUMN "regularizacaoHistoricaSnapshot" jsonb;

CREATE UNIQUE INDEX "BaixaAnimal_referenciaHistorica_key"
  ON pecuaria."BaixaAnimal" ("referenciaHistorica");

-- Comparação textual permite a criação da constraint no mesmo deploy do valor
-- de enum, sem tentar usar um novo literal antes do commit do ALTER TYPE.
ALTER TABLE pecuaria."BaixaAnimal"
  ADD CONSTRAINT "BaixaAnimal_regularizacao_historica_check" CHECK (
    ("referenciaHistorica" IS NULL AND "regularizacaoHistoricaSnapshot" IS NULL AND tipo::text <> 'NAO_DETERMINADO')
    OR (
      "referenciaHistorica" IS NOT NULL
      AND length(btrim("referenciaHistorica")) > 0
      AND "regularizacaoHistoricaSnapshot" IS NOT NULL
      AND jsonb_typeof("regularizacaoHistoricaSnapshot") = 'object'
      AND tipo::text <> 'CADASTRO_INDEVIDO'
      AND jsonb_typeof("regularizacaoHistoricaSnapshot"->'bancoOrigem') = 'string'
      AND jsonb_typeof("regularizacaoHistoricaSnapshot"->'chaveOrigem') = 'string'
      AND jsonb_typeof("regularizacaoHistoricaSnapshot"->'evidencia') = 'string'
      AND jsonb_typeof("regularizacaoHistoricaSnapshot"->'motivo') = 'string'
      AND jsonb_typeof("regularizacaoHistoricaSnapshot"->'usuarioId') = 'number'
      AND COALESCE(("regularizacaoHistoricaSnapshot"->>'usuarioId')::numeric, 0) > 0
      AND COALESCE(length(btrim("regularizacaoHistoricaSnapshot"->>'bancoOrigem')), 0) > 0
      AND COALESCE(length(btrim("regularizacaoHistoricaSnapshot"->>'chaveOrigem')), 0) > 0
      AND COALESCE(length(btrim("regularizacaoHistoricaSnapshot"->>'evidencia')), 0) >= 5
      AND COALESCE(length(btrim("regularizacaoHistoricaSnapshot"->>'motivo')), 0) >= 5
    )
  ),
  ADD CONSTRAINT "BaixaAnimal_tipo_indeterminado_sem_motivo_check" CHECK (
    tipo::text <> 'NAO_DETERMINADO' OR "motivoId" IS NULL
  );
