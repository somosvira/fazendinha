-- Uma anulação não devolve material fisicamente utilizado ou descartado.
ALTER TABLE "pecuaria"."AplicacaoProduto"
  ADD COLUMN "consumoMantido" BOOLEAN NOT NULL DEFAULT false;
