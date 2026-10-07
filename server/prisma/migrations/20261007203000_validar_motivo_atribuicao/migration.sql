ALTER TABLE "pecuaria"."VigenciaDietaLote" DROP CONSTRAINT "VigenciaDietaLote_anulacao_check";
ALTER TABLE "pecuaria"."VigenciaDietaLote" ADD CONSTRAINT "VigenciaDietaLote_anulacao_check"
  CHECK (("status" = 'VALIDO' AND "anuladoEm" IS NULL AND "motivoAnulacao" IS NULL)
      OR ("status" = 'ANULADO' AND "anuladoEm" IS NOT NULL AND "motivoAnulacao" IS NOT NULL AND length(trim("motivoAnulacao")) >= 5));
