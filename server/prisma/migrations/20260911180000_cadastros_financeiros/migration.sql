BEGIN;

CREATE TYPE "PapelParceiro" AS ENUM ('CLIENTE', 'FORNECEDOR', 'PRESTADOR_SERVICO', 'FUNCIONARIO', 'PROPRIETARIO', 'OUTRO');
CREATE TYPE "TipoBancario" AS ENUM ('CORRENTE', 'POUPANCA', 'PAGAMENTO');
ALTER TABLE "ContaFinanceira"
  ADD COLUMN "tipoBancario" "TipoBancario",
  ADD COLUMN "agencia" TEXT,
  ADD COLUMN "numeroConta" TEXT,
  ADD COLUMN "digito" TEXT,
  ADD COLUMN "titular" TEXT,
  ADD COLUMN "local" TEXT,
  ADD COLUMN "responsavel" TEXT,
  ADD COLUMN "observacoes" TEXT,
  ADD COLUMN "ordem" INTEGER NOT NULL DEFAULT 0;

-- Mantém o enum legado durante o rollout; o cadastro novo aceita apenas CAIXA.
UPDATE "ContaFinanceira" SET "tipo" = 'CAIXA' WHERE "tipo" = 'DINHEIRO';

ALTER TABLE "Parceiro"
  ADD COLUMN "nomeFantasia" TEXT,
  ADD COLUMN "pessoaContato" TEXT,
  ADD COLUMN "telefoneWhatsapp" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cep" TEXT,
  ADD COLUMN "logradouro" TEXT,
  ADD COLUMN "numero" TEXT,
  ADD COLUMN "complemento" TEXT,
  ADD COLUMN "bairro" TEXT,
  ADD COLUMN "cidade" TEXT,
  ADD COLUMN "uf" TEXT,
  ADD COLUMN "referencia" TEXT,
  ADD COLUMN "observacoes" TEXT,
  ADD COLUMN "formaPagamentoPreferida" "FormaPagamento",
  ADD COLUMN "condicaoPagamentoPreferida" TEXT,
  ADD COLUMN "prazosPagamento" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

CREATE TABLE "ParceiroPapel" (
  "parceiroId" INTEGER NOT NULL,
  "papel" "PapelParceiro" NOT NULL,
  CONSTRAINT "ParceiroPapel_pkey" PRIMARY KEY ("parceiroId", "papel"),
  CONSTRAINT "ParceiroPapel_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES "Parceiro"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "ParceiroPapel" ("parceiroId", "papel")
SELECT id, unnest(CASE WHEN tipo = 'AMBOS'
  THEN ARRAY['CLIENTE', 'FORNECEDOR']::"PapelParceiro"[]
  ELSE ARRAY[tipo::text::"PapelParceiro"] END) FROM "Parceiro";

COMMIT;
