-- Cria Caixinha, MovimentoCaixinha e o enum TipoMovimentoCaixinha ANTES da
-- migration 20260706190000_cultivo_equipe_caixinha_propriedade, que assume
-- essas tabelas já existentes ao fazer ALTER TABLE "Caixinha" ADD COLUMN
-- "propriedadeId". Sem esta migration, `migrate deploy` do zero falha com
-- P3018 / relation "Caixinha" does not exist. Em prod (Neon) a Caixinha
-- já foi materializada via `prisma db push`; nesses ambientes marcar como
-- aplicada com `prisma migrate resolve --applied 20260706185000_...`.

-- CreateEnum
CREATE TYPE "TipoMovimentoCaixinha" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateTable
CREATE TABLE "Caixinha" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "responsavel" TEXT,
    "saldoAtual" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Caixinha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentoCaixinha" (
    "id" SERIAL NOT NULL,
    "caixinhaId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "tipo" "TipoMovimentoCaixinha" NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "descricao" TEXT NOT NULL,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MovimentoCaixinha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MovimentoCaixinha_caixinhaId_data_idx" ON "MovimentoCaixinha"("caixinhaId", "data");

-- AddForeignKey
ALTER TABLE "MovimentoCaixinha" ADD CONSTRAINT "MovimentoCaixinha_caixinhaId_fkey" FOREIGN KEY ("caixinhaId") REFERENCES "Caixinha"("id") ON DELETE CASCADE ON UPDATE CASCADE;
