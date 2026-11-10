ALTER TABLE "public"."Parceiro" ADD COLUMN "intervaloPagamentoDias" INTEGER;
ALTER TABLE "public"."Parceiro" ADD CONSTRAINT "Parceiro_intervaloPagamentoDias_check"
CHECK ("intervaloPagamentoDias" IS NULL OR "intervaloPagamentoDias" BETWEEN 1 AND 3650);
-- O array legado permanece intacto; intervalo não define parcelas ou vencimentos.
