-- Aditiva: nenhum fato antigo passa a comprovar aptidão, DG ou grau de RP.
ALTER TABLE pecuaria."InterpretacaoReprodutiva"
  ADD COLUMN "resultadoAptidao" text,
  ADD COLUMN "retornoAptidaoEm" date,
  ADD CONSTRAINT "InterpretacaoReprodutiva_resultadoAptidao_check"
    CHECK ("resultadoAptidao" IS NULL OR "resultadoAptidao" IN ('APTO', 'NAO_APTO', 'INCONCLUSIVO')),
  ADD CONSTRAINT "InterpretacaoReprodutiva_retornoAptidao_check"
    CHECK ("retornoAptidaoEm" IS NULL OR "resultadoAptidao" IS NOT NULL);
ALTER TABLE pecuaria."PartoAnimal"
  ADD COLUMN "grauRetencaoPlacenta" integer,
  ADD CONSTRAINT "PartoAnimal_grauRetencaoPlacenta_check"
    CHECK ("grauRetencaoPlacenta" IS NULL OR ("retencaoPlacenta" IS TRUE AND "grauRetencaoPlacenta" IN (1, 2, 3)));
