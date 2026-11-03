-- Declaração explícita no fato inicial existente. Não infere nuliparidade dos contadores legados.
ALTER TABLE "pecuaria"."SituacaoInicialReprodutiva"
  ADD COLUMN "classeReprodutiva" TEXT,
  ADD CONSTRAINT "SituacaoInicialReprodutiva_classeReprodutiva_check" CHECK (
    "classeReprodutiva" IS NULL OR (
      "classeReprodutiva" IN ('NOVILHA', 'VACA')
      AND "observacao" IS NOT NULL AND length(btrim("observacao")) >= 5
    )
  );
