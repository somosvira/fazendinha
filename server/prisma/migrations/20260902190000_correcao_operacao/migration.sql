ALTER TABLE "Operacao" ADD COLUMN "corrigeOperacaoId" INTEGER;

CREATE INDEX "Operacao_corrigeOperacaoId_idx" ON "Operacao"("corrigeOperacaoId");

ALTER TABLE "Operacao"
ADD CONSTRAINT "Operacao_corrigeOperacaoId_fkey"
FOREIGN KEY ("corrigeOperacaoId") REFERENCES "Operacao"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
