-- Serviço pode representar material efetivamente usado sem entrada fictícia no estoque.
ALTER TABLE "pecuaria"."TentativaReprodutiva"
  DROP CONSTRAINT "Tentativa_consumo_mantido";
ALTER TABLE "pecuaria"."TentativaReprodutiva"
  ADD CONSTRAINT "Tentativa_consumo_mantido" CHECK (
    NOT "consumoMantido" OR (
      ("movimentoEstoqueId" IS NOT NULL OR "operacaoServicoId" IS NOT NULL)
      AND "status" = 'ANULADO'
    )
  );

-- Consumo mantido não comprova administração. NULL exige revisão da carência;
-- true conserva a evidência registrada e false indica que ela não deve prevalecer.
ALTER TABLE "pecuaria"."AplicacaoProduto"
  ADD COLUMN "administracaoMantida" BOOLEAN;
ALTER TABLE "pecuaria"."AplicacaoProduto"
  ADD CONSTRAINT "Aplicacao_consumo_mantido_anulado" CHECK (
    (NOT "consumoMantido" OR "status" = 'ANULADO')
    AND ("administracaoMantida" IS NULL OR ("consumoMantido" AND "status" = 'ANULADO'))
  );
