BEGIN;

-- DINHEIRO era um tipo legado de conta e já foi convertido para CAIXA pela
-- migration de cadastros financeiros. Remove o valor residual do enum para que
-- banco e API expressem as mesmas opções disponíveis na interface.
ALTER TYPE "TipoContaFinanceira" RENAME TO "TipoContaFinanceira_antigo";
CREATE TYPE "TipoContaFinanceira" AS ENUM ('BANCO', 'CAIXA', 'APLICACAO');

ALTER TABLE "ContaFinanceira"
  ALTER COLUMN "tipo" TYPE "TipoContaFinanceira"
  USING ("tipo"::text::"TipoContaFinanceira");

DROP TYPE "TipoContaFinanceira_antigo";

COMMIT;
