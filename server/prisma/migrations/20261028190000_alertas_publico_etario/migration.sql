-- AlterTable
ALTER TABLE "pecuaria"."RegraAlertaSanitario" ADD COLUMN     "idadeMaximaMeses" INTEGER,
ADD COLUMN     "idadeMinimaMeses" INTEGER;
ALTER TABLE "pecuaria"."RegraAlertaSanitario" ADD CONSTRAINT "RegraAlertaSanitario_publico_etario_check" CHECK (("idadeMinimaMeses" IS NULL OR "idadeMinimaMeses" >= 0) AND ("idadeMaximaMeses" IS NULL OR "idadeMaximaMeses" >= 0) AND ("idadeMinimaMeses" IS NULL OR "idadeMaximaMeses" IS NULL OR "idadeMinimaMeses" <= "idadeMaximaMeses"));
